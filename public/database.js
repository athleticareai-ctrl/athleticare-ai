import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';


const __dirname = path.resolve();
const dbPath = path.join(__dirname, 'athleticare.db');

export async function initDb() {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Users Table
    await db.exec(`
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
    await db.exec(`
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
    await db.exec(`
        CREATE TABLE IF NOT EXISTS trainer_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            athleteEmail TEXT NOT NULL,
            notes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(athleteEmail) REFERENCES users(email)
        )
    `);

    // Schedules Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userEmail TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userEmail) REFERENCES users(email)
        )
    `);

    // Chats Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userEmail TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userEmail) REFERENCES users(email)
        )
    `);

    console.log("Database initialized ✅");

    // Seed Trainer if not exists
    const trainer = await db.get("SELECT * FROM users WHERE email = ?", ["trainer@school.edu"]);
    if (!trainer) {
        const hashedPass = await bcrypt.hash("athleticare", 10);
        await db.run(
            "INSERT INTO users (email, password, firstname, lastname, role, accessCode) VALUES (?, ?, ?, ?, ?, ?)",
            ["trainer@school.edu", hashedPass, "Head", "Trainer", "trainer", "WEYMOUTH"]
        );
        console.log("Trainer account seeded ✅");
    }

    return db;
}
