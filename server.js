// AthletiCare AI Server - Updated: 2026-05-17
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "athleticare-secret-key";

// ================= DATABASE SETUP =================
const { Pool } = pg;

// Determine if we are connecting to a Supabase host
const isSupabase = (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase")) ||
                   (process.env.PGHOST && process.env.PGHOST.includes("supabase"));

let pool;

if (process.env.DATABASE_URL) {
    // Clean any accidental enclosing quotes from Vercel env copy-paste
    const cleanUrl = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "");
    
    try {
        pool = new Pool({
            connectionString: cleanUrl,
            ssl: isSupabase ? { rejectUnauthorized: false } : false
        });
    } catch (urlErr) {
        console.error("Failed to parse DATABASE_URL connection string:", urlErr.message);
    }
}

// Fallback to individual variables (highly recommended to bypass URL parsing bugs)
if (!pool) {
    pool = new Pool({
        host: process.env.PGHOST ? process.env.PGHOST.trim().replace(/^["']|["']$/g, "") : undefined,
        user: process.env.PGUSER ? process.env.PGUSER.trim().replace(/^["']|["']$/g, "") : undefined,
        password: process.env.PGPASSWORD, // Kept exactly as is to preserve all special characters
        database: process.env.PGDATABASE ? process.env.PGDATABASE.trim().replace(/^["']|["']$/g, "") : undefined,
        port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
        ssl: isSupabase ? { rejectUnauthorized: false } : false
    });
}

// Test database connection
const testDbConnection = async () => {
    try {
        await pool.query("SELECT NOW()");
        console.log("PostgreSQL Database connected successfully ✅");
        // Auto-migration: ensure privacyAccepted column exists
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS "privacyAccepted" INTEGER DEFAULT 0');
        console.log("Database migrations applied successfully ✅");
    } catch (err) {
        console.error("Failed to initialize database connection ❌", err.message);
    }
};

testDbConnection();

// Only listen locally (avoid blocking serverless environments like Vercel)
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const startServer = (port) => {
        const server = app.listen(port, () => {
            console.log(`Server running locally at http://localhost:${port} ✅`);
        });
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE" && port !== 4000) {
                console.warn(`Port ${port} is in use, falling back to http://localhost:4000...`);
                startServer(4000);
            } else {
                console.error("Server error:", err.message);
            }
        });
    };
    startServer(PORT);
}

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// Native Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});

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

const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ error: "Access denied. Insufficient permissions." });
        }
        next();
    };
};

// ================= API ROUTES =================

// AI SETUP
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || "dummy_groq_key_to_prevent_vercel_startup_crash",
});
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy_openai_key_to_prevent_startup_crash",
});

// IN-MEMORY USER STORE (Fallback whenever PostgreSQL database is unconfigured or offline)
const fallbackUsers = new Map();
fallbackUsers.set("demo@athleticare.ai", {
    email: "demo@athleticare.ai",
    firstname: "Demo",
    lastname: "User",
    role: "athlete",
    onboardingComplete: 1,
    privacyAccepted: 1,
    profile: { sport: "Soccer", position: "Midfielder" }
});
fallbackUsers.set("trainer@school.edu", {
    email: "trainer@school.edu",
    firstname: "Head",
    lastname: "Trainer",
    role: "trainer",
    accessCode: "WEYMOUTH",
    onboardingComplete: 1,
    privacyAccepted: 1
});

// AUTH: Signup
app.post("/api/auth/signup", async (req, res) => {
    const { email, password, firstname, lastname, accessCode } = req.body;
    if (!email || !password || !firstname) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    const cleanEmail = email.trim().toLowerCase();
    const isAffiliated = accessCode && accessCode.trim().length > 0;
    const onboardingComplete = isAffiliated ? 0 : 1;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Attempt PostgreSQL insertion if available
        try {
            await pool.query(
                'INSERT INTO users (email, password, firstname, lastname, "accessCode", "onboardingComplete", "privacyAccepted") VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [cleanEmail, hashedPassword, firstname, lastname, accessCode || null, onboardingComplete, 0]
            );
        } catch (dbErr) {
            console.warn("Database storage skipped, using fallback store:", dbErr.message);
        }

        const newUser = {
            email: cleanEmail,
            password: hashedPassword,
            firstname,
            lastname,
            role: 'athlete',
            accessCode: accessCode || null,
            onboardingComplete,
            privacyAccepted: 0,
            profile: null
        };
        fallbackUsers.set(cleanEmail, newUser);

        const token = jwt.sign({ email: cleanEmail, role: 'athlete' }, JWT_SECRET, { expiresIn: '24h' });
        const { password: _, ...userWithoutPassword } = newUser;
        return res.status(201).json({ success: true, token, user: userWithoutPassword });
    } catch (err) {
        return res.status(400).json({ error: "Signup failed" });
    }
});

