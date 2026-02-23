import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.js";
import { initWhatsApp } from "./services/whatsapp.service.js";
import {
  getWhatsAppStatus,
  resetWhatsApp,
} from "./services/whatsapp.service.js";
import aiRoutes from "./routes/ai/ai.js";

dotenv.config();

console.log("🚀 server.js START");

const app = express();

app.use(cors());
app.use(express.json());

console.log("📞 Initializing WhatsApp...");
initWhatsApp(); // ⬅️ SEKALI SAJA

// server.js
const DEV_SESSION_ID = Date.now().toString();

app.get("/api/dev-session", (req, res) => {
  res.json({ devSessionId: DEV_SESSION_ID });
});

app.get("/api/wa/status", (req, res) => {
  res.json(getWhatsAppStatus());
});

app.post("/api/wa/logout", async (req, res) => {
  await resetWhatsApp();
  res.json({ succes: true, message: "WhatsApp session reset" });
});

app.use("/api/ai", aiRoutes);
app.use("/api", routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});
