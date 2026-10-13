import { Router } from 'express';
import { query } from '../db.js';
import { getMonthSettlementSummary } from '../settlementEngine.js';

const router = Router();

// GET settlement summary for a month
router.get('/summary', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Valid month query (YYYY-MM) is required' });
    }

    const summary = await getMonthSettlementSummary(month);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST record completed settlement transfer
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

    // PIN check if provided
    if (pin && authorizing_member_id) {
      const pinRes = await query('SELECT pin FROM members WHERE id = ?', [authorizing_member_id]);
      if (pinRes.rows.length === 0 || pinRes.rows[0].pin.trim() !== pin.toString().trim()) {
        return res.status(401).json({ error: 'Invalid PIN authorization' });
      }
    }

    // Insert completed settlement
    const dateStr = payment_date || new Date().toISOString().slice(0, 10);
    await query(
      `INSERT INTO settlements 
       (month, payer_member_id, receiver_member_id, amount, status, payment_date, reference_note, completed_at)
       VALUES (?, ?, ?, ?, 'completed', ?, ?, CURRENT_TIMESTAMP)`,
      [month, Number(payer_member_id), Number(receiver_member_id), numAmount, dateStr, reference_note || null]
    );

    // Return updated summary
    const updatedSummary = await getMonthSettlementSummary(month);
    res.status(201).json({
      success: true,
      message: 'Settlement transfer marked as paid',
      summary: updatedSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST reverse a completed settlement
router.post('/:id/reverse', async (req, res) => {
  try {
    const { id } = req.params;
    const { month, pin, authorizing_member_id } = req.body;

    if (pin && authorizing_member_id) {
      const pinRes = await query('SELECT pin FROM members WHERE id = ?', [authorizing_member_id]);
      if (pinRes.rows.length === 0 || pinRes.rows[0].pin.trim() !== pin.toString().trim()) {
        return res.status(401).json({ error: 'Invalid PIN authorization' });
      }
    }

    const check = await query('SELECT * FROM settlements WHERE id = ?', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Settlement record not found' });
    }

    const targetMonth = month || check.rows[0].month;

    // Delete the settlement record to reverse it
    await query('DELETE FROM settlements WHERE id = ?', [id]);

    const updatedSummary = await getMonthSettlementSummary(targetMonth);
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
