import express from "express";
import { resetWhatsApp } from "../services/whatsapp.service.js";

const router = express.Router();

/* WAJIB PROTECT (JWT / IP FILTER) */
router.post("/wa/reset", async (req, res) => {
  await resetWhatsApp();
  res.json({
    success: true,
    message: "WhatsApp reset. Scan QR untuk nomor baru.",
  });
});

export default router;
