import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import { validatePassword } from "../../utils/password.js";

const router = express.Router();

/* ======================================================
   REGISTER ADMIN (HANYA 1x)
====================================================== */
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Semua field wajib diisi" });
    }

    // cek apakah admin sudah ada
    const check = await pool.query("SELECT id FROM admin");
    if (check.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Admin sudah terdaftar" });
    }

    // validasi password
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password lemah (min 8 karakter, huruf besar, kecil, angka & simbol)",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO admin (username, email, password)
       VALUES ($1, $2, $3)`,
      [username, email, hashed]
    );

    res.json({ success: true, message: "Admin berhasil dibuat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ======================================================
   LOGIN (USERNAME ATAU EMAIL)
====================================================== */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Email / Username dan password wajib diisi" });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

    const result = await pool.query(
      isEmail
        ? "SELECT * FROM admin WHERE email = $1"
        : "SELECT * FROM admin WHERE username = $1",
      [identifier]
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Email / Username tidak ditemukan" });
    }

    const admin = result.rows[0];

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ message: "Password salah" });
    }

    await pool.query(
      `INSERT INTO admin_login_logs (admin_id, ip_address, user_agent)
       VALUES ($1, $2, $3)`,
      [
        admin.id,
        req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        req.headers["user-agent"],
      ]
    );

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   LOGOUT
====================================================== */
router.post("/logout", async (req, res) => {
  try {
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ message: "Admin ID tidak ada" });
    }

    await pool.query(
      `UPDATE admin_login_logs
       SET logout_time = NOW()
       WHERE admin_id = $1 AND logout_time IS NULL`,
      [adminId]
    );

    res.json({ success: true, message: "Logout berhasil" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
