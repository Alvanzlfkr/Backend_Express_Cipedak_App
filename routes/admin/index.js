import express from "express";
import pool from "../../db.js"; // ⬅️ WAJIB
import authRoutes from "./auth.js";
import passwordRoutes from "./password.js";

const router = express.Router();

// =======================
// AUTH (REGISTER & LOGIN)
// =======================
router.use("/auth", authRoutes);

// =======================
// PASSWORD (OTP & RESET)
// =======================
router.use("/password", passwordRoutes);

// =======================
// CHECK ADMIN EXISTS
// =======================
router.get("/check", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM admin");
    res.json({ exists: Number(result.rows[0].count) > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ exists: false });
  }
});

export default router;