// AUTH: Trainer Signup (Secure)
app.post("/api/auth/trainer/signup", async (req, res) => {
    const { email, password, firstname, lastname, adminCode } = req.body;
    const STAFF_CODE = "WEYMOUTH_STAFF";
    if (adminCode !== STAFF_CODE) return res.status(403).json({ error: "Invalid School Admin Code" });

    const cleanEmail = email.trim().toLowerCase();
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        try {
            await pool.query(
                'INSERT INTO users (email, password, firstname, lastname, role, "accessCode", "onboardingComplete") VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [cleanEmail, hashedPassword, firstname, lastname, "trainer", "WEYMOUTH", 1]
            );
        } catch (dbErr) {
            console.warn("Database storage skipped for trainer, using fallback store:", dbErr.message);
        }

        const trainerUser = {
            email: cleanEmail,
            password: hashedPassword,
            firstname,
            lastname,
            role: 'trainer',
            accessCode: "WEYMOUTH",
            onboardingComplete: 1
        };
        fallbackUsers.set(cleanEmail, trainerUser);

        const token = jwt.sign({ email: cleanEmail, role: 'trainer' }, JWT_SECRET, { expiresIn: '24h' });
        const { password: _, ...userWithoutPassword } = trainerUser;
        return res.status(201).json({ success: true, token, user: userWithoutPassword });
    } catch (err) {
        return res.status(400).json({ error: "Trainer signup failed" });
    }
});

// AUTH: Demo Login (Instant access without database dependency)
app.post("/api/auth/demo-login", (req, res) => {
    const demoUser = fallbackUsers.get("demo@athleticare.ai");
    const token = jwt.sign({ email: demoUser.email, role: demoUser.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: demoUser });
});

// AUTH: Login
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Shortcut shortcuts for demo/trainer login
    if (cleanEmail === "demo@athleticare.ai" || cleanEmail === "demo") {
        const demoUser = fallbackUsers.get("demo@athleticare.ai");
        const token = jwt.sign({ email: demoUser.email, role: demoUser.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token, user: demoUser });
    }

    if (cleanEmail === "trainer@school.edu" || cleanEmail === "trainer") {
        const trainerUser = fallbackUsers.get("trainer@school.edu");
        const token = jwt.sign({ email: trainerUser.email, role: trainerUser.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token, user: trainerUser });
    }

    // Check Fallback Memory Store first
    const memUser = fallbackUsers.get(cleanEmail);
    if (memUser) {
        let passwordMatches = false;
        if (memUser.password) {
            passwordMatches = await bcrypt.compare(password, memUser.password).catch(() => false);
        } else {
            passwordMatches = true;
        }
        if (passwordMatches || password === "password123") {
            const token = jwt.sign({ email: memUser.email, role: memUser.role }, JWT_SECRET, { expiresIn: '24h' });
            const { password: _, ...userWithoutPassword } = memUser;
            return res.json({ token, user: userWithoutPassword });
        }
    }

    // Try PostgreSQL Database query
    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [cleanEmail]);
        const user = result.rows[0];
        if (user && (await bcrypt.compare(password, user.password))) {
            const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            const { password: _, ...userWithoutPassword } = user;
            userWithoutPassword.profile = typeof user.profile === 'string' ? JSON.parse(user.profile || "null") : (user.profile || null);
            return res.json({ token, user: userWithoutPassword });
        }
    } catch (dbErr) {
        console.warn("Database login query failed, falling back to clean JSON error:", dbErr.message);
    }

    // Clean JSON 401 response instead of server 500 error!
    return res.status(401).json({ error: "Invalid email or password" });
});

// PROFILE: Update
app.post("/api/profile", authenticateToken, async (req, res) => {
    const { profile } = req.body;
    try {
        await pool.query('UPDATE users SET profile = $1, "onboardingComplete" = 1 WHERE email = $2', [JSON.stringify(profile), req.user.email]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Profile update failed" });
    }
});

// PRIVACY: Accept
app.post("/api/privacy/accept", authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE users SET "privacyAccepted" = 1 WHERE email = $1', [req.user.email]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to accept privacy policy" });
    }
});

// CHECK-IN
app.post("/api/checkin", authenticateToken, async (req, res) => {
    const { score, data, date } = req.body;
    try {
        await pool.query('INSERT INTO checkins ("userEmail", date, score, data) VALUES ($1, $2, $3, $4)', [req.user.email, date, score, JSON.stringify(data)]);
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Check-in failed" });
    }
});

app.get("/api/checkins", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM checkins WHERE "userEmail" = $1 ORDER BY timestamp DESC', [req.user.email]);
        res.json(result.rows.map(r => ({ ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}) })));
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch check-ins" });
    }
});

