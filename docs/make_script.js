"use strict";
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType, BorderStyle,
  Header, Footer, PageNumber, ShadingType, WidthType,
  Table, TableRow, TableCell
} = require("docx");

// ── Palette ────────────────────────────────────────────────────────────────────
const NAVY  = "1B3D6F";
const CYAN  = "4FC3F7";
const GRAY  = "546E7A";
const WHITE = "FFFFFF";

// ── Helpers ────────────────────────────────────────────────────────────────────

function spacer(pt = 6) {
  return new Paragraph({ children: [], spacing: { before: 0, after: pt * 20 } });
}

function sectionHeading(label) {
  return new Paragraph({
    children: [new TextRun({ text: label, bold: true, size: 26, color: WHITE, font: "Calibri" })],
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    spacing: { before: 200, after: 80 },
    indent: { left: 160, right: 160 },
  });
}

function slideLabel(text) {
  return new Paragraph({
    children: [new TextRun({ text: text, bold: true, size: 20, color: NAVY, font: "Calibri" })],
    spacing: { before: 160, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: CYAN, space: 2 },
    },
  });
}

function script(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "“", size: 22, color: GRAY, font: "Calibri" }),
      new TextRun({ text: text, size: 22, color: "222222", font: "Calibri", italics: true }),
      new TextRun({ text: "”", size: 22, color: GRAY, font: "Calibri" }),
    ],
    spacing: { before: 0, after: 100 },
    indent: { left: 360 },
  });
}

function tip(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "TIP  ", bold: true, size: 18, color: CYAN, font: "Calibri" }),
      new TextRun({ text: text, size: 18, color: GRAY, font: "Calibri" }),
    ],
    spacing: { before: 0, after: 60 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 6, color: CYAN, space: 6 } },
  });
}

