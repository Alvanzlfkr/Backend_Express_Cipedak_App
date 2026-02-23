import pool from "../db.js";

// ================= GET ALL =================
export const getAllPenanganan = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM penanganan ORDER BY jabatan",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET BY ID =================
export const getPenangananById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("SELECT * FROM penanganan WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= CREATE =================
export const createPenanganan = async (req, res) => {
  try {
    const { nama, nip, jabatan } = req.body;

    if (!nama || !nip || !jabatan) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    if (!/^\d{5,25}$/.test(nip)) {
      return res.status(400).json({
        message: "NIP harus 5–25 digit angka",
      });
    }

    await pool.query(
      `INSERT INTO penanganan (nama, nip, jabatan)
       VALUES ($1, $2, $3)`,
      [nama, nip, jabatan],
    );

    res.status(201).json({ message: "Data berhasil ditambahkan" });
  } catch (error) {
    console.error("POSTGRES ERROR:", error);

    // UNIQUE jabatan
    if (error.code === "23505") {
      return res.status(400).json({
        message: "Jabatan tersebut sudah terisi",
      });
    }

    res.status(500).json({ message: "Gagal menyimpan data" });
  }
};

// ================= UPDATE =================
export const updatePenanganan = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, nip } = req.body;

    if (!nama || !nip) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    if (!/^\d{5,25}$/.test(nip)) {
      return res.status(400).json({
        message: "NIP harus 5–25 digit angka",
      });
    }

    await pool.query(
      `UPDATE penanganan
       SET nama = $1, nip = $2
       WHERE id = $3`,
      [nama, nip, id],
    );

    res.json({ message: "Data berhasil diperbarui" });
  } catch (error) {
    console.error("UPDATE ERROR:", error);

    res.status(500).json({ message: "Gagal update data" });
  }
};
