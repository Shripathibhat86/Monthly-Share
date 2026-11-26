import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
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
  const customDbPath = process.env.SQLITE_DB_PATH?.trim();
  const dataDir = customDbPath ? path.dirname(customDbPath) : (isServerless ? os.tmpdir() : path.join(__dirname, '..', 'data'));
  console.log(`DATABASE_URL not set or not postgres. Using local SQLite fallback in ${customDbPath || (isServerless ? os.tmpdir() : 'data/expenses.db')}...`);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = customDbPath || path.join(dataDir, 'expenses.db');
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
      lastInsertRowid: res.rows[0]?.id ? Number(res.rows[0].id) : 0
    };
  } else {
    // SQLite mode
    const trimmed = sql.trim();
    const isSelect = /^(SELECT|PRAGMA)/i.test(trimmed);
    const hasReturning = /\bRETURNING\b/i.test(trimmed);
    const stmt = sqliteDb.prepare(sql);
    if (isSelect || hasReturning) {
      const rows = stmt.all(...params);
      return {
        rows: rows || [],
        changes: hasReturning ? rows.length : 0,
        lastInsertRowid: rows[0]?.id ? Number(rows[0].id) : 0
      };
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

function hashPasswordScrypt(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function ensureSqliteColumn(table, column, definition) {
  const cols = sqliteDb.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some((c) => c.name === column);
  if (!exists) {
    sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Link any pre-existing unowned records (user_id IS NULL) to the Admin account.
 * Never deletes or overwrites existing records.
 */
export async function linkExistingDataToAdmin(adminUserId) {
  if (!adminUserId) return;
  await query('UPDATE members SET user_id = ? WHERE user_id IS NULL', [adminUserId]);
  await query('UPDATE expenses SET user_id = ? WHERE user_id IS NULL', [adminUserId]);
  await query('UPDATE settlements SET user_id = ? WHERE user_id IS NULL', [adminUserId]);
}

/**
 * Seed default 4 members ONLY if members table has zero rows for a fresh DB.
 */
export async function seedDefaultMembersIfEmpty(adminUserId) {
  const countRes = await query('SELECT COUNT(*) as count FROM members');
  const totalMembers = Number(countRes.rows[0]?.count || 0);
  if (totalMembers === 0 && adminUserId) {
    console.log('Seeding default 4 members for Admin on empty database...');
    await query('INSERT INTO members (user_id, name, role, pin) VALUES (?, ?, ?, ?)', [adminUserId, 'Shripathi', 'regular', '1996']);
    await query('INSERT INTO members (user_id, name, role, pin) VALUES (?, ?, ?, ?)', [adminUserId, 'Niranth', 'regular', '1999']);
    await query('INSERT INTO members (user_id, name, role, pin) VALUES (?, ?, ?, ?)', [adminUserId, 'Sharath', 'occasional', '1997']);
    await query('INSERT INTO members (user_id, name, role, pin) VALUES (?, ?, ?, ?)', [adminUserId, 'Vatsa', 'occasional', '1996']);
  }
}

/**
 * Initialize Tables, Auth Schema, and Safely Link Existing Data to Admin
 */
export async function initDb() {
  if (isPg) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        username VARCHAR(80) UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'regular',
        pin VARCHAR(20) NOT NULL DEFAULT '1234',
        upi_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE members ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);
      ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

      CREATE TABLE IF NOT EXISTS expense_participants (
        id SERIAL PRIMARY KEY,
        expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES members(id) ON DELETE RESTRICT,
        allocated_amount NUMERIC(12, 2) NOT NULL,
        split_value NUMERIC(12, 2)
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
      ALTER TABLE settlements ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `);

    // Legacy placeholder rename only (never overwrite customized member names)
    await pgPool.query(`
      UPDATE members SET name = 'Shripathi', pin = '1996' WHERE name = 'User1';
      UPDATE members SET name = 'Niranth', pin = '1999' WHERE name = 'User2';
      UPDATE members SET name = 'Sharath', pin = '1997' WHERE name = 'User3';
      UPDATE members SET name = 'Vatsa', pin = '1996' WHERE name = 'User4';
    `);
  } else {
    // SQLite mode
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'regular',
        pin TEXT NOT NULL DEFAULT '1234',
        upi_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

    ensureSqliteColumn('members', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
    ensureSqliteColumn('members', 'upi_id', 'TEXT');
    ensureSqliteColumn('expenses', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
    ensureSqliteColumn('settlements', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');

    // Legacy placeholder rename only
    sqliteDb.prepare("UPDATE members SET name = 'Shripathi', pin = '1996' WHERE name = 'User1'").run();
    sqliteDb.prepare("UPDATE members SET name = 'Niranth', pin = '1999' WHERE name = 'User2'").run();
    sqliteDb.prepare("UPDATE members SET name = 'Sharath', pin = '1997' WHERE name = 'User3'").run();
    sqliteDb.prepare("UPDATE members SET name = 'Vatsa', pin = '1996' WHERE name = 'User4'").run();
  }

  // Ensure auth_secret exists in app_settings if AUTH_SECRET env is not provided
  const secretRes = await query("SELECT value FROM app_settings WHERE key = 'auth_secret'");
  if (secretRes.rows.length === 0) {
    const generatedSecret = crypto.randomBytes(32).toString('hex');
    if (isPg) {
      await query(
        "INSERT INTO app_settings (key, value) VALUES ('auth_secret', ?) ON CONFLICT (key) DO NOTHING",
        [generatedSecret]
      );
    } else {
      await query(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('auth_secret', ?)",
        [generatedSecret]
      );
    }
  }

  // Check if admin user already exists
  const adminRes = await query("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
  let adminUserId = adminRes.rows[0]?.id ? Number(adminRes.rows[0].id) : null;

  // Optionally auto-seed admin from environment variables if no admin exists yet
  if (!adminUserId && process.env.ADMIN_PASSWORD?.trim()) {
    const adminEmail = (process.env.ADMIN_EMAIL?.trim() || 'admin@monthlyshare.local').toLowerCase();
    const adminUsername = (process.env.ADMIN_USERNAME?.trim() || 'admin').toLowerCase();
    const adminName = process.env.ADMIN_NAME?.trim() || 'Admin';
    const passwordHash = hashPasswordScrypt(process.env.ADMIN_PASSWORD.trim());

    const inserted = await query(
      "INSERT INTO users (name, email, username, password_hash, role) VALUES (?, ?, ?, ?, 'admin') RETURNING id",
      [adminName, adminEmail, adminUsername, passwordHash]
    );
    adminUserId = inserted.lastInsertRowid;
    console.log(`Admin account initialized from environment variables (${adminEmail}).`);
  }

  if (adminUserId) {
    await linkExistingDataToAdmin(adminUserId);
    await seedDefaultMembersIfEmpty(adminUserId);
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
