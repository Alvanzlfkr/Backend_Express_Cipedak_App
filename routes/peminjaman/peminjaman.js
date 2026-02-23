import express from "express";
import pool from "../../db.js";
import dayjs from "dayjs";
import { sendWA } from "../../services/whatsapp.service.js";
const router = express.Router();

/* ======================================================
   HELPER : CEK TANGGAL LEWAT
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

  // MODE SESI
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
            'Sesi 1 (07:30 - 12:00)',
            'Sesi 2 (13:00 - 16:00)'
          ))
        )
        AND ${statusFilter}
        ${excludeId ? "AND id != $4" : ""}
      `,
      excludeId
        ? [ruangan_id, tanggal_pinjam, sesi, excludeId]
        : [ruangan_id, tanggal_pinjam, sesi],
    );

    if (rowCount) return "Sesi sudah dibooking";
  }

  // MODE JAM
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
        : [ruangan_id, tanggal_pinjam, jam_mulai, jam_selesai],
    );

    if (rowCount) return "Jam bentrok dengan peminjaman lain";
  }

  return null;
}

/* ======================================================
   GET SEMUA PEMINJAMAN
====================================================== */
router.get("/", async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pr.*, r.nama AS ruangan_name, r.tipe AS ruangan_tipe
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
   GET : CEK BOOKING (UNTUK FE)
====================================================== */
router.get("/cek", async (req, res) => {
  try {
    const { ruangan_id, tanggal_pinjam, exclude_id } = req.query;

    if (!ruangan_id || !tanggal_pinjam) {
      return res.json([]); // ⛑️ selalu array
    }

    const params = [ruangan_id, tanggal_pinjam];
    let excludeSql = "";

    if (exclude_id) {
      params.push(Number(exclude_id));
      excludeSql = `AND id != $3`;
    }

    const { rows } = await pool.query(
      `
      SELECT sesi, jam_mulai, jam_selesai
      FROM peminjaman_ruangan
      WHERE ruangan_id = $1
        AND tanggal_pinjam = $2
        AND (status IS NULL OR status != 'DITOLAK')
        ${excludeSql}
      `,
      params,
    );

    res.json(rows); // ✅ ARRAY
  } catch (err) {
    console.error("CEK ERROR:", err);
    res.json([]); // ⛑️ FE tidak boleh crash
  }
});

/* ======================================================
   GET PEMINJAMAN BY ID
====================================================== */
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT pr.*, r.nama AS ruangan_name, r.tipe AS ruangan_tipe
      FROM peminjaman_ruangan pr
      JOIN ruangan r ON r.id = pr.ruangan_id
      WHERE pr.id = $1
      `,
      [req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Data tidak ditemukan" });
    }

    res.json(rows[0]);
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
      tanggal_kembali_barang,
      keperluan,
    } = req.body;

    if (isPastDate(tanggal_pinjam)) {
      return res.status(400).json({
        error: "Tidak bisa meminjam di tanggal yang sudah lewat",
      });
    }

    if (!nik || nik.length !== 16 || isNaN(nik)) {
      return res.status(400).json({ error: "NIK harus 16 digit angka" });
    }

    const finalSesi = sesi || null;
    const finalMulai = finalSesi ? null : jam_mulai || null;
    const finalSelesai = finalSesi ? null : jam_selesai || null;

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

    const { rows } = await pool.query(
      `
      INSERT INTO peminjaman_ruangan
      (
        tanggal, tanggal_pinjam, ruangan_id,
        sesi, jam_mulai, jam_selesai,
        nama_peminjam, jabatan, nik,
        alamat, no_telepon, barang,
        tanggal_kembali_barang, keperluan
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
        tanggal_kembali_barang || null,
        keperluan || null,
      ],
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
   PUT : EDIT PEMINJAMAN
====================================================== */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (!body.tanggal_pinjam) {
      return res.status(400).json({
        error: "Tanggal pinjam wajib dikirim",
      });
    }

    const { rows: old } = await pool.query(
      "SELECT tanggal_pinjam FROM peminjaman_ruangan WHERE id = $1",
      [id],
    );

    if (!old.length) {
      return res.status(404).json({ error: "Data tidak ditemukan" });
    }

    if (
      !dayjs(old[0].tanggal_pinjam).isSame(dayjs(body.tanggal_pinjam), "day") &&
      isPastDate(body.tanggal_pinjam)
    ) {
      return res.status(400).json({
        error: "Tanggal pinjam tidak boleh tanggal lampau",
      });
    }

    const bentrok = await cekBentrok({
      ruangan_id: body.ruangan_id,
      tanggal_pinjam: body.tanggal_pinjam,
      sesi: body.sesi || null,
      jam_mulai: body.jam_mulai || null,
      jam_selesai: body.jam_selesai || null,
      excludeId: Number(id),
    });

    if (bentrok) {
      return res.status(409).json({ error: bentrok });
    }

    const { rows } = await pool.query(
      `
      UPDATE peminjaman_ruangan
      SET
        tanggal=$1,
        tanggal_pinjam=$2,
        ruangan_id=$3,
        sesi=$4,
        jam_mulai=$5,
        jam_selesai=$6,
        nama_peminjam=$7,
        jabatan=$8,
        nik=$9,
        alamat=$10,
        no_telepon=$11,
        barang=$12,
        tanggal_kembali_barang=$13,
        keperluan=$14
      WHERE id=$15
      RETURNING *
      `,
      [
        body.tanggal,
        body.tanggal_pinjam,
        body.ruangan_id,
        body.sesi || null,
        body.jam_mulai || null,
        body.jam_selesai || null,
        body.nama_peminjam,
        body.jabatan || null,
        body.nik,
        body.alamat || null,
        body.no_telepon || null,
        body.barang || null,
        body.tanggal_kembali_barang || null,
        body.keperluan || null,
        id,
      ],
    );

    res.json({ message: "Data berhasil diperbarui", data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   PUT : VALIDASI (APPROVE / REJECT + WA LENGKAP)
====================================================== */
router.put("/:id/validasi", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_id } = req.body;
    const statusEmoji = status === "DISETUJUI" ? "✅" : "❌";

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
      [id],
    );

    if (!rows.length)
      return res.status(404).json({ error: "Data tidak ditemukan" });

    const d = rows[0];

    await pool.query(
      `
      UPDATE peminjaman_ruangan
      SET status=$1,
          validated_at=NOW(),
          validated_by=$2
      WHERE id=$3
      `,
      [status, admin_id || null, id],
    );

    // ===================== WA =====================
    if (d.no_telepon) {
      const tanggalPinjamText = new Date(d.tanggal_pinjam).toLocaleDateString(
        "id-ID",
        {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        },
      );
      const waktuText = d.sesi
        ? d.sesi
        : `${d.jam_mulai?.slice(0, 5) || "-"} - ${d.jam_selesai?.slice(0, 5) || "-"}`;

      const pesan = `
Halo *${d.nama_peminjam}*

Peminjaman ruangan Anda:
🏢 Ruangan : ${d.ruangan_name}
📅 Tanggal : ${tanggalPinjamText}
⏰ Waktu   : ${waktuText}

Status : ${statusEmoji} *${status}*

Silahkan datang sesuai jadwal dengan membawa identitas diri (KTP/SIM) dan menunjukkan pesan ini kepada petugas kami.

Terima kasih.
Kelurahan Cipedak
`;

      try {
        await sendWA(d.no_telepon, pesan);
        console.log("✅ WA terkirim ke", d.no_telepon);
      } catch (err) {
        console.error("❌ Gagal kirim WA:", err.message);
      }
    }

    res.json({ message: `Peminjaman ${status}` });
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
    const { rowCount } = await pool.query(
      "DELETE FROM peminjaman_ruangan WHERE id=$1",
      [req.params.id],
    );

    if (!rowCount) {
      return res.status(404).json({ error: "Data tidak ditemukan" });
    }

    res.json({ message: "Data berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
