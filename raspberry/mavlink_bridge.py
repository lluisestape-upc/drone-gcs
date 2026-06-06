#!/usr/bin/env python3
"""
mavlink_bridge.py — Lightweight MAVLink ↔ ROS2 bridge using pymavlink.

Architecture
------------
This node replaces the heavy MAVROS package with a minimal Python bridge that
connects directly to the Pixhawk flight controller over a serial UART port.

It runs two concurrent execution paths:
  1. Background thread  : reads MAVLink frames from the serial port and
                          publishes them as ROS2 topics.
  2. ROS2 main thread   : handles /drone/cmd subscriptions and timer callbacks
                          (state publisher, GCS heartbeat).

A threading.Lock (_mav_lock) serialises all write operations to the MAVLink
connection so the two paths never corrupt each other's serial writes.

Topics published
----------------
  /drone/vfr          std_msgs/String  JSON — airspeed, groundspeed, heading,
                                              throttle, altitude, climb rate
  /drone/state        std_msgs/String  JSON — armed flag, flight mode, connected
  /drone/motors       std_msgs/String  JSON — PWM channels [1..8]
  /drone/gps_status   std_msgs/String  JSON — fix_type, satellites_visible
  /mavros/battery     sensor_msgs/BatteryState
  /mavros/imu/data    sensor_msgs/Imu  (orientation quaternion + angular velocity)
  /mavros/global_position/global        sensor_msgs/NavSatFix
  /mavros/local_position/velocity_body  geometry_msgs/TwistStamped

Topics subscribed
-----------------
  /drone/cmd  std_msgs/String  JSON commands from the GCS dashboard:
    {"action":"arm"}
    {"action":"disarm"}
    {"action":"mode","mode":"GUIDED"}
    {"action":"takeoff","alt":5.0}
    {"action":"land"}
"""

import json
import math
import os
import threading
import time

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
from sensor_msgs.msg import BatteryState, Imu, NavSatFix
from geometry_msgs.msg import TwistStamped
from pymavlink import mavutil

# ---------------------------------------------------------------------------
# Configuration — can be overridden with environment variables before launch:
#   MAV_BAUD=921600 MAV_PORT=/dev/ttyUSB0 python3 mavlink_bridge.py
# ---------------------------------------------------------------------------
BAUD_RATE = int(os.environ.get('MAV_BAUD', '57600'))


def _find_serial_port() -> str:
    """Return the serial port to use for the MAVLink connection.

    Priority order:
      1. MAV_PORT environment variable (explicit override)
      2. /dev/serial0   — kernel symlink, active only when enable_uart=1 is set
                          in /boot/firmware/config.txt (RPi5 GPIO UART)
      3. /dev/ttyAMA10  — RPi5 RP1-chip UART mapped to GPIO 14/15
      4. /dev/ttyAMA0   — listed AFTER ttyAMA10 because on RPi5 this device
                          may be claimed by the Bluetooth stack (RP1 BT UART),
                          causing a silent open with no MAVLink data
      5. /dev/ttyUSB0   — USB-to-serial adapter (FTDI, CP2102, etc.)
      6. /dev/ttyACM0   — USB CDC-ACM (e.g. Pixhawk connected via USB cable)

    Falls back to /dev/serial0 if none are found, which will produce a clear
    OS error message on open.
    """
    if 'MAV_PORT' in os.environ:
        return os.environ['MAV_PORT']

    # NOTE: ttyAMA10 intentionally precedes ttyAMA0 — on RPi5, ttyAMA0 may
    # be mapped to the Bluetooth chip (RP1), not to the GPIO 14/15 UART.
    candidates = [
        '/dev/serial0',
        '/dev/ttyAMA10',
        '/dev/ttyAMA0',
        '/dev/ttyUSB0',
        '/dev/ttyACM0',
    ]
    for port in candidates:
        if os.path.exists(port):
            return port
    return '/dev/serial0'


SERIAL_PORT = _find_serial_port()

# ---------------------------------------------------------------------------
# ArduCopter flight mode table (custom_mode field in HEARTBEAT message).
# These are ArduCopter-specific integers — PX4 uses a different encoding.
# ---------------------------------------------------------------------------
MODE_MAP = {
    'STABILIZE': 0,  'ACRO':     1,  'ALT_HOLD': 2,  'AUTO':     3,
    'GUIDED':    4,  'LOITER':   5,  'RTL':      6,  'CIRCLE':   7,
    'LAND':      9,  'DRIFT':    11, 'SPORT':    13, 'FLIP':     14,
    'AUTOTUNE':  15, 'POSHOLD':  16, 'BRAKE':    17,
}
# Reverse lookup: integer → mode name string (used when parsing HEARTBEAT)
MODE_REV = {v: k for k, v in MODE_MAP.items()}


