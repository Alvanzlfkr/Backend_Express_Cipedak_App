console.log("📦 whatsapp.service.js LOADED");

import baileys from "@whiskeysockets/baileys";
import fs from "fs";
import QRCode from "qrcode";
import pino from "pino";
import { platform } from "os";

let latestQR = null;
let sock = null;
let isReady = false;
let isConnecting = false;
let deviceInfo = null;
let authState = null;

const AUTH_DIR = "./wa-auth";

/* ===============================
   LOGGER (ANTI SPAM TOTAL)
================================ */
const logger = pino({
  level: "silent",
});

/* ===============================
   INIT WHATSAPP
================================ */
export async function initWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
  } = baileys;

  try {
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        await sock.ws.close();
      } catch {}
      sock = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    authState = state;

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      syncFullHistory: false,
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      /* ===============================
         QR GENERATED
      ================================ */
      if (qr) {
        console.log("📲 QR Generated");

        latestQR = await QRCode.toDataURL(qr);
        isReady = false;
      }

      /* ===============================
         CONNECTED
      ================================ */
      if (connection === "open") {
        console.log("✅ WhatsApp connected");

        latestQR = null;
        isReady = true;
        isConnecting = false;

        buildDeviceInfo();

        console.log("📱 Device Info:", deviceInfo);
      }

      /* ===============================
         CONNECTION CLOSED
      ================================ */
      if (connection === "close") {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.output?.payload?.statusCode ||
          lastDisconnect?.error?.output?.payload?.error ||
          lastDisconnect?.error?.statusCode;

        console.log("❌ Connection closed:", statusCode);

        // ✅ STREAM REPLACED (biasanya karena restart)
        if (statusCode === 440 || statusCode === "440") {
          console.log("⚠️ Stream replaced - tetap dianggap aktif");
          isReady = true;
          isConnecting = false;
          buildDeviceInfo();
          return;
        }

        // ✅ Kalau user masih ada berarti masih login
        if (sock?.user) {
          console.log("⚠️ Close tapi user masih ada → tetap aktif");
          isReady = true;
          isConnecting = false;
          buildDeviceInfo();
          return;
        }

        // 🚪 Logged out
        if (statusCode === DisconnectReason.loggedOut) {
          console.log("🚪 Logged out. Hapus session.");

          if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          }

          isReady = false;
          isConnecting = false;
          deviceInfo = null;

          setTimeout(initWhatsApp, 2000);
          return;
        }

        // 🔄 Reconnect biasa
        console.log("🔄 Reconnecting...");
        isReady = false;
        isConnecting = false;
        setTimeout(initWhatsApp, 5000);
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("❌ Init WhatsApp error:", err);
    isConnecting = false;
    setTimeout(initWhatsApp, 5000);
  }
}

/* ===============================
   BUILD DEVICE INFO (ANTI KOSONG)
================================ */
function buildDeviceInfo() {
  const user = sock?.user;
  const creds = authState?.creds;

  const id = user?.id || creds?.me?.id;

  if (!id) return;

  const raw = id.split("@")[0];

  let number = raw.split(":")[0];

  if (number.startsWith("62")) {
    number = "0" + number.slice(2);
  }

  deviceInfo = {
    id,
    name: `No WhatsApp ${number}`,
    platform: platform(),
  };
}

/* ===============================
   SEND MESSAGE
================================ */
export async function sendWA(phone, message) {
  if (!sock || !isReady) {
    throw new Error("WhatsApp belum siap");
  }

  let number = phone.replace(/\D/g, "");

  if (number.startsWith("0")) {
    number = "62" + number.slice(1);
  }

  const jid = `${number}@s.whatsapp.net`;

  await sock.sendMessage(jid, { text: message });
}

/* ===============================
   RESET / GANTI NOMOR
================================ */
export async function resetWhatsApp() {
  try {
    console.log("🧹 Reset WhatsApp session...");

    if (sock) {
      try {
        sock.ev.removeAllListeners();
        await sock.ws.close();
      } catch {}

      sock = null;
    }

    // Hapus auth folder (ini yang bikin logout)
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }

    latestQR = null;
    isReady = false;
    isConnecting = false;
    deviceInfo = null;

    setTimeout(initWhatsApp, 2000);
  } catch (err) {
    console.error("❌ Reset WA error:", err);
  }
}
/* ===============================
   GET QR
================================ */
export function getLatestQR() {
  return latestQR;
}

/* ===============================
   GET STATUS (SUPER STABLE)
================================ */
export function getWhatsAppStatus() {
  if (!deviceInfo) {
    buildDeviceInfo();
  }

  return {
    isReady: isReady,
    qr: latestQR,
    device: deviceInfo,
  };
}
