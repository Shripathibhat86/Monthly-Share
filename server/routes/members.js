import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET all members (safe, without PIN)
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT id, name, role, upi_id, created_at FROM members ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST verify PIN
router.post('/verify-pin', async (req, res) => {
  const { memberId, pin } = req.body;
  if (!memberId || !pin) {
    return res.status(400).json({ error: 'memberId and pin are required' });
  }

  try {
    const result = await query('SELECT id, pin, name FROM members WHERE id = ?', [memberId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = result.rows[0];
    const isMatch = member.pin.trim() === pin.toString().trim();
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid PIN entered' });
    }

    res.json({ success: true, memberName: member.name });
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
    // Check PIN authorization if provided or verify current pin
    if (pin) {
      const checkPin = await query('SELECT pin FROM members WHERE id = ?', [id]);
      if (checkPin.rows.length > 0 && checkPin.rows[0].pin.trim() !== pin.toString().trim()) {
        return res.status(401).json({ error: 'Incorrect PIN authorization' });
      }
    }

    await query(
      'UPDATE members SET name = ?, role = COALESCE(?, role), upi_id = COALESCE(?, upi_id) WHERE id = ?',
      [name.trim(), role || null, upi_id !== undefined ? upi_id?.trim() : null, id]
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
    return res.status(400).json({ error: 'New PIN must be at least 4 digits' });
  }

  try {
    const memberRes = await query('SELECT pin FROM members WHERE id = ?', [id]);
    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (oldPin && memberRes.rows[0].pin.trim() !== oldPin.toString().trim()) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    await query('UPDATE members SET pin = ? WHERE id = ?', [newPin.toString().trim(), id]);
    res.json({ success: true, message: 'PIN changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