// ── Document ───────────────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1",
        basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: NAVY, font: "Calibri" },
        paragraph: { spacing: { before: 0, after: 200 }, outlineLevel: 0 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },        // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "DRONE GCS", bold: true, size: 18, color: NAVY, font: "Calibri" }),
              new TextRun({ text: "   |   Client Presentation Script", size: 18, color: GRAY, font: "Calibri" }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 2 } },
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Page ", size: 16, color: GRAY, font: "Calibri" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: "Calibri" }),
              new TextRun({ text: "  ·  Drone GCS ·  Confidential", size: 16, color: GRAY, font: "Calibri" }),
            ],
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 2 } },
          }),
        ],
      }),
    },
    children: [

      // ── TITLE ──────────────────────────────────────────────────────────────
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Drone GCS", bold: true, size: 52, color: NAVY, font: "Calibri" })],
        spacing: { before: 0, after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Client Presentation Script", size: 26, color: GRAY, font: "Calibri" })],
        spacing: { before: 0, after: 40 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } },
      }),
      spacer(12),

      // ── HOW THE APP IS BUILT ──────────────────────────────────────────────
      sectionHeading("HOW THE APP IS BUILT"),
      spacer(4),

      // Intro paragraph
      new Paragraph({
        children: [new TextRun({
          text: "Drone GCS is a full-stack system split across two layers: an onboard stack running on the drone and a desktop app running on the operator's laptop. Both communicate over Wi-Fi using a WebSocket bridge — no ROS installation is needed on the laptop.",
          size: 22, color: "222222", font: "Calibri",
        })],
        spacing: { before: 0, after: 160 },
      }),

      // Tech table header
      new Paragraph({
        children: [new TextRun({ text: "Technology breakdown", bold: true, size: 22, color: NAVY, font: "Calibri" })],
        spacing: { before: 0, after: 80 },
      }),

      // Tech rows as bordered cards
      ...[
        {
          layer: "Onboard computer",
          detail: "Raspberry Pi 5 (8 GB) running Ubuntu 24.04 + ROS2 Jazzy. All sensor processing, SLAM, vision, and MAVLink bridging run here as ROS2 nodes.",
        },
        {
          layer: "3D Mapping — Point-LIO SLAM",
          detail: "The Unitree 4D LiDAR connects over Ethernet (eth0). Point-LIO, a tightly-coupled LiDAR-inertial odometry algorithm, builds a live 3D point cloud at 800,000 points/scan and publishes the robot pose at 4 Hz over ROS2 topics.",
        },
        {
          layer: "Flight controller bridge — pymavlink",
          detail: "A custom Python node replaces MAVROS entirely. It connects to the Pixhawk over GPIO UART (57600 baud), reads telemetry (attitude, GPS, battery, motors) and forwards commands (ARM, modes, takeoff, land) via MAVLink v2.",
        },
        {
          layer: "Camera & vision — picamera2 + pyzbar",
          detail: "The Pi Camera Module is read with picamera2 and published as a compressed ROS image topic. A second node decodes barcodes and QR codes in real time using pyzbar + OpenCV, stamps each detection with the current SLAM position, and inserts a record into a local SQLite database.",
        },
        {
          layer: "Communication — rosbridge WebSocket",
          detail: "rosbridge_server exposes the entire ROS2 topic graph as a standard WebSocket on port 9090. The laptop app connects using ROSLIB.js — a JavaScript client library — and subscribes/publishes topics as if it were a native ROS node.",
        },
        {
          layer: "Ground app — Electron + Node.js",
          detail: "The desktop app is built with Electron, meaning it is a web app (HTML/JS) packaged as a native executable for Windows, Linux, and macOS. There is no browser needed and no ROS installation required on the laptop. ROSLIB.js, Chart.js, and an HTML Canvas handle all real-time visualisation.",
        },
        {
          layer: "Live camera stream — MJPEG",
          detail: "A lightweight Flask server on the Pi serves the forward camera as an MJPEG HTTP stream on port 8080. The GCS simply points an <img> tag at http://PI_IP:8080/cam1 — no ROS decoding needed for the dashboard camera.",
        },
      ].map(row => [
        new Paragraph({
          children: [
            new TextRun({ text: row.layer, bold: true, size: 21, color: NAVY, font: "Calibri" }),
          ],
          spacing: { before: 120, after: 20 },
          border: { left: { style: BorderStyle.SINGLE, size: 6, color: CYAN, space: 6 } },
          indent: { left: 160 },
        }),
        new Paragraph({
          children: [new TextRun({ text: row.detail, size: 20, color: "333333", font: "Calibri" })],
          spacing: { before: 0, after: 60 },
          indent: { left: 160 },
        }),
      ]).flat(),

      spacer(16),

      // ── OVERVIEW ──────────────────────────────────────────────────────────
      sectionHeading("PRESENTATION OVERVIEW"),
      spacer(4),
      new Paragraph({
        children: [new TextRun({
          text: "Estimated duration: 5–8 minutes + demo. Use this script slide by slide. Speak naturally — the quotes are a guide, not a read-aloud.",
          size: 20, color: GRAY, font: "Calibri", italics: true,
        })],
        spacing: { before: 0, after: 160 },
      }),

      // ── SLIDE 1 ────────────────────────────────────────────────────────────
      slideLabel("SLIDE 1 — Cover"),
      script(
        "This is Drone GCS — an autonomous ground control system we built for UAV-based warehouse and facility inspection. " +
        "Everything runs wirelessly: the drone carries a Raspberry Pi on board, and all data streams live to this laptop over Wi-Fi. " +
        "No cables, no manual operation required."
      ),
      spacer(8),

      // ── SLIDE 2 ────────────────────────────────────────────────────────────
      slideLabel("SLIDE 2 — What is Drone GCS?"),
      script(
        "The system does four things: it flies and navigates autonomously, it maps the environment in 3D using a LiDAR sensor, " +
        "it reads barcodes and QR codes from the camera, and it logs everything to a database. Let me show you each one."
      ),
      spacer(8),

      // ── SLIDE 3 ────────────────────────────────────────────────────────────
      slideLabel("SLIDE 3 — Mission Control Dashboard"),
      script(
        "This is the main dashboard. From here you can arm and disarm the drone, switch flight modes — Guided, Loiter, Auto — " +
        "trigger takeoff and landing, and watch the live camera feed. " +
        "The map in the bottom half shows the drone’s real-time position and the planned waypoint route. " +
        "All services — mapping, camera, the flight controller bridge — are managed from this single panel."
      ),
      spacer(8),

      // ── SLIDE 4 ────────────────────────────────────────────────────────────
      slideLabel("SLIDE 4 — Real-Time Flight Navigation"),
      script(
        "The navigation tab gives you full flight telemetry: artificial horizon, compass heading, altitude, airspeed, roll and pitch. " +
        "All data comes directly from the flight controller over MAVLink."
      ),
      spacer(8),

      // ── SLIDE 5 ────────────────────────────────────────────────────────────
      slideLabel("SLIDE 5 — 3D LiDAR SLAM Mapping"),
      script(
        "This is the live 3D map being built in real time. The LiDAR sensor fires 800,000 laser points per second. " +
        "The SLAM algorithm processes them on board and builds this colour-coded map as the drone moves. " +
        "Red is high, blue is low. The map can be saved and reused for localization on future flights."
      ),
      spacer(8),

      // ── SLIDE 6 ────────────────────────────────────────────────────────────
      slideLabel("SLIDE 6 — Autonomous Inventory Detection"),
      script(
        "This is the key feature for your use case. The drone flies over shelves, the camera detects barcodes and QR codes automatically, " +
        "and every detection is stamped with the drone’s exact position from SLAM. " +
        "The result is a real-time inventory log — time, product code, and location — " +
        "which you can export to CSV or Excel at any time."
      ),
      spacer(8),

      // ── SLIDE 8 ────────────────────────────────────────────────────────────
      slideLabel("SLIDE 8 — Demo / Q&A"),
      script(
        "To summarise: this system can autonomously scan a warehouse, build a map, and generate a georeferenced inventory report — " +
        "with no human manually reading barcodes. We’re ready for a live demo whenever you are."
      ),
      spacer(16),

      // ── TIPS ──────────────────────────────────────────────────────────────
      sectionHeading("PRESENTER TIPS"),
      spacer(4),
      tip("Pause on the SLAM slide — clients always react to the live 3D point cloud. Let it sink in before moving on."),
      spacer(4),
      tip("For the barcode slide, hold a real barcode in front of the camera during the demo if possible."),
      spacer(4),
      tip("If asked about accuracy: SLAM positioning is ±10 cm indoors with the Unitree LiDAR."),
      spacer(4),
      tip("If asked about battery life: depends on drone frame, but the system itself adds minimal load — the Pi draws under 8 W."),
      spacer(4),
      tip("Connect to the Pi over Wi-Fi before the meeting — the green dot top-right must be solid before presenting."),
      spacer(16),

      // ── CLOSING ────────────────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({
          text: "Drone GCS  ·  Autonomous Ground Control System",
          size: 18, color: GRAY, font: "Calibri", italics: true,
        })],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 4 } },
        spacing: { before: 0, after: 0 },
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("C:/drone-gcs/docs/Drone_GCS_Script.docx", buf);
  console.log("Saved: Drone_GCS_Script.docx");
});
