import express from "express";
import pool from "../../db.js";
import fetch from "node-fetch";

const router = express.Router();

/**
 * Helper: cek overlap jam
 * true = bentrok
 */
const isOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

router.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt kosong" });
    }

    // =========================
    // 1. DETEKSI INTENT
    // =========================
    const isAskingRoom = /ruangan|ruang|rptra|tersedia|pinjam|jadwal/i.test(
      prompt
    );
    const isRuangRapat = /ruang rapat/i.test(prompt);
    const isRPTRA = /rptra/i.test(prompt);

    // jam (misal: 09:00 - 11:00)
    const jamMatch = prompt.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    const requestedJam = jamMatch
      ? { mulai: jamMatch[1], selesai: jamMatch[2] }
      : null;

    // =========================
    // 2. TENTUKAN TANGGAL
    // =========================
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const dates = [
      today.toISOString().slice(0, 10),
      tomorrow.toISOString().slice(0, 10),
    ];

    // =========================
    // 3. AMBIL DATA RUANGAN
    // =========================
    const { rows } = await pool.query(
      `
      SELECT 
        r.id,
        r.nama,
        p.tanggal_pinjam,
        p.jam_mulai,
        p.jam_selesai
      FROM ruangan r
      LEFT JOIN peminjaman_ruangan p
        ON r.id = p.ruangan_id
       AND p.tanggal_pinjam IN ($1, $2)
       AND p.status = 'DISETUJUI'
      ORDER BY r.nama
    `,
      dates
    );

    // =========================
    // 4. KELOMPOKKAN DATA
    // =========================
    let roomsMap = {};

    rows.forEach((r) => {
      if (!roomsMap[r.id]) {
        roomsMap[r.id] = {
          id: r.id,
          nama: r.nama,
          bookings: [],
        };
      }

      if (r.jam_mulai && r.jam_selesai) {
        roomsMap[r.id].bookings.push({
          tanggal: r.tanggal_pinjam,
          mulai: r.jam_mulai,
          selesai: r.jam_selesai,
        });
      }
    });

    let rooms = Object.values(roomsMap);

    // =========================
    // 5. FILTER JENIS RUANGAN
    // =========================
    if (isRuangRapat) {
      rooms = rooms.filter((r) => r.nama.toLowerCase().includes("ruang rapat"));
    }

    if (isRPTRA) {
      rooms = rooms.filter((r) => r.nama.toLowerCase().includes("rptra"));
    }

    // =========================
    // 6. CEK KETERSEDIAAN & OVERLAP JAM
    // =========================
    const finalRooms = rooms.map((r) => {
      let tersediaHariIni = true;
      let tersediaBesok = true;

      r.bookings.forEach((b) => {
        if (requestedJam) {
          if (
            isOverlap(
              requestedJam.mulai,
              requestedJam.selesai,
              b.mulai,
              b.selesai
            )
          ) {
            if (b.tanggal === dates[0]) tersediaHariIni = false;
            if (b.tanggal === dates[1]) tersediaBesok = false;
          }
        } else {
          if (b.tanggal === dates[0]) tersediaHariIni = false;
          if (b.tanggal === dates[1]) tersediaBesok = false;
        }
      });

      return {
        id: r.id,
        nama: r.nama,
        hari_ini: tersediaHariIni,
        besok: tersediaBesok,
      };
    });

    // =========================
    // 7. BENTUK TEKS NATURAL
    // =========================
    let roomText = "";

    finalRooms.forEach((r) => {
      roomText += `• ${r.nama}\n`;
      roomText += `  - Hari ini: ${
        r.hari_ini ? "Tersedia" : "Tidak tersedia"
      }\n`;
      roomText += `  - Besok: ${r.besok ? "Tersedia" : "Tidak tersedia"}\n\n`;
    });

    if (!roomText) {
      roomText = "Tidak ada ruangan yang sesuai dengan permintaan.";
    }

    const fullPrompt = isAskingRoom
      ? `
Kamu adalah asisten digital Kelurahan Cipedak.
Jawablah dengan bahasa Indonesia yang ramah dan natural.

Data ketersediaan ruangan:
${roomText}

Pertanyaan user:
"${prompt}"

Berikan jawaban singkat, jelas, dan mudah dipahami.
`
      : `
Kamu adalah asisten digital Kelurahan Cipedak.
User berkata:
"${prompt}"

Jawablah dengan sopan dan ramah.
`;

    // =========================
    // 8. PANGGIL GEMINI
    // =========================
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 500,
        },
      }),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      if (
        geminiRes.status === 429 ||
        geminiData.error?.status === "RESOURCE_EXHAUSTED"
      ) {
        return res.json({
          success: true,
          aiText:
            "⚠️ Maaf, quota AI harian sudah habis. Silakan coba lagi besok.",
          rooms: [],
          quotaLimit: true,
        });
      }

      throw new Error("Gemini error");
    }

    const aiText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf, saya belum bisa menjawab.";

    // =========================
    // 9. RESPONSE FINAL
    // =========================
    res.json({
      success: true,
      aiText: aiText.trim(),
      rooms: finalRooms,
      quotaLimit: false,
    });
  } catch (err) {
    console.error("❌ AI route error:", err);
    res.json({
      success: false,
      aiText: "Maaf, terjadi kesalahan pada sistem.",
      rooms: [],
      quotaLimit: false,
    });
  }
});

export default router;
