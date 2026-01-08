import express from "express";
import pool from "../../db.js";

const router = express.Router();

/* ======================================================
   🔹 HELPER : CEK TANGGAL LEWAT (TAMBAHAN)
====================================================== */
function isPastDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const input = new Date(dateStr);
  input.setHours(0, 0, 0, 0);

  return input < today;
}

/* ======================================================
   HELPER : CEK BENTROK SESI / JAM
====================================================== */
async function cekBentrok({
  ruangan_id,
  tanggal_pinjam,
  sesi,
  jam_mulai,
  jam_selesai,
  excludeId = null,
}) {
  const statusFilter = "(status IS NULL OR status != 'DITOLAK')";

  // ===== MODE SESI =====
  if (sesi) {
    const { rowCount } = await pool.query(
      `
      SELECT 1 FROM peminjaman_ruangan
      WHERE ruangan_id = $1
        AND tanggal_pinjam = $2
        AND (
          sesi = $3
          OR sesi = 'Sesi 1 & 2 (Full)'
          OR ($3 = 'Sesi 1 & 2 (Full)' AND sesi IN (
            'Sesi 1 (09:00 - 12:00)',
            'Sesi 2 (13:00 - 16:00)'
          ))
        )
        AND ${statusFilter}
        ${excludeId ? "AND id != $4" : ""}
      `,
      excludeId
        ? [ruangan_id, tanggal_pinjam, sesi, excludeId]
        : [ruangan_id, tanggal_pinjam, sesi]
    );

    if (rowCount) return "Sesi sudah dibooking atau sedang diajukan";
  }

  // ===== MODE JAM (RPTRA) =====
  if (jam_mulai && jam_selesai) {
    const { rowCount } = await pool.query(
      `
      SELECT 1 FROM peminjaman_ruangan
      WHERE ruangan_id = $1
        AND tanggal_pinjam = $2
        AND ${statusFilter}
        AND ($3 < jam_selesai AND $4 > jam_mulai)
        ${excludeId ? "AND id != $5" : ""}
      `,
      excludeId
        ? [ruangan_id, tanggal_pinjam, jam_mulai, jam_selesai, excludeId]
        : [ruangan_id, tanggal_pinjam, jam_mulai, jam_selesai]
    );

    if (rowCount) return "Jam bentrok dengan peminjaman lain";
  }

  return null;
}

/* ======================================================
   GET SEMUA PEMINJAMAN
====================================================== */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pr.*, r.nama AS ruangan_name, r.tipe AS ruangan_tipe
      FROM peminjaman_ruangan pr
      JOIN ruangan r ON r.id = pr.ruangan_id
      ORDER BY pr.tanggal_pinjam DESC, pr.jam_mulai ASC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   CEK SESI / JAM YANG SUDAH DIPESAN (UNTUK FE)
