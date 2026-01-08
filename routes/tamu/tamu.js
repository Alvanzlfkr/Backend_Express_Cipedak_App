import express from "express";
import pool from "../../db.js";

const routerTamu = express.Router();

// =======================
// Helper: format nama (Alvan bukan ALVAN)
// =======================
const formatNama = (nama) =>
  nama
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

// =======================
// Helper: validasi no telepon 08
// =======================
const isValidPhone = (phone) => /^08[0-9]{8,11}$/.test(phone);

// =======================
// GET semua tamu
// =======================
routerTamu.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tamu ORDER BY tanggal ASC, no ASC"
    );

    // mapping backend -> frontend
    const data = result.rows.map((row) => ({
      ...row,
      noTelepon: row.no_telepon,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// GET tamu by ID
// =======================
routerTamu.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tamu WHERE id = $1", [
      req.params.id,
    ]);

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Tamu tidak ditemukan" });

    const tamu = {
      ...result.rows[0],
      noTelepon: result.rows[0].no_telepon,
    };

    res.json(tamu);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// POST tamu baru
// =======================
routerTamu.post("/", async (req, res) => {
  try {
    const { tanggal, nama, alamat, noTelepon, keperluan } = req.body;

    if (!isValidPhone(noTelepon)) {
      return res
        .status(400)
        .json({ message: "Nomor telepon harus diawali 08" });
    }

    const namaFix = formatNama(nama);

    const { rows } = await pool.query(
      "SELECT COUNT(*) FROM tamu WHERE tanggal = $1",
      [tanggal]
    );
    const no = parseInt(rows[0].count, 10) + 1;

    const result = await pool.query(
      `INSERT INTO tamu (no, tanggal, nama, alamat, no_telepon, keperluan)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [no, tanggal, namaFix, alamat, noTelepon, keperluan]
    );

    res.json({
      message: "Tamu berhasil ditambahkan",
      data: {
        ...result.rows[0],
        noTelepon: result.rows[0].no_telepon,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// PUT / UPDATE tamu
// =======================
routerTamu.put("/:id", async (req, res) => {
  try {
    const { tanggal, nama, alamat, noTelepon, keperluan } = req.body;

    if (!isValidPhone(noTelepon)) {
      return res
        .status(400)
        .json({ message: "Nomor telepon harus diawali 08" });
    }

    const namaFix = formatNama(nama);

    const result = await pool.query(
      `UPDATE tamu
       SET tanggal = $1,
           nama = $2,
           alamat = $3,
           no_telepon = $4,
           keperluan = $5
       WHERE id = $6
       RETURNING *`,
      [tanggal, namaFix, alamat, noTelepon, keperluan, req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Tamu tidak ditemukan" });

    res.json({
      message: "Data tamu berhasil diperbarui",
      data: {
        ...result.rows[0],
        noTelepon: result.rows[0].no_telepon,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// DELETE tamu by ID
// =======================
routerTamu.delete("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT tanggal FROM tamu WHERE id = $1",
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Tamu tidak ditemukan" });

    const tanggal = rows[0].tanggal;

    await pool.query("DELETE FROM tamu WHERE id = $1", [req.params.id]);
    await reorderTamuByDate(tanggal);

    res.json({ message: "Tamu berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// Helper: urutkan ulang nomor per tanggal
// =======================
const reorderTamuByDate = async (tanggal) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM tamu WHERE tanggal = $1 ORDER BY id ASC",
      [tanggal]
    );

    for (let i = 0; i < rows.length; i++) {
      await pool.query("UPDATE tamu SET no = $1 WHERE id = $2", [
        i + 1,
        rows[i].id,
      ]);
    }
  } catch (err) {
    console.error("Gagal mengurutkan nomor:", err.message);
  }
};

export default routerTamu;
