import express from "express";
import pool from "../../db.js";

const router = express.Router();

/**
 * GET /api/ruangan
 * ?mode=kelurahan
 * ?mode=rptra&kode=CIPEDAK
 */
router.get("/", async (req, res) => {
  try {
    const { mode, kode } = req.query;

    let sql = `
      SELECT id, nama, tipe, kode
      FROM ruangan
      WHERE 1=1
    `;
    const params = [];

    if (mode === "rptra" && kode) {
      sql += ` AND tipe = 'RPTRA' AND kode = $1`;
      params.push(kode);
    }

    if (mode === "kelurahan") {
      sql += ` AND tipe = 'KANTOR'`;
    }

    sql += " ORDER BY nama ASC";

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ GET ruangan error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ruangan/tersedia
 */
router.get("/tersedia", async (req, res) => {
  try {
    const { mode, kode } = req.query;

    let sql = `
      SELECT r.id, r.nama
      FROM ruangan r
      LEFT JOIN peminjaman_ruangan p
        ON r.id = p.ruangan_id
       AND p.tanggal_pinjam = CURRENT_DATE
       AND p.status = 'DISETUJUI'
      WHERE p.id IS NULL
    `;
    const params = [];

    if (mode === "rptra" && kode) {
      sql += ` AND r.tipe = 'RPTRA' AND r.kode = $1`;
      params.push(kode);
    }

    if (mode === "kelurahan") {
      sql += ` AND r.tipe = 'KANTOR'`;
    }

    sql += " ORDER BY r.nama";

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ GET ruangan tersedia error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
