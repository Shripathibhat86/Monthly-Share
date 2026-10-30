import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isPg = false;
let pgPool = null;
let sqliteDb = null;

const databaseUrl = process.env.DATABASE_URL?.trim();

if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
  isPg = true;
  console.log('Connecting to Neon DB / PostgreSQL...');
  try {
    const { Pool } = await import('pg');
    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err.message);
    throw err;
  }
} else {
  isPg = false;
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dataDir = isServerless ? '/tmp' : path.join(__dirname, '..', 'data');
  console.log(`DATABASE_URL not set or not postgres. Using local SQLite fallback in ${isServerless ? '/tmp' : 'data/expenses.db'}...`);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'expenses.db');
  const { DatabaseSync } = await import('node:sqlite');
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
}

/**
 * Universal query runner: translates '?' to '$1, $2...' for Postgres
 * Returns { rows: [...], changes: number, lastInsertRowid: number }
 */
export async function query(sql, params = []) {
  if (isPg) {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pgPool.query(pgSql, params);
    return {
      rows: res.rows || [],
      changes: res.rowCount || 0,
      lastInsertRowid: res.rows[0]?.id || 0
    };
  } else {
    // SQLite mode
    const trimmed = sql.trim();
    const isSelect = /^(SELECT|PRAGMA)/i.test(trimmed);
    const stmt = sqliteDb.prepare(sql);
    if (isSelect) {
      const rows = stmt.all(...params);
      return { rows: rows || [], changes: 0, lastInsertRowid: 0 };
    } else {
      const res = stmt.run(...params);
      return {
        rows: [],
        changes: res.changes || 0,
        lastInsertRowid: Number(res.lastInsertRowid || 0)
      };
    }
  }
}

/**
 * Initialize Tables & Seed Default Members
 */
export async function initDb() {
  if (isPg) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'regular',
        pin VARCHAR(20) NOT NULL DEFAULT '1234',
        upi_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE members ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);

      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date VARCHAR(10) NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        paid_by_member_id INTEGER REFERENCES members(id) ON DELETE RESTRICT,
        split_method VARCHAR(20) NOT NULL,
        notes TEXT,
        receipt_data TEXT,
        receipt_filename VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expense_participants (
        id SERIAL PRIMARY KEY,
        expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE RESTRICT,
        allocated_amount NUMERIC(12, 2) NOT NULL,
        split_value NUMERIC(12, 2)
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        month VARCHAR(7) NOT NULL,
        payer_member_id INTEGER REFERENCES members(id) ON DELETE RESTRICT,
        receiver_member_id INTEGER REFERENCES members(id) ON DELETE RESTRICT,
        amount NUMERIC(12, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        payment_date VARCHAR(10),
        reference_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `);

    // Check seed members
    const membersRes = await pgPool.query('SELECT COUNT(*) as count FROM members');
    if (parseInt(membersRes.rows[0].count, 10) === 0) {
      console.log('Seeding default 4 members in PostgreSQL...');
      await pgPool.query(`
        INSERT INTO members (name, role, pin) VALUES 
        ('Shripathi', 'regular', '1996'),
        ('Niranth', 'regular', '1999'),
        ('Sharath', 'occasional', '1997'),
        ('Vatsa', 'occasional', '1996');
      `);
    } else {
      // Migrate / ensure custom member names and PINs
      await pgPool.query(`
        UPDATE members SET name = 'Shripathi', pin = '1996' WHERE (name = 'User1' OR name = 'Shripathi');
        UPDATE members SET name = 'Niranth', pin = '1999' WHERE (name = 'User2' OR name = 'Niranth');
        UPDATE members SET name = 'Sharath', pin = '1997' WHERE (name = 'User3' OR name = 'Sharath');
        UPDATE members SET name = 'Vatsa', pin = '1996' WHERE (name = 'User4' OR name = 'Vatsa');
      `);
    }
  } else {
    // SQLite mode
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'regular',
        pin TEXT NOT NULL DEFAULT '1234',
        upi_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        paid_by_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        split_method TEXT NOT NULL,
        notes TEXT,
        receipt_data TEXT,
        receipt_filename TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expense_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        allocated_amount REAL NOT NULL,
        split_value REAL
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL,
        payer_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        receiver_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_date TEXT,
        reference_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
    `);

    const stmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM members');
    const row = stmt.get();
    if (Number(row.count) === 0) {
      console.log('Seeding default 4 members in SQLite...');
      const insert = sqliteDb.prepare('INSERT INTO members (name, role, pin) VALUES (?, ?, ?)');
      insert.run('Shripathi', 'regular', '1996');
      insert.run('Niranth', 'regular', '1999');
      insert.run('Sharath', 'occasional', '1997');
      insert.run('Vatsa', 'occasional', '1996');
    } else {
      // Migrate / ensure custom member names and PINs
      sqliteDb.prepare("UPDATE members SET name = 'Shripathi', pin = '1996' WHERE (name = 'User1' OR name = 'Shripathi')").run();
      sqliteDb.prepare("UPDATE members SET name = 'Niranth', pin = '1999' WHERE (name = 'User2' OR name = 'Niranth')").run();
      sqliteDb.prepare("UPDATE members SET name = 'Sharath', pin = '1997' WHERE (name = 'User3' OR name = 'Sharath')").run();
      sqliteDb.prepare("UPDATE members SET name = 'Vatsa', pin = '1996' WHERE (name = 'User4' OR name = 'Vatsa')").run();
    }
  }
  console.log(`Database initialized successfully (${isPg ? 'Neon DB/PostgreSQL' : 'Local SQLite'}).`);
}

export function getDbInfo() {
  return {
    type: isPg ? 'Neon DB (PostgreSQL)' : 'Local SQLite',
    databaseUrlConfigured: Boolean(databaseUrl),
    storageLocation: isPg ? 'Cloud (Neon Serverless)' : 'Local (data/expenses.db)'
  };
}

export { isPg, sqliteDb, pgPool };
