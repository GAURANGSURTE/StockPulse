// api/auth/login.js
import { handleCors, signToken } from '../_auth.js';
import { getDb } from '../_db.js';
import { autoInit } from '../_stocks.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const sql = getDb();
    const { username, password } = req.body || {};

    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username and password are required.' });

    const rows = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });

    const token = signToken({ id: user.id, username: user.username, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id:       user.id,
        username: user.username,
        fullName: user.full_name,
        email:    user.email,
        balance:  parseFloat(user.balance),
        role:     user.role
      }
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
