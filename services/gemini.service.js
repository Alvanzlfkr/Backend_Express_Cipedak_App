import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// rooms = [{nama, jam}, ...]
export const generateGeminiResponse = async (prompt, rooms) => {
  try {
    const roomList = rooms.map((r) => `✔ ${r.nama} — ${r.jam}`).join("\n");

    const finalPrompt = `
Admin bertanya: "${prompt}"
Berikut daftar ruangan yang tersedia:
${roomList}
Jawab singkat sesuai data yang ada, jangan buat data baru.
`;

    const response = await client.chat.completions.create({
      model: "gemini-1",
      messages: [{ role: "user", content: finalPrompt }],
      temperature: 0.3,
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error(err);
    return "AI tidak bisa menjawab sekarang.";
  }
};
