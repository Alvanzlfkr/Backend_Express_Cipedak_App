import pool from "../db.js";

export const cekNip = async (req, res) => {
  const { nip } = req.params;

  const result = await pool.query(
    "SELECT id, nama FROM pegawai WHERE nip = $1 AND status = true",
    [nip]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      message: "NIP tidak ditemukan atau tidak aktif",
    });
  }

  res.json(result.rows[0]);
};
