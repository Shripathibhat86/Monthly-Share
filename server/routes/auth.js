import { Router } from 'express';
import { query, linkExistingDataToAdmin, seedDefaultMembersIfEmpty } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getAuthenticatedUser,
  requireAuth,
  requireAdmin
} from '../auth.js';

const router = Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function sanitizeUsername(raw) {
  if (!raw || !raw.trim()) return null;
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

// GET auth status (public)
router.get('/status', async (req, res) => {
  try {
    const adminRes = await query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    const adminCount = Number(adminRes.rows[0]?.count || 0);
    const user = await getAuthenticatedUser(req);

    res.json({
      needsAdminSetup: adminCount === 0,
      authenticated: Boolean(user),
      user: user || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST one-time initial Admin setup (only works when 0 admins exist)
router.post('/setup-admin', async (req, res) => {
  try {
    const adminRes = await query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    if (Number(adminRes.rows[0]?.count || 0) > 0) {
      return res.status(403).json({ error: 'Admin account is already configured. Please sign in.' });
    }

    const { name, email, username, password } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    if (!password || password.toString().length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = sanitizeUsername(username) || cleanEmail.split('@')[0];

    const existing = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)',
      [cleanEmail, cleanUsername]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username is already in use' });
    }

    const passwordHash = hashPassword(password.toString());
    const inserted = await query(
      "INSERT INTO users (name, email, username, password_hash, role, last_login_at) VALUES (?, ?, ?, ?, 'admin', CURRENT_TIMESTAMP) RETURNING id",
      [name.trim(), cleanEmail, cleanUsername, passwordHash]
    );

    const adminId = inserted.lastInsertRowid;

    // Link all existing unowned records in the linked database to Admin without deleting anything
    await linkExistingDataToAdmin(adminId);
    await seedDefaultMembersIfEmpty(adminId);

    const userObj = {
      id: adminId,
      name: name.trim(),
      email: cleanEmail,
      username: cleanUsername,
      role: 'admin'
    };

    const token = await signSessionToken(userObj);
    setSessionCookie(req, res, token);

    res.status(201).json({
      success: true,
      message: 'Admin account created and existing data linked safely.',
      user: userObj
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST register a new normal account (public)
router.post('/register', async (req, res) => {
  try {
    const adminRes = await query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    if (Number(adminRes.rows[0]?.count || 0) === 0) {
      return res.status(403).json({ error: 'Initial admin setup must be completed before creating accounts.' });
    }

    const { name, email, username, password, memberPin } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    if (!password || password.toString().length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const cleanPin = memberPin && memberPin.toString().trim() ? memberPin.toString().trim() : '1234';
    if (cleanPin.length < 4) {
      return res.status(400).json({ error: 'Member action PIN must be at least 4 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = sanitizeUsername(username) || null;

    const dupEmail = await query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [cleanEmail]);
    if (dupEmail.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    if (cleanUsername) {
      const dupUsername = await query('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [cleanUsername]);
      if (dupUsername.rows.length > 0) {
        return res.status(409).json({ error: 'This username is already taken' });
      }
    }

    const passwordHash = hashPassword(password.toString());
    const inserted = await query(
      "INSERT INTO users (name, email, username, password_hash, role, last_login_at) VALUES (?, ?, ?, ?, 'user', CURRENT_TIMESTAMP) RETURNING id",
      [name.trim(), cleanEmail, cleanUsername, passwordHash]
    );

    const newUserId = inserted.lastInsertRowid;

    // Create an isolated starter member for this normal account (no admin data linked)
    await query(
      'INSERT INTO members (user_id, name, role, pin) VALUES (?, ?, ?, ?)',
      [newUserId, name.trim(), 'regular', cleanPin]
    );

    const userObj = {
      id: newUserId,
      name: name.trim(),
      email: cleanEmail,
      username: cleanUsername,
      role: 'user'
    };

    const token = await signSessionToken(userObj);
    setSessionCookie(req, res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: userObj
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST login (public)
router.post('/login', async (req, res) => {
  try {
    const identifier = (req.body.identifier || req.body.email || req.body.username || '').toString().trim().toLowerCase();
    const password = req.body.password ? req.body.password.toString() : '';

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email / username and password are required' });
    }

    const userRes = await query(
      'SELECT id, name, email, username, password_hash, role FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1',
      [identifier, identifier]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const dbUser = userRes.rows[0];
    if (!verifyPassword(password, dbUser.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [dbUser.id]);

    if (dbUser.role === 'admin') {
      await linkExistingDataToAdmin(Number(dbUser.id));
    }

    const userObj = {
      id: Number(dbUser.id),
      name: dbUser.name,
      email: dbUser.email,
      username: dbUser.username,
      role: dbUser.role
    };

    const token = await signSessionToken(userObj);
    setSessionCookie(req, res, token);

    res.json({
      success: true,
      user: userObj
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST logout
router.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ success: true, message: 'Signed out successfully' });
});

// GET current user profile
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// PUT update current user profile or password
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;

    if (newPassword !== undefined && newPassword !== '') {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      if (newPassword.toString().length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
      const userRes = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (userRes.rows.length === 0 || !verifyPassword(currentPassword.toString(), userRes.rows[0].password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const newHash = hashPassword(newPassword.toString());
      await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    }

    if (name && name.trim()) {
      await query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), req.user.id]);
    }

    const updated = await query('SELECT id, name, email, username, role, created_at, last_login_at FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, user: updated.rows[0], message: 'Account updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all accounts (Admin only - summary counts only, never private expense items)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const usersRes = await query(
      `SELECT u.id, u.name, u.email, u.username, u.role, u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM members m WHERE m.user_id = u.id) as member_count,
              (SELECT COUNT(*) FROM expenses e WHERE e.user_id = u.id) as expense_count
       FROM users u
       ORDER BY u.id ASC`
    );
    res.json(
      usersRes.rows.map((u) => ({
        ...u,
        id: Number(u.id),
        member_count: Number(u.member_count || 0),
        expense_count: Number(u.expense_count || 0)
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a normal user account (Admin only)
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!targetId || targetId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    const targetRes = await query('SELECT id, role FROM users WHERE id = ?', [targetId]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ error: 'User account not found' });
    }
    if (targetRes.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete an admin account' });
    }

    // Delete only that normal user's isolated data
    await query('DELETE FROM expense_participants WHERE expense_id IN (SELECT id FROM expenses WHERE user_id = ?)', [targetId]);
    await query('DELETE FROM expenses WHERE user_id = ?', [targetId]);
    await query('DELETE FROM settlements WHERE user_id = ?', [targetId]);
    await query('DELETE FROM members WHERE user_id = ?', [targetId]);
    await query('DELETE FROM users WHERE id = ?', [targetId]);

    res.json({ success: true, message: 'User account and its isolated data deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
