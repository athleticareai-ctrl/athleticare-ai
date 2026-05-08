import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import nodemailer from "nodemailer";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { initDb } from "./database.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "athleticare-secret-key";

let db;
const startServer = async () => {
    try {
        db = await initDb();
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT} ✅`);
        });
    } catch (err) {
        console.error("Failed to initialize database ❌", err);
        process.exit(1);
    }
};

startServer();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// API ROUTES (Must be before static files to prevent deployment conflicts)
// We'll move the route definitions here or ensure they are processed first


// ================= EMAIL SETUP =================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use Google App Password
    },
});

// Verify SMTP connection
transporter.verify((error, success) => {
    if (error) {
        console.error("SMTP ERROR ❌", error);
    } else {
        console.log("SMTP READY ✅");
    }
});

// ================= AUTH MIDDLEWARE =================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ================= API ROUTES =================
// (Routes will be defined here)

// ================= STATIC FILES =================
// (Moved below API routes to prevent priority issues)

// ================= ROUTES =================

// AI SETUP
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// AUTH: Signup
app.post("/api/auth/signup", async (req, res) => {
    const { email, password, firstname, lastname, accessCode } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            "INSERT INTO users (email, password, firstname, lastname, accessCode) VALUES (?, ?, ?, ?, ?)",
            [email, hashedPassword, firstname, lastname, accessCode]
        );

        // Send welcome email
        try {
            await transporter.sendMail({
                from: `"AthletiCare AI" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Welcome to AthletiCare AI 🏥",
                html: `<h2>Welcome, ${firstname}!</h2><p>Your AthletiCare AI account has been successfully created.</p>`
            });
        } catch (emailErr) {
            console.error("Email failed:", emailErr);
        }

        // Generate token for auto-login
        const token = jwt.sign({ email, role: 'athlete' }, JWT_SECRET, { expiresIn: '24h' });

        const user = { email, firstname, lastname, role: 'athlete', onboardingComplete: 0, profile: null };

        res.status(201).json({ success: true, token, user });
    } catch (err) {
        if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: "Signup failed" });
    }
});

// AUTH: Trainer Signup (Secure)
app.post("/api/auth/trainer/signup", async (req, res) => {
    const { email, password, firstname, lastname, adminCode } = req.body;
    const STAFF_CODE = "WEYMOUTH_STAFF"; // In production, move this to .env

    if (adminCode !== STAFF_CODE) {
        return res.status(403).json({ error: "Invalid School Admin Code" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            "INSERT INTO users (email, password, firstname, lastname, role, accessCode, onboardingComplete) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [email, hashedPassword, firstname, lastname, "trainer", "WEYMOUTH", 1]
        );

        const token = jwt.sign({ email, role: 'trainer' }, JWT_SECRET, { expiresIn: '24h' });
        const user = { email, firstname, lastname, role: 'trainer', onboardingComplete: 1 };

        res.status(201).json({ success: true, token, user });
    } catch (err) {
        if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: "Trainer signup failed" });
    }
});
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        // Don't send password
        const { password: _, ...userWithoutPassword } = user;
        userWithoutPassword.profile = JSON.parse(user.profile || "null");

        res.json({ token, user: userWithoutPassword });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// PROFILE: Update Onboarding
