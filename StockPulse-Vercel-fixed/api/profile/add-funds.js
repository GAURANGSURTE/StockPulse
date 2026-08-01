// api/profile/add-funds.js — POST /api/profile/add-funds
import { handleCors, requireAuth } from '../_auth.js';
import { getDb } from '../_db.js';
import { autoInit } from '../_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const sql = getDb();
    const { amount } = req.body || {};
    const amt = parseFloat(amount);

    if (!amount || isNaN(amt) || amt <= 0)
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
    if (amt > 1000000)
      return res.status(400).json({ success: false, message: 'Maximum deposit is ₹10,00,000 at a time.' });

    const newBalance = +(parseFloat(user.balance) + amt).toFixed(2);
    await sql`UPDATE users SET balance = ${newBalance}, updated_at = NOW() WHERE id = ${user.id}`;

    return res.status(200).json({
      success: true,
      message: 'Funds added successfully.',
      data: { newBalance }
    });
  } catch (err) {
    console.error('[profile/add-funds]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
