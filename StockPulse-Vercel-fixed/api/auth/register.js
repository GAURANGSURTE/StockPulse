// api/auth/register.js
import { handleCors } from '../_auth.js';
import { getDb, ensureTables } from '../_db.js';
import { autoInit } from '../_stocks.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const sql = getDb();
    const { username, email, fullName, password } = req.body || {};

    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: 'Username, email, and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    const existing = await sql`
      SELECT id FROM users WHERE username = ${username} OR email = ${email} LIMIT 1
    `;
    if (existing.length) {
      const row = existing[0];
      const checkUser = await sql`SELECT id FROM users WHERE username=${username} LIMIT 1`;
      if (checkUser.length)
        return res.status(400).json({ success: false, message: `Username already taken: ${username}` });
      return res.status(400).json({ success: false, message: `Email already registered: ${email}` });
    }

    const hash = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO users (username, email, full_name, password, balance, role)
      VALUES (${username}, ${email}, ${fullName || username}, ${hash}, 100000.00, 'ROLE_USER')
    `;

    return res.status(200).json({ success: true, message: 'Account created. You can now log in.' });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
