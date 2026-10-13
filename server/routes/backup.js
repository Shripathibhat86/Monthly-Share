import { Router } from 'express';
import { query, isPg, sqliteDb } from '../db.js';

const router = Router();

// GET export complete database backup as JSON
router.get('/export', async (req, res) => {
  try {
    const membersRes = await query('SELECT * FROM members ORDER BY id ASC');
    const expensesRes = await query('SELECT * FROM expenses ORDER BY id ASC');
    const participantsRes = await query('SELECT * FROM expense_participants ORDER BY id ASC');
    const settlementsRes = await query('SELECT * FROM settlements ORDER BY id ASC');

    const backupData = {
      app: 'Monthly Shared Expense Manager',
      version: '1.0',
      exported_at: new Date().toISOString(),
      data: {
        members: membersRes.rows,
        expenses: expensesRes.rows,
        expense_participants: participantsRes.rows,
        settlements: settlementsRes.rows
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="expense_backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(backupData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST restore database from backup JSON (PIN protected)
router.post('/restore', async (req, res) => {
  try {
    const { backupData, pin, authorizing_member_id } = req.body;

    if (!backupData || !backupData.data) {
      return res.status(400).json({ error: 'Invalid backup file structure' });
    }

    if (pin && authorizing_member_id) {
      const pinRes = await query('SELECT pin FROM members WHERE id = ?', [authorizing_member_id]);
      if (pinRes.rows.length === 0 || pinRes.rows[0].pin.trim() !== pin.toString().trim()) {
        return res.status(401).json({ error: 'Invalid authorization PIN' });
      }
    }

    const { members, expenses, expense_participants, settlements } = backupData.data;

    // Clear existing data safely
    await query('DELETE FROM expense_participants');
    await query('DELETE FROM expenses');
    await query('DELETE FROM settlements');

    if (members && members.length > 0) {
      await query('DELETE FROM members');
      for (const m of members) {
        await query(
          'INSERT INTO members (id, name, role, pin, created_at) VALUES (?, ?, ?, ?, ?)',
          [m.id, m.name, m.role || 'regular', m.pin || '1234', m.created_at || new Date().toISOString()]
        );
      }
    }

    if (expenses && expenses.length > 0) {
      for (const e of expenses) {
        await query(
          `INSERT INTO expenses 
           (id, title, date, category, amount, paid_by_member_id, split_method, notes, receipt_data, receipt_filename, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id,
            e.title,
            e.date,
            e.category,
            e.amount,
            e.paid_by_member_id,
            e.split_method,
            e.notes,
            e.receipt_data,
            e.receipt_filename,
            e.created_at,
            e.updated_at
          ]
        );
      }
    }

    if (expense_participants && expense_participants.length > 0) {
      for (const ep of expense_participants) {
        await query(
          'INSERT INTO expense_participants (id, expense_id, member_id, allocated_amount, split_value) VALUES (?, ?, ?, ?, ?)',
          [ep.id, ep.expense_id, ep.member_id, ep.allocated_amount, ep.split_value]
        );
      }
    }

    if (settlements && settlements.length > 0) {
      for (const s of settlements) {
        await query(
          `INSERT INTO settlements 
           (id, month, payer_member_id, receiver_member_id, amount, status, payment_date, reference_note, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.month,
            s.payer_member_id,
            s.receiver_member_id,
            s.amount,
            s.status,
            s.payment_date,
            s.reference_note,
            s.created_at,
            s.completed_at
          ]
        );
      }
    }

    res.json({
      success: true,
      message: 'Database backup restored successfully',
      restoredRecords: {
        members: members?.length || 0,
        expenses: expenses?.length || 0,
        participants: expense_participants?.length || 0,
        settlements: settlements?.length || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
