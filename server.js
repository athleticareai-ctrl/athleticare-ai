import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { Resend } from "resend";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ================= ESM __dirname FIX =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= STATIC FILES =================
app.use(express.static(path.join(__dirname, "public")));

// ================= EMAIL SETUP =================
const resend = new Resend(process.env.RESEND_API_KEY);

// ================= AI SETUP =================
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ================= ROUTES =================

// Send confirmation email
app.post("/send-confirmation", async (req, res) => {
  const { email, firstname } = req.body;

  if (!email || !firstname) {
    return res.status(400).json({ error: "Missing data" });
  }

  try {
    await resend.emails.send({
      from: "AthletiCare AI <onboarding@resend.dev>",
      to: email,
      subject: "Welcome to AthletiCare AI 🏥",
      html: `
        <h2>Welcome, ${firstname}!</h2>
        <p>Your AthletiCare AI account has been successfully created.</p>
        <p>You can now safely access injury guidance anytime.</p>
        <br/>
        <p><strong>Reminder:</strong> AthletiCare AI does not diagnose or replace a medical professional.</p>
        <br/>
        <p>— AthletiCare AI Team</p>
      `,
    });

    console.log("Confirmation email sent ✅");
    res.json({ success: true });
  } catch (err) {
    console.error("Resend Email Error ❌:", err);
    res.status(200).json({
      success: true,
      warning: "Account created, but email failed.",
    });
  }
});

// AI chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You are AthletiCare AI, a sports medicine assistant. Provide safe, non-diagnostic guidance. Always encourage seeing a licensed athletic trainer or medical professional for serious symptoms."
        },
        ...messages
      ],
      temperature: 0.4,
      max_tokens: 300
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error("Groq error ❌:", err);
    res.status(500).json({ error: "AI response failed" });
  }
});

// ================= SAFE FALLBACK =================
// Sends About page ONLY if route not found
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});






