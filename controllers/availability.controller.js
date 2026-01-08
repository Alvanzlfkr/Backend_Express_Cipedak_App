import express from "express";
import dayjs from "dayjs";

const router = express.Router();

/* ===============================
   DATA RUANGAN (CONTOH)
================================ */
const roomsData = [
  { id: 1, nama: "RPTRA Cipedak Gemilang", jenis: "rptra" },
  { id: 2, nama: "RPTRA Cinta Aselih", jenis: "rptra" },
  { id: 3, nama: "RPTRA Cendekia", jenis: "rptra" },
  { id: 4, nama: "Ruang Rapat Lantai 1", jenis: "rapat" },
  { id: 5, nama: "Ruang Rapat Lantai 3", jenis: "rapat" },
  { id: 6, nama: "Halaman Kantor", jenis: "lainnya" },
];

/* ===============================
   HELPER FUNCTIONS
================================ */

// deteksi query spesifik
const isSpecificRoomQuery = (prompt) =>
  /rptra\s+\w+|ruang\s+rapat\s*(lantai)?\s*\d|rapat\s*\d|halaman\s*kanto?r/i.test(
    prompt
  );

// ambil nomor lantai
const extractRoomNumber = (prompt) => {
  const match = prompt.match(/(lantai|rapat|ruang)\s*(\d+)/i);
  return match ? match[2] : null;
};

// deteksi jenis ruangan
const detectRoomType = (prompt) => {
  if (/rptra/i.test(prompt)) return "rptra";
  if (/rapat/i.test(prompt)) return "rapat";
  if (/halaman/i.test(prompt)) return "lainnya";
  return null;
};

/* ===============================
   ROUTE
================================ */
router.post("/availability", async (req, res) => {
  try {
    const { prompt, date } = req.body;
    const selectedDate = date
      ? dayjs(date).format("YYYY-MM-DD")
      : dayjs().add(1, "day").format("YYYY-MM-DD");

    let rooms = [...roomsData];

    /* ===============================
       FILTER BERDASARKAN JENIS
    ================================ */
    const roomType = detectRoomType(prompt);
    if (roomType) {
      rooms = rooms.filter((r) => r.jenis === roomType);
    }

    /* ===============================
       FILTER NOMOR RUANG RAPAT
    ================================ */
    const roomNumber = extractRoomNumber(prompt);
    if (roomNumber) {
      rooms = rooms.filter((r) =>
        r.nama.toLowerCase().includes(`lantai ${roomNumber}`)
      );
    }

    /* ===============================
       SIMULASI AVAILABILITY
    ================================ */
    const resultRooms = rooms.map((r) => ({
      ...r,
      status: "Tersedia",
      sesi: ["Sesi 1", "Sesi 2"],
    }));

    /* ===============================
       RESPONSE TEXT
    ================================ */
    let aiText = "";

    if (resultRooms.length === 0) {
      aiText = "Ruangan yang Anda cari tidak ditemukan.";
    } else if (isSpecificRoomQuery(prompt)) {
      const r = resultRooms[0];
      aiText = `${r.nama} tersedia pada ${r.sesi.join(
        " dan "
      )} tanggal ${selectedDate}.`;
    } else {
      aiText = `Berikut daftar ruangan yang tersedia tanggal ${selectedDate}:`;
    }

    /* ===============================
       KIRIM RESPONSE
    ================================ */
    res.json({
      success: true,
      aiText,
      rooms: isSpecificRoomQuery(prompt) ? [] : resultRooms,
      date: selectedDate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
});

export default router;
