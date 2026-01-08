import express from "express";
import pool from "../../db.js";

const router = express.Router();

// GET /api/ruangan/tersedia
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.id, r.nama, r.tipe
      FROM ruangan r
      LEFT JOIN peminjaman_ruangan p
        ON r.id = p.ruangan_id
       AND p.tanggal_pinjam = CURRENT_DATE
       AND p.status = 'DISETUJUI'
      WHERE p.id IS NULL -- tidak ada peminjaman hari ini
      ORDER BY r.nama
    `);

    res.json({ rooms: rows });
  } catch (err) {
    console.error("❌ Error fetch ruangan tersedia:", err);
    res.status(500).json({ error: "Gagal ambil data ruangan tersedia" });
  }
});

export default router;
