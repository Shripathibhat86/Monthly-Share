import crypto from 'crypto';
import { query } from './db.js';

const SESSION_COOKIE_NAME = 'ms_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

let cachedSecret = null;

async function getAuthSecret() {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim().length >= 16) {
    return process.env.AUTH_SECRET.trim();
  }
  if (cachedSecret) {
    return cachedSecret;
  }
  const res = await query("SELECT value FROM app_settings WHERE key = 'auth_secret'");
  if (res.rows.length > 0 && res.rows[0].value) {
    cachedSecret = res.rows[0].value;
    return cachedSecret;
  }
  const fallback = crypto.randomBytes(32).toString('hex');
  cachedSecret = fallback;
  return fallback;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derivedBuf = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derivedBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export async function signSessionToken(user) {
  const secret = await getAuthSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: Number(user.id),
      role: user.role,
      iat: now,
      exp: now + SESSION_TTL_SECONDS
    })
  );
  const data = `${header}.${payload}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const secret = await getAuthSecret();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.sub || !decoded.exp || decoded.exp < now) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

export function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function isHttpsRequest(req) {
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

export function setSessionCookie(req, res, token) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req, res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0'
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function getAuthenticatedUser(req) {
  const token = extractToken(req);
  if (!token) return null;

  const decoded = await verifySessionToken(token);
  if (!decoded) return null;

  const userRes = await query(
    'SELECT id, name, email, username, role, created_at, last_login_at FROM users WHERE id = ?',
    [Number(decoded.sub)]
  );
  if (userRes.rows.length === 0) {
    return null;
  }

  const u = userRes.rows[0];
  return {
    id: Number(u.id),
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    created_at: u.created_at,
    last_login_at: u.last_login_at
  };
}

export async function requireAuth(req, res, next) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication check failed' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Verifies a member PIN (scoped to userId) OR the signed-in user's account password.
 * Returns { verified: boolean, member: { id, name } | null }
 */
export async function verifyMemberPinOrPassword(userId, memberId, rawPin) {
  const cleanPin = rawPin ? rawPin.toString().trim() : '';
  if (!cleanPin) {
    return { verified: false, member: null };
  }

  if (memberId && memberId !== 'any' && Number(memberId) > 0) {
    const memberRes = await query(
      'SELECT id, name, pin FROM members WHERE id = ? AND user_id = ?',
      [Number(memberId), Number(userId)]
    );
    if (memberRes.rows.length === 0) {
      return { verified: false, member: null, notFound: true };
    }
    const member = memberRes.rows[0];
    if (member.pin && member.pin.trim() === cleanPin) {
      return { verified: true, member: { id: Number(member.id), name: member.name } };
    }

    // Fallback: check if cleanPin matches the signed-in user's account password
    const userRes = await query('SELECT password_hash FROM users WHERE id = ?', [Number(userId)]);
    if (userRes.rows.length > 0 && verifyPassword(cleanPin, userRes.rows[0].password_hash)) {
      return { verified: true, member: { id: Number(member.id), name: member.name } };
    }

    return { verified: false, member: null };
  }

  // 'any' member belonging to this user
  const allMembers = await query('SELECT id, name, pin FROM members WHERE user_id = ? ORDER BY id ASC', [Number(userId)]);
  const matched = allMembers.rows.find((m) => m.pin && m.pin.trim() === cleanPin);
  if (matched) {
    return { verified: true, member: { id: Number(matched.id), name: matched.name } };
  }

  // Fallback: account password
  const userRes = await query('SELECT password_hash FROM users WHERE id = ?', [Number(userId)]);
  if (userRes.rows.length > 0 && verifyPassword(cleanPin, userRes.rows[0].password_hash)) {
    const first = allMembers.rows[0];
    return {
      verified: true,
      member: first ? { id: Number(first.id), name: first.name } : { id: 0, name: 'Account Owner' }
    };
  }

  return { verified: false, member: null };
}
