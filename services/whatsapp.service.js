console.log("📦 whatsapp.service.js LOADED");

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import fs from "fs";
import pino from "pino";

let sock = null;
let isReady = false;
let isConnecting = false;

const AUTH_DIR = "./wa-auth";

/* ===============================
   LOGGER (ANTI SPAM TOTAL)
================================ */
const logger = pino({
  level: "silent", // ⬅️ BENAR-BENAR MATI
});

/* ===============================
   INIT WHATSAPP
================================ */
export async function initWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger, // ✅ FIX logger.child error
      syncFullHistory: false,
    });

    sock.ev.on("connection.update", (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        console.log("📲 Scan QR WhatsApp:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        console.log("✅ WhatsApp connected");
        isReady = true;
        isConnecting = false;
      }

      if (connection === "close") {
        isReady = false;
        isConnecting = false;

        const statusCode =
          lastDisconnect?.error?.output?.statusCode;

        if (statusCode !== DisconnectReason.loggedOut) {
          console.log("🔄 WhatsApp reconnecting...");
          setTimeout(() => initWhatsApp(), 5000);
        } else {
          console.log("❌ WhatsApp logged out. Scan QR ulang.");
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    isConnecting = false;
    console.error("❌ Init WhatsApp error:", err);
    setTimeout(initWhatsApp, 5000);
  }
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
      await sock.logout();
      sock = null;
    }

    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }

    isReady = false;
    isConnecting = false;

    setTimeout(initWhatsApp, 2000);
  } catch (err) {
    console.error("❌ Reset WA error:", err);
  }
}
