import { Router } from 'express';
import { query } from '../db.js';
import { verifyMemberPinOrPassword } from '../auth.js';

const router = Router();

// GET export signed-in user's isolated backup as JSON
router.get('/export', async (req, res) => {
  try {
    const membersRes = await query(
      'SELECT id, name, role, pin, upi_id, created_at FROM members WHERE user_id = ? ORDER BY id ASC',
      [req.user.id]
    );
    const expensesRes = await query(
      'SELECT id, title, date, category, amount, paid_by_member_id, split_method, notes, receipt_data, receipt_filename, created_at, updated_at FROM expenses WHERE user_id = ? ORDER BY id ASC',
      [req.user.id]
    );
    const participantsRes = await query(
      `SELECT ep.id, ep.expense_id, ep.member_id, ep.allocated_amount, ep.split_value
       FROM expense_participants ep
       JOIN expenses e ON ep.expense_id = e.id
       WHERE e.user_id = ?
       ORDER BY ep.id ASC`,
      [req.user.id]
    );
    const settlementsRes = await query(
      'SELECT id, month, payer_member_id, receiver_member_id, amount, status, payment_date, reference_note, created_at, completed_at FROM settlements WHERE user_id = ? ORDER BY id ASC',
      [req.user.id]
    );

    const backupData = {
      app: 'Monthly Shared Expense Manager',
      version: '2.0',
      exported_at: new Date().toISOString(),
      account: {
        name: req.user.name,
        email: req.user.email
      },
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

// POST restore user's own workspace from backup JSON (never touches other accounts!)
router.post('/restore', async (req, res) => {
  try {
    const { backupData, pin, authorizing_member_id } = req.body;

    if (!backupData || !backupData.data) {
      return res.status(400).json({ error: 'Invalid backup file structure' });
    }

    if (!pin) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to restore backup' });
    }

    const pinCheck = await verifyMemberPinOrPassword(req.user.id, authorizing_member_id || 'any', pin);
    if (!pinCheck.verified) {
      return res.status(401).json({ error: 'Invalid authorization password / PIN' });
    }

    const { members, expenses, expense_participants, settlements } = backupData.data;

    // Clear ONLY this signed-in user's existing records
    await query(
      'DELETE FROM expense_participants WHERE expense_id IN (SELECT id FROM expenses WHERE user_id = ?)',
      [req.user.id]
    );
    await query('DELETE FROM expenses WHERE user_id = ?', [req.user.id]);
    await query('DELETE FROM settlements WHERE user_id = ?', [req.user.id]);

    const memberIdMap = new Map();

    if (Array.isArray(members) && members.length > 0) {
      await query('DELETE FROM members WHERE user_id = ?', [req.user.id]);
      for (const m of members) {
        const inserted = await query(
          'INSERT INTO members (user_id, name, role, pin, upi_id, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
          [
            req.user.id,
            m.name,
            m.role || 'regular',
            m.pin || '1234',
            m.upi_id || null,
            m.created_at || new Date().toISOString()
          ]
        );
        memberIdMap.set(Number(m.id), inserted.lastInsertRowid);
      }
    } else {
      // Keep existing members mapped to themselves if backup didn't include members
      const currentMembers = await query('SELECT id FROM members WHERE user_id = ?', [req.user.id]);
      for (const m of currentMembers.rows) {
        memberIdMap.set(Number(m.id), Number(m.id));
      }
    }

    const expenseIdMap = new Map();
    let restoredExpenses = 0;
    let restoredParticipants = 0;
    let restoredSettlements = 0;

    if (Array.isArray(expenses) && expenses.length > 0) {
      for (const e of expenses) {
        const mappedPayerId = memberIdMap.get(Number(e.paid_by_member_id));
        if (!mappedPayerId) continue;

        const inserted = await query(
          `INSERT INTO expenses 
           (user_id, title, date, category, amount, paid_by_member_id, split_method, notes, receipt_data, receipt_filename, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          [
            req.user.id,
            e.title,
            e.date,
            e.category,
            e.amount,
            mappedPayerId,
            e.split_method,
            e.notes,
            e.receipt_data,
            e.receipt_filename,
            e.created_at || new Date().toISOString(),
            e.updated_at || new Date().toISOString()
          ]
        );
        expenseIdMap.set(Number(e.id), inserted.lastInsertRowid);
        restoredExpenses++;
      }
    }

    if (Array.isArray(expense_participants) && expense_participants.length > 0) {
      for (const ep of expense_participants) {
        const mappedExpId = expenseIdMap.get(Number(ep.expense_id));
        const mappedMemberId = memberIdMap.get(Number(ep.member_id));
        if (!mappedExpId || !mappedMemberId) continue;

        await query(
          'INSERT INTO expense_participants (expense_id, member_id, allocated_amount, split_value) VALUES (?, ?, ?, ?)',
          [mappedExpId, mappedMemberId, ep.allocated_amount, ep.split_value]
        );
        restoredParticipants++;
      }
    }

    if (Array.isArray(settlements) && settlements.length > 0) {
      for (const s of settlements) {
        const mappedPayer = memberIdMap.get(Number(s.payer_member_id));
        const mappedReceiver = memberIdMap.get(Number(s.receiver_member_id));
        if (!mappedPayer || !mappedReceiver) continue;

        await query(
          `INSERT INTO settlements 
           (user_id, month, payer_member_id, receiver_member_id, amount, status, payment_date, reference_note, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            s.month,
            mappedPayer,
            mappedReceiver,
            s.amount,
            s.status,
            s.payment_date,
            s.reference_note,
            s.created_at || new Date().toISOString(),
            s.completed_at || null
          ]
        );
        restoredSettlements++;
      }
    }

    res.json({
      success: true,
      message: 'Your backup restored successfully',
      restoredRecords: {
        members: memberIdMap.size,
        expenses: restoredExpenses,
        participants: restoredParticipants,
        settlements: restoredSettlements
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
