import express from "express";
import pool from "../../db.js";

const router = express.Router();

// GET /api/ruangan → semua ruangan
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, nama, tipe FROM ruangan ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ruangan/tersedia → ruangan hari ini yang tersedia
router.get("/tersedia", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.id AS ruangan_id, r.nama AS ruangan_name
      FROM ruangan r
      LEFT JOIN peminjaman_ruangan p
        ON r.id = p.ruangan_id
       AND p.tanggal_pinjam = CURRENT_DATE
       AND p.status = 'DISETUJUI'
      WHERE p.id IS NULL
      ORDER BY r.nama
    `);

    const availableRooms = rows.map((r) => ({
      nama: r.ruangan_name,
      jam: "Tersedia",
    }));

    res.json(availableRooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