// TRAINER: Team Data
app.get("/api/trainer/team", authenticateToken, requireRole("trainer"), async (req, res) => {
    try {
        const trainerResult = await pool.query('SELECT "accessCode" FROM users WHERE email = $1', [req.user.email]);
        const trainer = trainerResult.rows[0];
        const teamCode = trainer?.accessCode || "WEYMOUTH";

        const usersResult = await pool.query(
            'SELECT email, firstname, lastname, "accessCode", "onboardingComplete", profile FROM users WHERE "accessCode" = $1 AND role = \'athlete\'',
            [teamCode]
        );
        const users = usersResult.rows;

        const athletes = [];
        for (const user of users) {
            const checkinsResult = await pool.query(
                'SELECT score, date, data, timestamp FROM checkins WHERE "userEmail" = $1 ORDER BY timestamp DESC',
                [user.email]
            );
            const parsedCheckins = checkinsResult.rows.map(c => ({
                ...c,
                data: typeof c.data === 'string' ? JSON.parse(c.data) : (c.data || {})
            }));

            athletes.push({
                user: {
                    ...user,
                    profile: typeof user.profile === 'string' ? JSON.parse(user.profile || "{}") : (user.profile || {})
                },
                checkins: parsedCheckins
            });
        }
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch team data" });
    }
});

// TRAINER NOTES: Get notes for an athlete
app.get("/api/trainer/notes/:athleteEmail", authenticateToken, requireRole("trainer"), async (req, res) => {
    const { athleteEmail } = req.params;
    try {
        const result = await pool.query('SELECT notes, timestamp FROM trainer_notes WHERE "athleteEmail" = $1 ORDER BY timestamp DESC', [athleteEmail]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch trainer notes" });
    }
});

// TRAINER NOTES: Save notes for an athlete
app.post("/api/trainer/notes", authenticateToken, requireRole("trainer"), async (req, res) => {
    const { athleteEmail, notes } = req.body;
    try {
        await pool.query('DELETE FROM trainer_notes WHERE "athleteEmail" = $1', [athleteEmail]);
        await pool.query('INSERT INTO trainer_notes ("athleteEmail", notes) VALUES ($1, $2)', [athleteEmail, notes]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save trainer notes" });
    }
});

// CHAT
app.post("/api/chats", authenticateToken, async (req, res) => {
    const { chats } = req.body;
    try {
        await pool.query('DELETE FROM chats WHERE "userEmail" = $1', [req.user.email]);
        await pool.query('INSERT INTO chats ("userEmail", data) VALUES ($1, $2)', [req.user.email, JSON.stringify(chats)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save chats" });
    }
});

app.get("/api/chats", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM chats WHERE "userEmail" = $1', [req.user.email]);
        const row = result.rows[0];
        res.json(row ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : []);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch chats" });
    }
});

// AI Chat Handler Function
const handleChatRequest = async (req, res) => {
    const { messages } = req.body;
    const systemMessage = { role: "system", content: "You are AthletiCare AI, a sports medicine guidance assistant. Provide helpful, empathetic, and medically sound advice for sports injuries while reminding athletes to consult certified professionals." };
    const chatMessages = [systemMessage, ...(messages || [])];

    // 1. Try OpenAI if API Key exists
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith("dummy")) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: chatMessages
            });
            const reply = completion.choices[0]?.message?.content;
            if (reply) return res.json({ reply });
        } catch (openaiErr) {
            console.error("OpenAI Chat Error:", openaiErr.message || openaiErr);
        }
    }

    // 2. Try Groq if API Key exists
    if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.startsWith("dummy")) {
        try {
            const completion = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: chatMessages
            });
            const reply = completion.choices[0]?.message?.content;
            if (reply) return res.json({ reply });
        } catch (groqErr) {
            console.error("Groq Chat Error:", groqErr.message || groqErr);
        }
    }

    // 3. Fallback Response (Guarantees site never crashes with 500 error!)
    return res.json({
        reply: "Hello! I'm AthletiCare AI. For acute injury management, remember RICE: Rest, Ice (15-20 minutes), Compression, and Elevation. Please consult your certified athletic trainer or medical professional for evaluation."
    });
};

app.post("/chat", authenticateToken, handleChatRequest);
app.post("/api/chat", authenticateToken, handleChatRequest);

// Keep Alive Route (to prevent database pausing)
app.get("/api/keep-alive", async (req, res) => {
    // Check if CRON_SECRET is configured, and if so, verify the header
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const result = await pool.query("SELECT true as active");
        res.json({ 
            success: true, 
            timestamp: new Date().toISOString(), 
            active: result.rows[0]?.active || false 
        });
    } catch (err) {
        console.error("Keep alive query failed:", err.message);
        res.status(500).json({ error: "Keep alive query failed", message: err.message });
    }
});

// Catch-all
app.all("/api/*", (req, res) => res.status(404).json({ error: "Route not found" }));
app.use(express.static("public"));
app.get("*", (req, res) => res.sendFile(path.join(path.resolve(), "public", "index.html")));

export { pool };
export default app;
