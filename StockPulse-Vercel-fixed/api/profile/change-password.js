// api/profile/change-password.js — POST /api/profile/change-password
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
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    if (newPassword !== confirmPassword)
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid)
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password = ${hash}, updated_at = NOW() WHERE id = ${user.id}`;

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[profile/change-password]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
