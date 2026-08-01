// api/profile/update.js — POST /api/profile/update
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
    const { fullName, email } = req.body || {};

    if (email && email !== user.email) {
      const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (existing.length)
        return res.status(400).json({ success: false, message: 'Email already in use by another account.' });
    }

    await sql`
      UPDATE users SET full_name = ${fullName || user.full_name}, email = ${email || user.email}, updated_at = NOW()
      WHERE id = ${user.id}
    `;

    return res.status(200).json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('[profile/update]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
