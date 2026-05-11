// AthletiCare AI Server - Updated: 2026-05-08T20:55:00
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import nodemailer from "nodemailer";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "athleticare-secret-key";

// ================= DATABASE SETUP =================
let db;
const dbPath = path.join(path.resolve(), 'athleticare.db');

async function initDb() {
    const database = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Users Table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            firstname TEXT NOT NULL,
            lastname TEXT,
            accessCode TEXT,
            onboardingComplete INTEGER DEFAULT 0,
            profile TEXT,
            role TEXT DEFAULT 'athlete'
        )
    `);

    // Check-ins Table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userEmail TEXT NOT NULL,
            date TEXT NOT NULL,
            score INTEGER NOT NULL,
            data TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userEmail) REFERENCES users(email)
        )
    `);

    // Trainer Notes Table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS trainer_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            athleteEmail TEXT NOT NULL,
            notes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(athleteEmail) REFERENCES users(email)
        )
    `);

    // Schedules Table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userEmail TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userEmail) REFERENCES users(email)
        )
    `);

    // Chats Table
    await database.exec(`
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userEmail TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userEmail) REFERENCES users(email)
        )
    `);

    // Seed Trainer if not exists
    const trainer = await database.get("SELECT * FROM users WHERE email = ?", ["trainer@school.edu"]);
    if (!trainer) {
        const hashedPass = await bcrypt.hash("athleticare", 10);
        await database.run(
            "INSERT INTO users (email, password, firstname, lastname, role, accessCode) VALUES (?, ?, ?, ?, ?, ?)",
            ["trainer@school.edu", hashedPass, "Head", "Trainer", "trainer", "WEYMOUTH"]
        );
    }

    return database;
}

const startServer = async () => {
    try {
        db = await initDb();
        console.log("Database initialized ✅");
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

// ================= EMAIL SETUP =================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
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

// AI SETUP
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// AUTH: Signup
app.post("/api/auth/signup", async (req, res) => {
    const { email, password, firstname, lastname, accessCode } = req.body;
    // Non-affiliated users (no access code) skip onboarding
    const isAffiliated = accessCode && accessCode.trim().length > 0;
    const onboardingComplete = isAffiliated ? 0 : 1;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            "INSERT INTO users (email, password, firstname, lastname, accessCode, onboardingComplete) VALUES (?, ?, ?, ?, ?, ?)",
            [email, hashedPassword, firstname, lastname, accessCode || null, onboardingComplete]
        );
        const token = jwt.sign({ email, role: 'athlete' }, JWT_SECRET, { expiresIn: '24h' });
        const user = { email, firstname, lastname, role: 'athlete', onboardingComplete, profile: null };
        res.status(201).json({ success: true, token, user });
    } catch (err) {
        if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "Email already exists" });
        res.status(500).json({ error: "Signup failed" });
    }
});

// AUTH: Trainer Signup (Secure)
app.post("/api/auth/trainer/signup", async (req, res) => {
    const { email, password, firstname, lastname, adminCode } = req.body;
    const STAFF_CODE = "WEYMOUTH_STAFF";
    if (adminCode !== STAFF_CODE) return res.status(403).json({ error: "Invalid School Admin Code" });
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
        if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "Email already exists" });
        res.status(500).json({ error: "Trainer signup failed" });
    }
});

// AUTH: Login
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        const { password: _, ...userWithoutPassword } = user;
        userWithoutPassword.profile = JSON.parse(user.profile || "null");
        res.json({ token, user: userWithoutPassword });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// PROFILE: Update
app.post("/api/profile", authenticateToken, async (req, res) => {
    const { profile } = req.body;
    try {
        await db.run("UPDATE users SET profile = ?, onboardingComplete = 1 WHERE email = ?", [JSON.stringify(profile), req.user.email]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Profile update failed" });
    }
});

// CHECK-IN
app.post("/api/checkin", authenticateToken, async (req, res) => {
    const { score, data, date } = req.body;
    try {
        await db.run("INSERT INTO checkins (userEmail, date, score, data) VALUES (?, ?, ?, ?)", [req.user.email, date, score, JSON.stringify(data)]);
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Check-in failed" });
    }
});

app.get("/api/checkins", authenticateToken, async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM checkins WHERE userEmail = ? ORDER BY timestamp DESC", [req.user.email]);
        res.json(rows.map(r => ({ ...r, data: JSON.parse(r.data) })));
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch check-ins" });
    }
});

// TRAINER: Team Data
app.get("/api/trainer/team", authenticateToken, async (req, res) => {
    try {
        // Look up the trainer's own accessCode so we dynamically filter the right team
        const trainer = await db.get("SELECT accessCode FROM users WHERE email = ?", [req.user.email]);
        const teamCode = trainer?.accessCode || "WEYMOUTH";

        const users = await db.all(
            "SELECT email, firstname, lastname, accessCode, onboardingComplete, profile FROM users WHERE accessCode = ? AND role = 'athlete'",
            [teamCode]
        );

        const athletes = [];
        for (const user of users) {
            // Return ALL check-ins for each athlete (not just the last one)
            const checkins = await db.all(
                "SELECT score, date, data, timestamp FROM checkins WHERE userEmail = ? ORDER BY timestamp DESC",
                [user.email]
            );
            const parsedCheckins = checkins.map(c => ({ ...c, data: JSON.parse(c.data) }));

            athletes.push({
                user: { ...user, profile: JSON.parse(user.profile || "{}") },
                checkins: parsedCheckins
            });
        }
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch team data" });
    }
});

// CHAT
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

app.get("/api/chats", authenticateToken, async (req, res) => {
    try {
        const row = await db.get("SELECT data FROM chats WHERE userEmail = ?", [req.user.email]);
        res.json(row ? JSON.parse(row.data) : []);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch chats" });
    }
});

// AI Chat
app.post("/chat", authenticateToken, async (req, res) => {
    try {
        const { messages } = req.body;
        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "system", content: "You are AthletiCare AI..." }, ...messages]
        });
        res.json({ reply: completion.choices[0].message.content });
    } catch (err) {
        res.status(500).json({ error: "AI failed" });
    }
});

// Catch-all
app.all("/api/*", (req, res) => res.status(404).json({ error: "Route not found" }));
app.use(express.static("public"));
app.get("*", (req, res) => res.sendFile(path.join(path.resolve(), "public", "index.html")));
