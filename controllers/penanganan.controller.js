import pool from "../db.js";

// GET ALL
export const getAllPenanganan = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM penanganan ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil data" });
  }
};

// GET BY ID
export const getPenangananById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM penanganan WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Data tidak ditemukan" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Terjadi kesalahan" });
  }
};

// CREATE
export const createPenanganan = async (req, res) => {
  const { keterangan, jenis } = req.body;

  // VALIDASI BACKEND
  if (!keterangan || !jenis) {
    return res.status(400).json({
      message: "Keterangan dan jenis wajib diisi",
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO penanganan (keterangan, jenis)
       VALUES ($1, $2) RETURNING *`,
      [keterangan, jenis]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Gagal menambah data" });
  }
};

// UPDATE
export const updatePenanganan = async (req, res) => {
  const { id } = req.params;
  const { keterangan, jenis } = req.body;

  if (!keterangan || !jenis) {
    return res.status(400).json({
      message: "Keterangan dan jenis wajib diisi",
    });
  }

  try {
    const result = await db.query(
      `UPDATE penanganan
       SET keterangan = $1, jenis = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [keterangan, jenis, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Data tidak ditemukan" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Gagal update data" });
  }
};

// DELETE
export const deletePenanganan = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      "DELETE FROM penanganan WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Data tidak ditemukan" });

    res.json({ message: "Data berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: "Gagal menghapus data" });
  }
};
