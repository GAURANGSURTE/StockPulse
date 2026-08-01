// api/profile/delete.js — POST /api/profile/delete
import { handleCors, requireAuth } from '../_auth.js';
import { getDb } from '../_db.js';
import { autoInit } from '../_stocks.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const sql = getDb();
    const { confirmPassword } = req.body || {};

    if (!confirmPassword)
      return res.status(400).json({ success: false, message: 'Password confirmation is required.' });

    const valid = await bcrypt.compare(confirmPassword, user.password);
    if (!valid)
      return res.status(400).json({ success: false, message: 'Password confirmation is incorrect. Account not deleted.' });

    // CASCADE deletes trades + portfolio due to FK constraints
    await sql`DELETE FROM users WHERE id = ${user.id}`;

    return res.status(200).json({ success: true, message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('[profile/delete]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
