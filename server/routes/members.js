import { Router } from 'express';
import { query } from '../db.js';
import { verifyMemberPinOrPassword } from '../auth.js';

const router = Router();

// GET all members for signed-in user (safe, without PIN)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, role, upi_id, created_at FROM members WHERE user_id = ? ORDER BY id ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new member to signed-in user's workspace
router.post('/', async (req, res) => {
  try {
    const { name, role = 'regular', pin = '1234', upi_id = null } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Member name is required' });
    }

    const validRole = role === 'occasional' ? 'occasional' : 'regular';
    const cleanPin = pin && pin.toString().trim() ? pin.toString().trim() : '1234';
    if (cleanPin.length < 4) {
      return res.status(400).json({ error: 'Member PIN must be at least 4 characters' });
    }

    const inserted = await query(
      'INSERT INTO members (user_id, name, role, pin, upi_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, name.trim(), validRole, cleanPin, upi_id?.trim() || null]
    );

    res.status(201).json({
      success: true,
      member: {
        id: inserted.lastInsertRowid,
        name: name.trim(),
        role: validRole,
        upi_id: upi_id?.trim() || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST verify PIN (scoped to signed-in user's members, also accepts account password)
router.post('/verify-pin', async (req, res) => {
  const { memberId, pin } = req.body;
  if (!pin || !pin.toString().trim()) {
    return res.status(400).json({ error: 'Password / PIN is required' });
  }

  try {
    const result = await verifyMemberPinOrPassword(req.user.id, memberId, pin);
    if (result.notFound) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (!result.verified) {
      return res.status(401).json({ error: 'Incorrect authorization PIN / password' });
    }
    return res.json({
      success: true,
      memberId: result.member?.id,
      memberName: result.member?.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update member name, role, or upi_id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, upi_id, pin } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }

  try {
    if (!pin) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to update member profile' });
    }
    const authCheck = await verifyMemberPinOrPassword(req.user.id, id, pin);
    if (authCheck.notFound) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (!authCheck.verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    const validRole = role === 'occasional' ? 'occasional' : role === 'regular' ? 'regular' : null;
    await query(
      'UPDATE members SET name = ?, role = COALESCE(?, role), upi_id = ? WHERE id = ? AND user_id = ?',
      [name.trim(), validRole, upi_id !== undefined ? (upi_id?.trim() || null) : null, Number(id), req.user.id]
    );

    res.json({ success: true, message: 'Member updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update member PIN
router.put('/:id/pin', async (req, res) => {
  const { id } = req.params;
  const { oldPin, newPin } = req.body;

  if (!newPin || newPin.toString().trim().length < 4) {
    return res.status(400).json({ error: 'New password / PIN must be at least 4 characters' });
  }

  if (!oldPin) {
    return res.status(400).json({ error: 'Current password / PIN is required' });
  }

  try {
    const authCheck = await verifyMemberPinOrPassword(req.user.id, id, oldPin);
    if (authCheck.notFound) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (!authCheck.verified) {
      return res.status(401).json({ error: 'Current password / PIN is incorrect' });
    }

    await query('UPDATE members SET pin = ? WHERE id = ? AND user_id = ?', [newPin.toString().trim(), Number(id), req.user.id]);
    res.json({ success: true, message: 'PIN changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE member (only if owned by user, not the last member, and has no linked expenses/settlements)
router.delete('/:id', async (req, res) => {
  const memberId = Number(req.params.id);
  try {
    const allMembers = await query('SELECT id FROM members WHERE user_id = ?', [req.user.id]);
    if (!allMembers.rows.some((m) => Number(m.id) === memberId)) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (allMembers.rows.length <= 1) {
      return res.status(400).json({ error: 'At least one member must remain in your workspace' });
    }

    const expCount = await query(
      'SELECT COUNT(*) as count FROM expenses WHERE user_id = ? AND paid_by_member_id = ?',
      [req.user.id, memberId]
    );
    const partCount = await query(
      'SELECT COUNT(*) as count FROM expense_participants ep JOIN expenses e ON ep.expense_id = e.id WHERE e.user_id = ? AND ep.member_id = ?',
      [req.user.id, memberId]
    );
    const setCount = await query(
      'SELECT COUNT(*) as count FROM settlements WHERE user_id = ? AND (payer_member_id = ? OR receiver_member_id = ?)',
      [req.user.id, memberId, memberId]
    );

    if (
      Number(expCount.rows[0]?.count || 0) > 0 ||
      Number(partCount.rows[0]?.count || 0) > 0 ||
      Number(setCount.rows[0]?.count || 0) > 0
    ) {
      return res.status(400).json({
        error: 'Cannot delete a member who is already referenced in expenses or settlements. You can rename them instead.'
      });
    }

    await query('DELETE FROM members WHERE id = ? AND user_id = ?', [memberId, req.user.id]);
    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
