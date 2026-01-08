import express from "express";
import pool from "../../db.js";
import axios from "axios";

const router = express.Router();

/* ======================================================
   🔹 CONFIG WA (FONNTE)
====================================================== */
const WA_TOKEN = process.env.FONNTE_TOKEN;

/* ======================================================
   🔹 HELPER : CEK TANGGAL LEWAT
====================================================== */
function isPastDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const input = new Date(dateStr);
  input.setHours(0, 0, 0, 0);

  return input < today;
}

/* ======================================================
   HELPER : CEK BENTROK
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
   GET SEMUA DATA
====================================================== */
router.get("/", async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pr.*, r.nama AS ruangan_name
      FROM peminjaman_ruangan pr
      JOIN ruangan r ON r.id = pr.ruangan_id
      ORDER BY pr.tanggal_pinjam DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   POST TAMBAH PEMINJAMAN
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

    if (isPastDate(tanggal_pinjam)) {
      return res.status(400).json({
        error: "Tidak bisa menambah peminjaman untuk tanggal yang sudah lewat",
      });
    }

    const bentrok = await cekBentrok({
      ruangan_id,
      tanggal_pinjam,
      sesi,
      jam_mulai,
      jam_selesai,
    });

    if (bentrok) {
      return res.status(409).json({ error: bentrok });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO peminjaman_ruangan
      (tanggal, tanggal_pinjam, ruangan_id, sesi, jam_mulai, jam_selesai,
       nama_peminjam, jabatan, nik, alamat, no_telepon, barang, keperluan)
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
      `,
      [
        tanggal,
        tanggal_pinjam,
        ruangan_id,
        sesi || null,
        jam_mulai || null,
        jam_selesai || null,
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
      message: "Peminjaman berhasil diajukan",
      data: rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   PUT APPROVE / REJECT + WHATSAPP
====================================================== */
router.put("/:id/validasi", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_id } = req.body;

    if (!["DISETUJUI", "DITOLAK"].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    const { rows } = await pool.query(
      `
      SELECT pr.*, r.nama AS ruangan_name
      FROM peminjaman_ruangan pr
      JOIN ruangan r ON r.id = pr.ruangan_id
      WHERE pr.id = $1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Data tidak ditemukan" });
    }

    const d = rows[0];

    await pool.query(
      `
      UPDATE peminjaman_ruangan
      SET status=$1,
          validated_at=NOW(),
          validated_by=$2
      WHERE id=$3
      `,
      [status, admin_id || null, id]
    );

    /* ===================== WA ===================== */
    const pesan = `
Halo *${d.nama_peminjam}*

Peminjaman ruangan Anda:
🏢 Ruangan : ${d.ruangan_name}
📅 Tanggal : ${new Date(d.tanggal_pinjam).toLocaleDateString("id-ID")}
⏰ Waktu   : ${
      d.sesi || `${d.jam_mulai.slice(0, 5)} - ${d.jam_selesai.slice(0, 5)}`
    }

📌 Status : *${status}*

Terima kasih.
Kelurahan Cipedak
    `;

    if (WA_TOKEN && d.no_telepon) {
      await axios.post(
        "https://api.fonnte.com/send",
        {
          target: d.no_telepon,
          message: pesan,
        },
        {
          headers: { Authorization: WA_TOKEN },
        }
      );
    }

    res.json({
      message: `Peminjaman ${status}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   DELETE
====================================================== */
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM peminjaman_ruangan WHERE id=$1", [
      req.params.id,
    ]);
    res.json({ message: "Data dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
