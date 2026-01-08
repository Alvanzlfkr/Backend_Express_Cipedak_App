import express from "express";
import pool from "../../db.js";
import { sendWA } from "../../services/whatsapp.service.js";

const router = express.Router();

router.put("/:id/validasi", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["DISETUJUI", "DITOLAK"].includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    // Update status
    const result = await pool.query(
      `
      UPDATE peminjaman_ruangan
      SET status = $1,
          validated_at = NOW(),
          validated_by = 'admin'
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    // Ambil data peminjaman
    const { rows } = await pool.query(
      `
      SELECT 
        p.nama_peminjam,
        p.no_telepon,
        p.tanggal_pinjam,
        p.jam_mulai,
        p.jam_selesai,
        p.sesi,
        r.nama AS ruangan_name
      FROM peminjaman_ruangan p
      JOIN ruangan r ON r.id = p.ruangan_id
      WHERE p.id = $1
      `,
      [id]
    );

    if (rows.length > 0) {
      const p = rows[0];

      if (!/^08\d{8,11}$/.test(p.no_telepon)) {
        console.warn("⚠️ Nomor WA tidak valid:", p.no_telepon);
      } else {
        const tanggal = new Date(p.tanggal_pinjam).toLocaleDateString("id-ID");

        // 1️⃣ Tentukan info waktu
        let waktuLine = "";
        if (p.jam_mulai && p.jam_selesai) {
          const jamMulai = p.jam_mulai.slice(0, 5);
          const jamSelesai = p.jam_selesai.slice(0, 5);
          waktuLine = `Jam: ${jamMulai} - ${jamSelesai}\n`;
        } else if (p.sesi) {
          waktuLine = `Sesi: ${p.sesi}\n`;
        }

        // 2️⃣ Buat pesan WA
        let pesan = "";
        if (status === "DISETUJUI") {
          pesan = `
Halo ${p.nama_peminjam},

Peminjaman ruangan *${p.ruangan_name}*
Tanggal: ${tanggal}
${waktuLine}✅ *DISETUJUI*

Silakan menggunakan ruangan sesuai jadwal.
Terima kasih.

Kelurahan Cipedak
`;
        } else {
          pesan = `
Halo ${p.nama_peminjam},

Peminjaman ruangan *${p.ruangan_name}*
Tanggal: ${tanggal}
${waktuLine}❌ *DITOLAK*

Mohon maaf, peminjaman belum dapat kami setujui.
Silakan menghubungi pihak kelurahan.

Kelurahan Cipedak
`;
        }

        // Kirim WA
        try {
          await sendWA(p.no_telepon, pesan);
        } catch (err) {
          console.error("⚠️ Gagal kirim WA:", err.message);
        }
      }
    }

    res.json({
      message: `Peminjaman ${status}`,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("ERROR VALIDASI:", err);
    res.status(500).json({
      message: "Gagal validasi",
      error: err.message,
    });
  }
});

export default router;
