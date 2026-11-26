import { Router } from 'express';
import { query } from '../db.js';
import { verifyMemberPinOrPassword } from '../auth.js';
import { getMonthSettlementSummary } from '../settlementEngine.js';

const router = Router();

// GET settlement summary for a month (scoped to signed-in user)
router.get('/summary', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Valid month query (YYYY-MM) is required' });
    }

    const summary = await getMonthSettlementSummary(month, req.user.id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST record completed settlement transfer (scoped to signed-in user)
router.post('/complete', async (req, res) => {
  try {
    const {
      month,
      payer_member_id,
      receiver_member_id,
      amount,
      payment_date,
      reference_note,
      pin,
      authorizing_member_id
    } = req.body;

    if (!month || !payer_member_id || !receiver_member_id || !amount) {
      return res.status(400).json({ error: 'Missing required settlement details' });
    }

    if (Number(payer_member_id) === Number(receiver_member_id)) {
      return res.status(400).json({ error: 'Payer and Receiver cannot be the same member' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Transfer amount must be greater than zero' });
    }

    if (!pin || !authorizing_member_id) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to complete settlement' });
    }

    const pinCheck = await verifyMemberPinOrPassword(req.user.id, authorizing_member_id, pin);
    if (!pinCheck.verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    const membersRes = await query('SELECT id FROM members WHERE user_id = ?', [req.user.id]);
    const ownedIds = new Set(membersRes.rows.map((m) => Number(m.id)));
    if (!ownedIds.has(Number(payer_member_id)) || !ownedIds.has(Number(receiver_member_id))) {
      return res.status(403).json({ error: 'Settlement members do not belong to your account' });
    }

    const dateStr = payment_date || new Date().toISOString().slice(0, 10);
    await query(
      `INSERT INTO settlements 
       (user_id, month, payer_member_id, receiver_member_id, amount, status, payment_date, reference_note, completed_at)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.id, month, Number(payer_member_id), Number(receiver_member_id), numAmount, dateStr, reference_note || null]
    );

    const updatedSummary = await getMonthSettlementSummary(month, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Settlement transfer marked as paid',
      summary: updatedSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST reverse a completed settlement (scoped to signed-in user)
router.post('/:id/reverse', async (req, res) => {
  try {
    const { id } = req.params;
    const { month, pin, authorizing_member_id } = req.body;

    if (!pin || !authorizing_member_id) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to reverse settlement' });
    }

    const pinCheck = await verifyMemberPinOrPassword(req.user.id, authorizing_member_id, pin);
    if (!pinCheck.verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    const check = await query('SELECT * FROM settlements WHERE id = ? AND user_id = ?', [Number(id), req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Settlement record not found' });
    }

    const targetMonth = month || check.rows[0].month;

    await query('DELETE FROM settlements WHERE id = ? AND user_id = ?', [Number(id), req.user.id]);

    const updatedSummary = await getMonthSettlementSummary(targetMonth, req.user.id);
    res.json({
      success: true,
      message: 'Settlement payment reversed successfully',
      summary: updatedSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