====================================================== */
router.get("/cek", async (req, res) => {
  try {
    const { ruangan_id, tanggal_pinjam } = req.query;

    if (!ruangan_id || !tanggal_pinjam) {
      return res
        .status(400)
        .json({ error: "ruangan_id & tanggal_pinjam wajib" });
    }

    const { rows } = await pool.query(
      `
      SELECT sesi, jam_mulai, jam_selesai
      FROM peminjaman_ruangan
      WHERE ruangan_id = $1
        AND tanggal_pinjam = $2
        AND (status IS NULL OR status != 'DITOLAK')
      `,
      [ruangan_id, tanggal_pinjam]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   POST : TAMBAH PEMINJAMAN
====================================================== */
router.post("/", async (req, res) => {
  try {
    const {
      tanggal,
      tanggal_pinjam,
      ruangan_id,
      sesi,
      jam_mulai,
      jam_selesai,
      nama_peminjam,
      jabatan,
      nik,
      alamat,
      no_telepon,
      barang,
      keperluan,
    } = req.body;

    // 🔹 VALIDASI TANGGAL LEWAT (TAMBAHAN)
    if (isPastDate(tanggal_pinjam)) {
      return res.status(400).json({
        error: "Tidak bisa menambah peminjaman untuk tanggal yang sudah lewat",
      });
    }

    // ===== VALIDASI DASAR =====
    if (!nik || nik.length !== 16 || isNaN(nik)) {
      return res.status(400).json({ error: "NIK harus 16 digit angka" });
    }

    // ===== NORMALISASI SESI / JAM =====
    let finalSesi = sesi || null;
    let finalMulai = jam_mulai || null;
    let finalSelesai = jam_selesai || null;

    if (finalSesi) {
      finalMulai = null;
      finalSelesai = null;
    }

    if (finalMulai && finalSelesai) {
      finalSesi = null;
    }

    // ===== CEK BENTROK =====
    const bentrok = await cekBentrok({
      ruangan_id,
      tanggal_pinjam,
      sesi: finalSesi,
      jam_mulai: finalMulai,
      jam_selesai: finalSelesai,
    });

    if (bentrok) {
      return res.status(409).json({ error: bentrok });
    }

    // ===== INSERT =====
    const { rows } = await pool.query(
      `
      INSERT INTO peminjaman_ruangan
      (
        tanggal,
        tanggal_pinjam,
        ruangan_id,
        sesi,
        jam_mulai,
        jam_selesai,
        nama_peminjam,
        jabatan,
        nik,
        alamat,
        no_telepon,
        barang,
        keperluan
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
      `,
      [
        tanggal,
        tanggal_pinjam,
        ruangan_id,
        finalSesi,
        finalMulai,
        finalSelesai,
        nama_peminjam,
        jabatan || null,
        nik,
        alamat || null,
        no_telepon || null,
        barang || null,
        keperluan || null,
      ]
    );

    res.status(201).json({
      message: "Peminjaman berhasil ditambahkan",
      data: rows[0],
    });
  } catch (err) {
    console.error("POST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   PUT : EDIT PEMINJAMAN
====================================================== */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tanggal,
      tanggal_pinjam,
      ruangan_id,
      sesi,
      jam_mulai,
      jam_selesai,
      nama_peminjam,
      jabatan,
      nik,
      alamat,
      no_telepon,
      barang,
      keperluan,
    } = req.body;

    // 🔹 VALIDASI TANGGAL LEWAT (TAMBAHAN)
    if (isPastDate(tanggal_pinjam)) {
      return res.status(400).json({
        error: "Tidak bisa mengubah peminjaman ke tanggal yang sudah lewat",
      });
    }

    // ===== VALIDASI =====
    if (!nik || nik.length !== 16 || isNaN(nik)) {
      return res.status(400).json({ error: "NIK harus 16 digit angka" });
    }

    // ===== NORMALISASI SESI / JAM =====
    let finalSesi = sesi || null;
    let finalMulai = jam_mulai || null;
    let finalSelesai = jam_selesai || null;

    if (finalSesi) {
      finalMulai = null;
      finalSelesai = null;
    }

    if (finalMulai && finalSelesai) {
      finalSesi = null;
    }

    // ===== CEK BENTROK (EXCLUDE DIRI SENDIRI) =====
    const bentrok = await cekBentrok({
      ruangan_id,
      tanggal_pinjam,
      sesi: finalSesi,
      jam_mulai: finalMulai,
      jam_selesai: finalSelesai,
      excludeId: id,
    });

    if (bentrok) {
      return res.status(409).json({ error: bentrok });
    }

    // ===== UPDATE =====
    const { rows, rowCount } = await pool.query(
      `
      UPDATE peminjaman_ruangan
      SET
        tanggal = $1,
        tanggal_pinjam = $2,
        ruangan_id = $3,
        sesi = $4,
        jam_mulai = $5,
        jam_selesai = $6,
        nama_peminjam = $7,
        jabatan = $8,
        nik = $9,
        alamat = $10,
        no_telepon = $11,
        barang = $12,
        keperluan = $13
      WHERE id = $14
      RETURNING *
      `,
      [
        tanggal,
        tanggal_pinjam,
        ruangan_id,
        finalSesi,
        finalMulai,
        finalSelesai,
        nama_peminjam,
        jabatan || null,
        nik,
        alamat || null,
        no_telepon || null,
        barang || null,
        keperluan || null,
        id,
      ]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Data tidak ditemukan" });
    }

    res.json({
      message: "Data berhasil diperbarui",
      data: rows[0],
    });
  } catch (err) {
    console.error("PUT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   DELETE
====================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM peminjaman_ruangan WHERE id = $1",
      [req.params.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Data tidak ditemukan" });
    }

    res.json({ message: "Data berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
