// make_presentation.js — Drone GCS client showcase deck
"use strict";
const pptxgen = require("pptxgenjs");
const path    = require("path");

const SS  = "C:/drone-gcs/docs/screenshots";  // screenshots folder
const OUT = "C:/drone-gcs/docs/Drone_GCS_Presentation.pptx";

// ── Palette (dark theme matching the app) ─────────────────────────────────────
const C = {
  bg:       "0D1B2A",   // app background — darkest navy
  navyMid:  "1B3D6F",   // medium navy accent
  card:     "122035",   // card/panel background
  cyan:     "4FC3F7",   // highlight (matches app blue)
  mint:     "64D2A4",   // active/success green
  white:    "FFFFFF",
  gray:     "B0BEC5",   // light body text
  dimGray:  "546E7A",   // dimmed labels
  orange:   "FFA726",
};

const makeShadow = () => ({
  type: "outer", blur: 14, offset: 5, angle: 135,
  color: "000000", opacity: 0.40
});

const pres = new pptxgen();
pres.layout  = "LAYOUT_16x9";   // 10" × 5.625"
pres.author  = "Drone GCS Team";
pres.title   = "Drone GCS — Autonomous Ground Control System";

// ── Shared helpers ─────────────────────────────────────────────────────────────

function slideHeader(s, title) {
  // Left cyan accent bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0.55, w: 0.07, h: 0.48,
    fill: { color: C.cyan }, line: { color: C.cyan }
  });
  // Title text
  s.addText(title, {
    x: 0.18, y: 0.52, w: 9.5, h: 0.55,
    fontFace: "Calibri", fontSize: 22, bold: true,
    color: C.white, margin: 0
  });
  // Thin divider
  s.addShape(pres.shapes.LINE, {
    x: 0.18, y: 1.07, w: 9.64, h: 0,
    line: { color: C.navyMid, width: 1 }
  });
}

function featureCard(s, x, y, w, h, icon, title, sub) {
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: C.card },
    line: { color: C.navyMid, width: 1 }
  });
  s.addText([
    { text: icon + "  ", options: { fontSize: 13, color: C.cyan } },
    { text: title, options: { bold: true, color: C.white, fontSize: 12, breakLine: true } },
    { text: sub,   options: { color: C.gray, fontSize: 10 } }
  ], { x: x + 0.12, y: y + 0.07, w: w - 0.2, h: h - 0.1, valign: "top", margin: 0 });
}

