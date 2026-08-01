// api/_auth.js — JWT authentication middleware
// Validates Bearer token and returns the authenticated user row

import jwt from 'jsonwebtoken';
import { getDb } from './_db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'stockpulse-dev-secret-change-in-production-32chars';

/**
 * Sign a JWT for a user.
 * @param {object} payload - { id, username, role }
 * @returns {string} signed JWT (expires in 7 days)
 */
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Middleware: parse + verify Bearer token, load user from DB.
 * Sends 401 if missing / invalid / expired.
 * @returns {object|null} user row or null (response already sent)
 */
export async function requireAuth(req, res) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    return null;
  }

  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
    return null;
  }

  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE id = ${decoded.id} LIMIT 1`;
  if (!rows.length) {
    res.status(401).json({ success: false, message: 'User not found.' });
    return null;
  }
  return rows[0];
}

/**
 * Handle preflight OPTIONS request for CORS.
 * Returns true if the request was handled (caller should return).
 */
export function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