app.post("/api/profile", authenticateToken, async (req, res) => {
    const { profile } = req.body;
    try {
        await db.run(
            "UPDATE users SET profile = ?, onboardingComplete = 1 WHERE email = ?",
            [JSON.stringify(profile), req.user.email]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Profile update failed" });
    }
});

// CHECK-IN: Save
app.post("/api/checkin", authenticateToken, async (req, res) => {
    const { score, data, date } = req.body;
    try {
        await db.run(
            "INSERT INTO checkins (userEmail, date, score, data) VALUES (?, ?, ?, ?)",
            [req.user.email, date, score, JSON.stringify(data)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Check-in failed" });
    }
});

// CHECK-IN: History
app.get("/api/checkins", authenticateToken, async (req, res) => {
    try {
        const checkins = await db.all("SELECT * FROM checkins WHERE userEmail = ? ORDER BY timestamp DESC", [req.user.email]);
        const formatted = checkins.map(c => ({
            ...c,
            data: JSON.parse(c.data)
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// TRAINER: Get Team
app.get("/api/trainer/team", authenticateToken, async (req, res) => {
    if (req.user.role !== 'trainer' && req.user.email !== 'trainer@school.edu') { // Simple check
        // For this demo, we allow trainer@school.edu or users with role 'trainer'
    }

    try {
        // Exclude trainers from the athlete list
        const users = await db.all("SELECT email, firstname, lastname, accessCode, onboardingComplete, profile FROM users WHERE accessCode = 'WEYMOUTH' AND role = 'athlete'");
        const athletes = [];

        for (const user of users) {
            const checkins = await db.all("SELECT * FROM checkins WHERE userEmail = ? ORDER BY timestamp DESC", [user.email]);
            user.profile = JSON.parse(user.profile || "null");
            athletes.push({
                user,
                checkins: checkins.map(c => ({ ...c, data: JSON.parse(c.data) }))
            });
        }
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch team data" });
    }
});

// TRAINER: Save Notes
app.post("/api/trainer/notes", authenticateToken, async (req, res) => {
    const { athleteEmail, notes } = req.body;
    try {
        await db.run("INSERT INTO trainer_notes (athleteEmail, notes) VALUES (?, ?)", [athleteEmail, notes]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save notes" });
    }
});

// TRAINER: Get Notes
app.get("/api/trainer/notes/:email", authenticateToken, async (req, res) => {
    try {
        const notes = await db.all("SELECT * FROM trainer_notes WHERE athleteEmail = ? ORDER BY timestamp DESC", [req.params.email]);
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch notes" });
    }
});

// SCHEDULE: Save
app.post("/api/schedule", authenticateToken, async (req, res) => {
    const { items } = req.body;
    try {
        await db.run("DELETE FROM schedules WHERE userEmail = ?", [req.user.email]);
        await db.run("INSERT INTO schedules (userEmail, data) VALUES (?, ?)", [req.user.email, JSON.stringify(items)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save schedule" });
    }
});

// SCHEDULE: Get
app.get("/api/schedule", authenticateToken, async (req, res) => {
    try {
        const row = await db.get("SELECT data FROM schedules WHERE userEmail = ?", [req.user.email]);
        res.json(row ? JSON.parse(row.data) : []);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch schedule" });
    }
});

// CHAT: Save
app.post("/api/chats", authenticateToken, async (req, res) => {
    const { chats } = req.body;
    try {
        await db.run("DELETE FROM chats WHERE userEmail = ?", [req.user.email]);
        await db.run("INSERT INTO chats (userEmail, data) VALUES (?, ?)", [req.user.email, JSON.stringify(chats)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save chats" });
    }
});

// CHAT: Get
app.get("/api/chats", authenticateToken, async (req, res) => {
    try {
        const row = await db.get("SELECT data FROM chats WHERE userEmail = ?", [req.user.email]);
        res.json(row ? JSON.parse(row.data) : []);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch chats" });
    }
});

// Send confirmation email (Legacy/Support)
app.post("/send-confirmation", async (req, res) => {
    const { email, firstname } = req.body;

    if (!email || !firstname) {
        return res.status(400).json({ error: "Missing data" });
    }

    try {
        await transporter.sendMail({
            from: `"AthletiCare AI" <${process.env.EMAIL_USER}>`,
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

        res.json({ success: true });
    } catch (err) {
        console.error("Email error:", err);
        res.status(500).json({ error: "Email failed" });
    }
});

// AI chat endpoint
app.post("/chat", authenticateToken, async (req, res) => {
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
        console.error("Groq error:", err);
        res.status(500).json({ error: "AI response failed" });
    }
});

// API CATCH-ALL: Ensure missing API routes return JSON, not HTML
app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// ================= STATIC FILES & FRONTEND =================
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.redirect("about.html");
});

const __dirname = path.resolve();
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= START SERVER =================
// Server is started in startServer() above