function screenshotWithCards(s, imgFile, cards) {
  // Screenshot (left 58%)
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.17, y: 1.13, w: 5.82, h: 3.85,
    fill: { color: C.navyMid }, line: { color: C.navyMid, width: 0 }
  });
  s.addImage({
    path: path.join(SS, imgFile),
    x: 0.2, y: 1.15, w: 5.76, h: 3.82
  });
  // Feature cards (right 38%)
  const bx = 6.25, bw = 3.5, bh = 0.68;
  cards.forEach((c, i) => {
    featureCard(s, bx, 1.15 + i * (bh + 0.07), bw, bh, c.icon, c.title, c.sub);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — COVER
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Decorative circles
  s.addShape(pres.shapes.OVAL, {
    x: 6.8, y: -1.5, w: 5.5, h: 5.5,
    fill: { color: C.navyMid, transparency: 72 },
    line: { color: C.navyMid, width: 1 }
  });
  s.addShape(pres.shapes.OVAL, {
    x: 7.5, y: -0.7, w: 3.5, h: 3.5,
    fill: { color: C.cyan, transparency: 90 },
    line: { color: C.cyan, width: 1, transparency: 65 }
  });

  // Tall left accent stripe
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 1.35, w: 0.09, h: 2.8,
    fill: { color: C.cyan }, line: { color: C.cyan }
  });

  // DRONE GCS wordmark
  s.addText("DRONE", {
    x: 0.82, y: 1.3, w: 7.0, h: 1.0,
    fontFace: "Calibri", fontSize: 66, bold: true,
    color: C.white, charSpacing: 10, margin: 0
  });
  s.addText("GCS", {
    x: 0.82, y: 2.2, w: 7.0, h: 0.9,
    fontFace: "Calibri", fontSize: 66, bold: true,
    color: C.cyan, charSpacing: 10, margin: 0
  });

  // Subtitle
  s.addText("Autonomous Ground Control System", {
    x: 0.82, y: 3.2, w: 7.5, h: 0.5,
    fontFace: "Calibri", fontSize: 18,
    color: C.gray, charSpacing: 2, margin: 0
  });

  // Tag line dots
  s.addText("Real-Time Navigation  ·  LiDAR SLAM Mapping  ·  Inventory Detection", {
    x: 0.82, y: 3.72, w: 8.5, h: 0.35,
    fontFace: "Calibri", fontSize: 12,
    color: C.dimGray, margin: 0
  });

  // Footer bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.2, w: 10, h: 0.425,
    fill: { color: C.navyMid }, line: { color: C.navyMid }
  });
  s.addText(
    "Raspberry Pi 5  ·  ROS2 Jazzy  ·  Electron  ·  Point-LIO SLAM  ·  MAVLink  ·  OpenCV",
    {
      x: 0.3, y: 5.22, w: 9.4, h: 0.36,
      fontFace: "Calibri", fontSize: 10.5, color: C.gray,
      align: "center", valign: "middle", margin: 0
    }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  slideHeader(s, "What is Drone GCS?");

  // Description paragraph
  s.addText([
    { text: "A complete ground control station for autonomous UAV operations.\n\n",
      options: { bold: true, color: C.white, fontSize: 14, breakLine: true } },
    { text: "Built on ROS2 + Electron, it runs on a Raspberry Pi 5 on board the\n",
      options: { color: C.gray, fontSize: 12, breakLine: true } },
    { text: "drone and streams all telemetry and video to a laptop over Wi-Fi.\n\n",
      options: { color: C.gray, fontSize: 12, breakLine: true } },
    { text: "No internet needed — everything works on a local network.",
      options: { color: C.dimGray, fontSize: 11, italic: true } }
  ], { x: 0.35, y: 1.2, w: 4.7, h: 1.9, valign: "top", margin: 0 });

  // 2×2 capability cards
  const caps = [
    { icon: "📡", title: "Live Telemetry",   sub: "MAVLink attitude, GPS, battery, speed" },
    { icon: "🗺️", title: "LiDAR SLAM",        sub: "3D maps at 800 k pts/scan in real time" },
    { icon: "📷", title: "Dual Camera",      sub: "MJPEG dashboard + ROS barcode stream" },
    { icon: "📦", title: "Auto Inventory",   sub: "Barcode → SLAM position → SQLite DB" },
  ];
  const cW = 2.2, cH = 1.05, gx = 0.15, gy = 0.1;
  caps.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 0.35 + col * (cW + gx);
    const cy = 2.95 + row * (cH + gy);
    s.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: cy, w: cW, h: cH,
      fill: { color: C.card }, line: { color: C.navyMid, width: 1 }
    });
    // Cyan left border accent
    s.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: cy, w: 0.05, h: cH,
      fill: { color: C.cyan }, line: { color: C.cyan }
    });
    s.addText([
      { text: c.icon + "  ", options: { fontSize: 14, color: C.cyan } },
      { text: c.title, options: { bold: true, color: C.white, fontSize: 13, breakLine: true } },
      { text: c.sub, options: { color: C.gray, fontSize: 10 } }
    ], { x: cx + 0.15, y: cy + 0.1, w: cW - 0.22, h: cH - 0.15, valign: "top", margin: 0 });
  });

  // Architecture diagram — right column
  const archX = 5.3;
  s.addText("SYSTEM ARCHITECTURE", {
    x: archX, y: 1.15, w: 4.4, h: 0.3,
    fontFace: "Calibri", fontSize: 10, bold: true, charSpacing: 2,
    color: C.dimGray, margin: 0
  });

  const arch = [
    { label: "LiDAR Sensor",        note: "Unitree 4D  |  Ethernet eth0",   color: "1A5E8A" },
    { label: "Pi Camera Module",     note: "picamera2  |  ROS topic",        color: "1A5E8A" },
    { label: "Raspberry Pi 5",       note: "ROS2 Jazzy  |  gcs_control.py",  color: C.navyMid },
    { label: "Pixhawk FC",           note: "ArduCopter  |  GPIO UART 57600", color: "1A5E8A" },
    { label: "GCS — Laptop",         note: "Electron  |  ws://Pi:9090",      color: "0E6251" },
  ];
  arch.forEach((b, i) => {
    const by = 1.55 + i * 0.72;
    s.addShape(pres.shapes.RECTANGLE, {
      x: archX, y: by, w: 4.45, h: 0.56,
      fill: { color: b.color }, line: { color: b.color }
    });
    s.addText([
      { text: b.label + "\n", options: { bold: true, color: C.white, fontSize: 12 } },
      { text: b.note,          options: { color: "A9CCE3", fontSize: 9 } }
    ], { x: archX + 0.15, y: by + 0.04, w: 4.1, h: 0.5, valign: "top", margin: 0 });

    // Connector arrow between boxes
    if (i < arch.length - 1) {
      s.addShape(pres.shapes.LINE, {
        x: archX + 2.2, y: by + 0.56, w: 0, h: 0.16,
        line: { color: C.cyan, width: 1.5 }
      });
    }
  });

  // Wi-Fi label between Pi and GCS
  s.addText("Wi-Fi / rosbridge :9090", {
    x: archX + 1.5, y: 1.55 + 3 * 0.72 + 0.57, w: 2.5, h: 0.15,
    fontFace: "Calibri", fontSize: 8, italic: true,
    color: C.cyan, align: "center", margin: 0
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  slideHeader(s, "Mission Control Dashboard");
  screenshotWithCards(s, "screenshot_22.png", [
    { icon: "🎮", title: "ARM / DISARM",        sub: "One-click arming via MAVLink command" },
    { icon: "📹", title: "Live Camera Feed",     sub: "MJPEG stream from forward camera" },
    { icon: "🗺️", title: "Navigation Map",       sub: "Real-time SLAM path + waypoints" },
    { icon: "⚙️", title: "Service Manager",      sub: "Start/stop SLAM · MAVROS · Brain · Camera" },
    { icon: "🔋", title: "Battery & Motors",     sub: "Voltage, charge %, thrust per motor" },
    { icon: "✈️", title: "Flight Mode Control",  sub: "GUIDED · LOITER · AUTO · STAB · RTL" },
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  slideHeader(s, "Real-Time Flight Navigation");
  screenshotWithCards(s, "screenshot_21.png", [
    { icon: "🎯", title: "Artificial Horizon",   sub: "AHRS roll & pitch visualisation" },
    { icon: "🧭", title: "Compass Rose",         sub: "Live magnetic heading indicator" },
    { icon: "📊", title: "Live Charts",          sub: "Altitude, airspeed & vertical speed" },
    { icon: "📐", title: "Attitude Data",        sub: "Roll, pitch, yaw in real time" },
    { icon: "🛰️", title: "GPS Status",           sub: "Fix type, satellite count, coordinates" },
    { icon: "💨", title: "Body Velocities",      sub: "Vx · Vy · Vz from GLOBAL_POSITION_INT" },
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — SLAM
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  slideHeader(s, "3D LiDAR SLAM Mapping");
  screenshotWithCards(s, "screenshot_19.png", [
    { icon: "📡", title: "800 000 Points/Scan",  sub: "High-density 3D environment model" },
    { icon: "🧮", title: "Point-LIO Algorithm",  sub: "Tightly-coupled LiDAR-inertial odometry" },
    { icon: "📍", title: "Live Pose Tracking",   sub: "x, y, z + orientation at 4 Hz" },
    { icon: "🎨", title: "Height Colormap",      sub: "Red = high · Yellow = mid · Blue = low" },
    { icon: "💾", title: "Map Export",           sub: "Save occupancy scan to .pcd file" },
    { icon: "🔄", title: "Loop Closure",         sub: "Automatic drift correction" },
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — IMAGE PROCESSING / BARCODE
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  slideHeader(s, "Autonomous Inventory Detection");
  screenshotWithCards(s, "screenshot_31.png", [
    { icon: "📦", title: "Barcode + QR Detection", sub: "pyzbar + zlib, real-time recognition" },
    { icon: "📍", title: "SLAM-Tagged Position",   sub: "x, y, z coordinates logged per scan" },
    { icon: "🗄️", title: "Auto DB Insert",         sub: "SQLite record on every new detection" },
    { icon: "📊", title: "CSV / Excel Export",     sub: "Full inventory with position + timestamp" },
    { icon: "🔁", title: "Dedup Filter",           sub: "3-second re-scan protection per code" },
    { icon: "🔲", title: "ROI Overlay",            sub: "Green polygon + label on detected codes" },
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — TECH STACK
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  slideHeader(s, "Technology Stack");

  const cols = [
    {
      title:  "Hardware",
      hColor: "1A5E8A",
      items:  ["Raspberry Pi 5 — 8 GB", "Unitree 4D LiDAR", "RPi Camera Module", "Pixhawk FC", "ArduCopter"],
    },
    {
      title:  "Pi Software",
      hColor: "1A5276",
      items:  ["ROS2 Jazzy", "Point-LIO SLAM", "pymavlink bridge", "pyzbar / OpenCV", "rosbridge WS"],
    },
    {
      title:  "GCS App",
      hColor: "0E6251",
      items:  ["Electron + Node.js", "ROSLIB.js", "Chart.js", "Leaflet maps", "SQLite3"],
    },
    {
      title:  "Protocols",
      hColor: "6E2F1A",
      items:  ["MAVLink v2 (serial)", "rosbridge :9090", "MJPEG HTTP :8080", "ROS2 DDS / RTPS", "JSON command bus"],
    },
  ];

  const cW = 2.22, cH_hdr = 0.44, cH_body = 3.62, gap = 0.11;
  cols.forEach((col, i) => {
    const cx = 0.28 + i * (cW + gap);

    // Header
    s.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: 1.15, w: cW, h: cH_hdr,
      fill: { color: col.hColor }, line: { color: col.hColor }
    });
    s.addText(col.title, {
      x: cx, y: 1.15, w: cW, h: cH_hdr,
      fontFace: "Calibri", fontSize: 13, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0
    });

    // Body
    s.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: 1.59, w: cW, h: cH_body,
      fill: { color: C.card }, line: { color: C.navyMid, width: 1 }
    });

    col.items.forEach((item, j) => {
      const iy = 1.69 + j * 0.65;
      // Dot bullet
      s.addShape(pres.shapes.OVAL, {
        x: cx + 0.14, y: iy + 0.14, w: 0.11, h: 0.11,
        fill: { color: C.cyan }, line: { color: C.cyan }
      });
      s.addText(item, {
        x: cx + 0.33, y: iy + 0.02, w: cW - 0.42, h: 0.42,
        fontFace: "Calibri", fontSize: 11.5,
        color: C.white, valign: "middle", margin: 0
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — CLOSING / DEMO
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Decorative circles
  s.addShape(pres.shapes.OVAL, {
    x: -1.8, y: 1.2, w: 4.5, h: 4.5,
    fill: { color: C.navyMid, transparency: 72 },
    line: { color: C.navyMid, width: 1 }
  });
  s.addShape(pres.shapes.OVAL, {
    x: 7.6, y: 1.8, w: 3.8, h: 3.8,
    fill: { color: C.cyan, transparency: 88 },
    line: { color: C.cyan, width: 1, transparency: 65 }
  });

  s.addText("Demo time!", {
    x: 0.5, y: 1.3, w: 9, h: 1.1,
    fontFace: "Calibri", fontSize: 56, bold: true,
    color: C.white, align: "center", charSpacing: 4, margin: 0
  });
  s.addText("Questions?", {
    x: 0.5, y: 2.35, w: 9, h: 0.65,
    fontFace: "Calibri", fontSize: 26,
    color: C.cyan, align: "center", margin: 0
  });

  // Stats strip
  const stats = [
    { num: "800K",  label: "LiDAR pts/scan" },
    { num: "4",     label: "App modules" },
    { num: "ROS2",  label: "Jazzy middleware" },
    { num: "Wi-Fi", label: "zero cable needed" },
  ];
  stats.forEach((st, i) => {
    const sx = 0.9 + i * 2.1;
    // Stat number
    s.addText(st.num, {
      x: sx, y: 3.35, w: 1.9, h: 0.72,
      fontFace: "Calibri", fontSize: 34, bold: true,
      color: C.cyan, align: "center", margin: 0
    });
    // Stat label
    s.addText(st.label, {
      x: sx, y: 4.05, w: 1.9, h: 0.28,
      fontFace: "Calibri", fontSize: 10.5,
      color: C.gray, align: "center", margin: 0
    });
    // Divider (except last)
    if (i < stats.length - 1) {
      s.addShape(pres.shapes.LINE, {
        x: sx + 2.0, y: 3.4, w: 0, h: 0.9,
        line: { color: C.navyMid, width: 1 }
      });
    }
  });

  // Footer bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.2, w: 10, h: 0.425,
    fill: { color: C.navyMid }, line: { color: C.navyMid }
  });
  s.addText("DRONE GCS  ·  Autonomous Ground Control System  ·  UPC 2026", {
    x: 0.3, y: 5.22, w: 9.4, h: 0.36,
    fontFace: "Calibri", fontSize: 10.5, color: C.gray,
    align: "center", valign: "middle", margin: 0
  });
}

// ── Write file ─────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: OUT })
  .then(() => console.log("✓  Saved:", OUT))
  .catch(e => { console.error("ERROR:", e); process.exit(1); });
