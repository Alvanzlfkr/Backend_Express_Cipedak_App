import express from "express";
import pool from "../../db.js";
import bcrypt from "bcrypt";
import { validatePassword } from "../../utils/password.js";
import { sendOTP } from "../../utils/email.js";

const router = express.Router();

// ==================== SEND OTP ====================
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    // cek apakah email ada di admin
    const admin = await pool.query("SELECT * FROM admin WHERE email=$1", [
      email,
    ]);
    if (admin.rows.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "Email tidak terdaftar" });

    // generate OTP 6 digit
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // simpan ke DB dengan expire 5 menit
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit
    await pool.query(
      `INSERT INTO password_reset_otp (email, otp, expire_at)
       VALUES ($1, $2, $3)`,
      [email, otp, expireAt]
    );

    // kirim OTP via email
    await sendOTP(email, otp);

    res.json({ success: true, message: "OTP dikirim ke email!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==================== VERIFY OTP ====================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const record = await pool.query(
      `SELECT * FROM password_reset_otp
       WHERE email=$1 AND otp=$2
       ORDER BY created_at DESC LIMIT 1`,
      [email, otp]
    );

    if (record.rows.length === 0)
      return res.json({ success: false, message: "OTP salah" });

    const otpData = record.rows[0];
    if (new Date() > otpData.expire_at) {
      // hapus OTP expired
      await pool.query("DELETE FROM password_reset_otp WHERE id=$1", [
        otpData.id,
      ]);
      return res.json({ success: false, message: "OTP kadaluarsa" });
    }

    // OTP valid → bisa reset password
    res.json({ success: true, message: "OTP valid" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==================== RESET PASSWORD ====================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!validatePassword(newPassword))
      return res.status(400).json({
        success: false,
        message:
          "Password harus kuat (min 8 karakter, huruf besar, kecil, angka & simbol)",
      });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE admin SET password=$1 WHERE email=$2", [
      hashed,
      email,
    ]);

    // hapus semua OTP terkait email
    await pool.query("DELETE FROM password_reset_otp WHERE email=$1", [email]);

    res.json({ success: true, message: "Password berhasil direset!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