# ===========================================================================
class MavlinkBridge(Node):
    """ROS2 node that bridges a Pixhawk flight controller to ROS2 topics.

    On startup it immediately launches a background daemon thread that
    maintains the serial connection to the Pixhawk and dispatches incoming
    MAVLink messages to the appropriate ROS2 publishers.

    All write operations back to the Pixhawk (commands, stream requests,
    heartbeats) go through self._mav_lock to prevent concurrent serial writes
    from the ROS2 main thread and the background reader thread.
    """

    def __init__(self):
        super().__init__('mavlink_bridge')

        # ── ROS2 publishers ──────────────────────────────────────────────────
        # Each publisher mirrors a MAVLink message type onto the ROS2 graph.
        self._pub_vfr    = self.create_publisher(String,       '/drone/vfr',                           10)
        self._pub_state  = self.create_publisher(String,       '/drone/state',                         10)
        self._pub_motors = self.create_publisher(String,       '/drone/motors',                        10)
        self._pub_gpss   = self.create_publisher(String,       '/drone/gps_status',                    10)
        self._pub_bat    = self.create_publisher(BatteryState, '/mavros/battery',                      10)
        self._pub_imu    = self.create_publisher(Imu,          '/mavros/imu/data',                     10)
        self._pub_gps    = self.create_publisher(NavSatFix,    '/mavros/global_position/global',       10)
        self._pub_vel    = self.create_publisher(TwistStamped, '/mavros/local_position/velocity_body', 10)

        # ── ROS2 subscriber ──────────────────────────────────────────────────
        # Receives JSON commands from the GCS dashboard and forwards them to
        # the Pixhawk as MAVLink command messages.
        self.create_subscription(String, '/drone/cmd', self._on_cmd, 10)

        # ── Internal state ───────────────────────────────────────────────────
        self._mav       = None   # pymavlink connection object (set by _mav_loop)
        self._armed     = False  # last known armed state from HEARTBEAT
        self._mode      = '—'   # last known flight mode name from HEARTBEAT
        self._connected = False  # True once heartbeat received and sysid set

        # Mutex protecting all MAVLink write operations.
        # recv_match() runs exclusively in the background thread and does NOT
        # need the lock (it only reads from the receive buffer).
        self._mav_lock = threading.Lock()

        # ── ROS2 timers ──────────────────────────────────────────────────────
        # Publish current state to /drone/state at 1 Hz so the GCS dashboard
        # always has an up-to-date armed/mode/connected indicator.
        self.create_timer(1.0, self._publish_state)

        # Send a GCS heartbeat to the Pixhawk at 1 Hz.
        # ArduCopter monitors GCS heartbeats and silences telemetry streams
        # if no heartbeat is received for ~5 s. Without this timer the bridge
        # would lose all sensor data a few seconds after connecting.
        self.create_timer(1.0, self._send_heartbeat)

        # ── Background MAVLink reader ────────────────────────────────────────
        # daemon=True ensures the thread is killed automatically when the main
        # process exits (no explicit join needed on shutdown).
        threading.Thread(target=self._mav_loop, daemon=True).start()
        self.get_logger().info(
            f'mavlink_bridge starting — {SERIAL_PORT} @ {BAUD_RATE} baud')

    # =========================================================================
    # MAVLink connection management (background thread)
    # =========================================================================

    def _mav_loop(self):
        """Background thread: maintain serial connection and dispatch messages.

        Runs a connect → read → reconnect loop indefinitely while rclpy is ok.
        On each iteration it:
          1. Closes any previously open connection to release the file descriptor.
          2. Opens a new mavlink_connection to the serial port.
          3. Waits up to 15 s for the first HEARTBEAT from the Pixhawk.
          4. Extracts sysid/compid from the heartbeat so commands reach the
             correct target (pymavlink does not always set these automatically).
          5. Requests telemetry streams from the Pixhawk.
          6. Enters a blocking recv_match loop, dispatching each message to
             _handle() until an exception breaks the inner loop.
          7. On any error, waits 5 s before retrying.
        """
        while rclpy.ok():
            try:
                # Close the previous connection before opening a new one.
                # Skipping close() leaks the file descriptor — after enough
                # reconnection cycles the process hits the OS fd limit and
                # subsequent open() calls fail with "Too many open files".
                if self._mav is not None:
                    try:
                        self._mav.close()
                    except Exception:
                        pass
                    self._mav = None

                self.get_logger().info(f'Connecting to Pixhawk on {SERIAL_PORT}…')
                self._mav = mavutil.mavlink_connection(
                    SERIAL_PORT,
                    baud=BAUD_RATE,
                    source_system=255,   # 255 = GCS (standard MAVLink convention)
                )

                # Block until the Pixhawk sends its first HEARTBEAT.
                # Returns the heartbeat message object, or None on timeout.
                hb = self._mav.wait_heartbeat(timeout=15)
                if hb is None:
                    raise Exception('No heartbeat received within 15 s')

                # pymavlink does not always populate target_system / target_component
                # from the first heartbeat. Setting them explicitly from the message
                # source fields ensures commands are addressed to the correct sysid
                # and not dropped silently by the flight controller.
                self._mav.target_system    = hb.get_srcSystem()
                self._mav.target_component = hb.get_srcComponent()
                self._connected = True

                self.get_logger().info(
                    f'Pixhawk connected ✓  '
                    f'sysid={self._mav.target_system}  '
                    f'compid={self._mav.target_component}')

                # Ask the Pixhawk to start sending the telemetry streams we need.
                self._request_streams()

                # Inner read loop — runs until an exception (disconnect, etc.)
                while rclpy.ok():
                    # blocking=True with a 2 s timeout: returns None if no message
                    # arrives within the window (normal — just continue the loop).
                    msg = self._mav.recv_match(blocking=True, timeout=2.0)
                    if msg is None:
                        continue
                    self._handle(msg)

            except Exception as exc:
                self._connected = False
                self.get_logger().warn(
                    f'MAVLink disconnected: {exc} — retrying in 5 s')
                time.sleep(5)

    def _request_streams(self):
        """Ask the Pixhawk to start sending the MAVLink message streams we need.

        Uses REQUEST_DATA_STREAM (message #66), the legacy ArduCopter stream
        request mechanism.  Rates are in Hz.  The lock is held for the entire
        burst to prevent interleaving with any concurrent send from the main
        thread (e.g. an _on_cmd that arrives at the same moment).

        Stream IDs used:
          MAV_DATA_STREAM_ALL        — catch-all, ensures nothing is missed
          MAV_DATA_STREAM_EXTRA1     — ATTITUDE message (roll/pitch/yaw)
          MAV_DATA_STREAM_EXTRA2     — VFR_HUD (airspeed, altitude, throttle)
          MAV_DATA_STREAM_POSITION   — GLOBAL_POSITION_INT (GPS)
          MAV_DATA_STREAM_RC_CHANNELS— SERVO_OUTPUT_RAW / RC_CHANNELS (motors)
        """
        with self._mav_lock:
            m = self._mav
            if m is None:
                return
            for sid, rate in [
                (mavutil.mavlink.MAV_DATA_STREAM_ALL,          4),
                (mavutil.mavlink.MAV_DATA_STREAM_EXTRA1,      10),  # ATTITUDE @ 10 Hz
                (mavutil.mavlink.MAV_DATA_STREAM_EXTRA2,       4),  # VFR_HUD  @ 4 Hz
                (mavutil.mavlink.MAV_DATA_STREAM_POSITION,     5),  # GPS      @ 5 Hz
                (mavutil.mavlink.MAV_DATA_STREAM_RC_CHANNELS,  4),  # Motors   @ 4 Hz
            ]:
                m.mav.request_data_stream_send(
                    m.target_system, m.target_component, sid, rate, 1)

    def _send_heartbeat(self):
        """Send a GCS heartbeat to the Pixhawk (called by 1 Hz ROS2 timer).

        ArduCopter expects periodic heartbeats from the GCS.  If none arrive
        for ~5 s it reduces or stops the telemetry streams it was sending,
        which causes the bridge to appear frozen even though the serial link
        is still physically open.

        MAV_TYPE_GCS + MAV_AUTOPILOT_INVALID is the standard heartbeat
        signature for a ground station.
        """
        with self._mav_lock:
            if self._mav is None or not self._connected:
                return
            try:
                self._mav.mav.heartbeat_send(
                    mavutil.mavlink.MAV_TYPE_GCS,
                    mavutil.mavlink.MAV_AUTOPILOT_INVALID,
                    0, 0, 0)
            except Exception as exc:
                self.get_logger().debug(f'heartbeat_send error: {exc}')

    # =========================================================================
    # MAVLink message dispatcher (called from background thread)
    # =========================================================================

    def _handle(self, msg):
        """Dispatch a received MAVLink message to the appropriate ROS2 publisher.

        Called from the background thread for every message received from the
        Pixhawk.  Each branch handles one MAVLink message type.

        Note: this method only publishes — it never writes to the serial port,
        so it does not need to acquire _mav_lock.
        """
        t = msg.get_type()

        if t == 'HEARTBEAT':
            # Extract armed flag from the MAV_MODE_FLAG bitmask.
            # Update the cached mode name — MODE_REV maps ArduCopter integers
            # back to human-readable strings (e.g. 4 → "GUIDED").
            # Falls back to the raw integer string for unknown modes.
            self._armed = bool(
                msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
            self._mode = MODE_REV.get(msg.custom_mode, str(msg.custom_mode))
            self.get_logger().debug(
                f'HB  armed={self._armed}  mode={self._mode}')

        elif t == 'VFR_HUD':
            # VFR_HUD carries the pilot-facing flight instruments:
            # airspeed (m/s), groundspeed (m/s), heading (°), throttle (%),
            # altitude above home (m), climb rate (m/s).
            self._pub_vfr.publish(String(data=json.dumps({
                'airspeed':    round(float(msg.airspeed),    2),
                'groundspeed': round(float(msg.groundspeed), 2),
                'heading':     int(msg.heading),
                'throttle':    int(msg.throttle),
                'alt':         round(float(msg.alt),         2),
                'climb':       round(float(msg.climb),       2),
            })))

        elif t == 'ATTITUDE':
            # Convert Euler angles (roll/pitch/yaw in radians) to a unit
            # quaternion for the sensor_msgs/Imu message.
            # The standard ZYX Euler → quaternion decomposition is used:
            #   q = q_z(yaw) * q_y(pitch) * q_x(roll)
            imu = Imu()
            r, p, y = msg.roll, msg.pitch, msg.yaw
            cy, sy = math.cos(y * 0.5), math.sin(y * 0.5)
            cp, sp = math.cos(p * 0.5), math.sin(p * 0.5)
            cr, sr = math.cos(r * 0.5), math.sin(r * 0.5)
            imu.orientation.w = cr * cp * cy + sr * sp * sy
            imu.orientation.x = sr * cp * cy - cr * sp * sy
            imu.orientation.y = cr * sp * cy + sr * cp * sy
            imu.orientation.z = cr * cp * sy - sr * sp * cy
            # Angular velocity is published directly (already in rad/s)
            imu.angular_velocity.x = float(msg.rollspeed)
            imu.angular_velocity.y = float(msg.pitchspeed)
            imu.angular_velocity.z = float(msg.yawspeed)
            self._pub_imu.publish(imu)

        elif t == 'SYS_STATUS':
            # SYS_STATUS carries battery measurements:
            #   voltage_battery : mV  → convert to V
            #   current_battery : 10 mA units → convert to A  (-1 = unknown)
            #   battery_remaining: % (-1 = unknown)
            bat = BatteryState()
            bat.voltage    = float(msg.voltage_battery) / 1000.0
            bat.current    = (float(msg.current_battery) / 100.0
                              if msg.current_battery >= 0 else float('nan'))
            bat.percentage = (float(msg.battery_remaining) / 100.0
                              if msg.battery_remaining >= 0 else float('nan'))
            self._pub_bat.publish(bat)

        elif t == 'GLOBAL_POSITION_INT':
            # GLOBAL_POSITION_INT gives fused GPS+INS position.
            # lat/lon are in 1e-7 degrees → convert to decimal degrees.
            # alt is in mm above MSL → convert to metres.
            # vx/vy/vz are in cm/s NED → convert to m/s.
            fix = NavSatFix()
            fix.latitude  = msg.lat / 1e7
            fix.longitude = msg.lon / 1e7
            fix.altitude  = msg.alt / 1000.0
            self._pub_gps.publish(fix)

            tw = TwistStamped()
            tw.twist.linear.x = float(msg.vx) / 100.0
            tw.twist.linear.y = float(msg.vy) / 100.0
            tw.twist.linear.z = float(msg.vz) / 100.0
            self._pub_vel.publish(tw)

        elif t == 'GPS_RAW_INT':
            # Raw GPS receiver data — used to display fix quality and
            # satellite count in the GCS Navigation tab.
            self._pub_gpss.publish(String(data=json.dumps({
                'fix_type':           int(msg.fix_type),
                'satellites_visible': int(msg.satellites_visible),
            })))

        elif t == 'SERVO_OUTPUT_RAW':
            # Motor output PWM values (µs, range 1000–2000) for all 8 channels.
            # Preferred over RC_CHANNELS as it reflects actual motor commands.
            channels = [
                int(getattr(msg, f'servo{i}_raw', 1000)) for i in range(1, 9)
            ]
            self._pub_motors.publish(
                String(data=json.dumps({'channels': channels})))

        elif t == 'RC_CHANNELS':
            # RC input / override channels — used as fallback if
            # SERVO_OUTPUT_RAW is not available on the connected firmware.
            channels = [
                int(getattr(msg, f'chan{i}_raw', 1000)) for i in range(1, 9)
            ]
            self._pub_motors.publish(
                String(data=json.dumps({'channels': channels})))

    # =========================================================================
    # ROS2 timer callbacks (main thread)
    # =========================================================================

    def _publish_state(self):
        """Publish arm/mode/connected state at 1 Hz (ROS2 timer callback).

        The GCS dashboard subscribes to /drone/state to update the ARM button
        colour and the mode indicator in real time.
        """
        self._pub_state.publish(String(data=json.dumps({
            'armed':     self._armed,
            'mode':      self._mode,
            'connected': self._connected,
        })))

    # =========================================================================
    # Command handler (ROS2 subscriber callback, main thread)
    # =========================================================================

    def _on_cmd(self, msg: String):
        """Handle a JSON command received on /drone/cmd.

        Parses the JSON payload and translates it into the appropriate MAVLink
        command sent to the Pixhawk.  All sends are protected by _mav_lock to
        prevent concurrent serial writes with the heartbeat timer or stream
        request that may fire simultaneously from another timer callback.

        Supported actions:
          arm      — MAV_CMD_COMPONENT_ARM_DISARM (param1=1)
          disarm   — MAV_CMD_COMPONENT_ARM_DISARM (param1=0)
          mode     — SET_MODE with ArduCopter custom_mode integer
          takeoff  — MAV_CMD_NAV_TAKEOFF (param7 = target altitude in metres)
          land     — MAV_CMD_NAV_LAND
        """
        if not self._connected or not self._mav:
            self.get_logger().warn('Command received but Pixhawk not connected')
            return
        try:
            d = json.loads(msg.data)
        except Exception:
            return

        action = d.get('action', '')

        with self._mav_lock:
            m = self._mav
            if m is None:
                return

            if action == 'arm':
                m.mav.command_long_send(
                    m.target_system, m.target_component,
                    mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
                    0, 1, 0, 0, 0, 0, 0, 0)   # param1=1 → arm
                self.get_logger().info('ARM sent')

            elif action == 'disarm':
                m.mav.command_long_send(
                    m.target_system, m.target_component,
                    mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
                    0, 0, 0, 0, 0, 0, 0, 0)   # param1=0 → disarm
                self.get_logger().info('DISARM sent')

            elif action == 'mode':
                # Look up the ArduCopter mode integer from the name string.
                # Defaults to LOITER (5) if the requested mode is unknown.
                name    = d.get('mode', 'LOITER').upper()
                mode_id = MODE_MAP.get(name, 5)
                m.mav.set_mode_send(
                    m.target_system,
                    mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
                    mode_id)
                self.get_logger().info(f'SET_MODE → {name} ({mode_id})')

            elif action == 'takeoff':
                alt = float(d.get('alt', 5.0))
                m.mav.command_long_send(
                    m.target_system, m.target_component,
                    mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
                    0, 0, 0, 0, 0, 0, 0, alt)  # param7 = target altitude (m)
                self.get_logger().info(f'TAKEOFF → {alt} m')

            elif action == 'land':
                m.mav.command_long_send(
                    m.target_system, m.target_component,
                    mavutil.mavlink.MAV_CMD_NAV_LAND,
                    0, 0, 0, 0, 0, 0, 0, 0)
                self.get_logger().info('LAND sent')


# ===========================================================================
# Entry point
# ===========================================================================

def main():
    """Initialise rclpy, spin the node, and clean up on exit."""
    rclpy.init()
    node = MavlinkBridge()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
