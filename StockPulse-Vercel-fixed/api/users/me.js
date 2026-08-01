// api/users/me.js
import { handleCors, requireAuth } from '../_auth.js';
import { autoInit } from '../_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    return res.status(200).json({
      success: true,
      message: 'OK',
      data: {
        id:        user.id,
        username:  user.username,
        fullName:  user.full_name,
        email:     user.email,
        balance:   parseFloat(user.balance),
        role:      user.role,
        createdAt: user.created_at ? user.created_at.toISOString() : ''
      }
    });
  } catch (err) {
    console.error('[users/me]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
