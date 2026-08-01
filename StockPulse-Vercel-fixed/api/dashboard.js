// api/dashboard.js — GET /api/dashboard
import { handleCors, requireAuth } from './_auth.js';
import { getDb } from './_db.js';
import { autoInit, formatStock } from './_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const sql = getDb();

    // Portfolio summary
    const holdings = await sql`
      SELECT p.*, s.current_price FROM portfolio p
      LEFT JOIN stocks s ON s.symbol = p.stock_symbol
      WHERE p.user_id = ${user.id}
    `;
    let totalValue = 0, totalInvested = 0;
    holdings.forEach(p => {
      totalValue    += parseFloat(p.current_price || 0) * p.quantity;
      totalInvested += parseFloat(p.total_invested);
    });
    const totalPL = totalValue - totalInvested;
    const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    // Gainers / Losers
    const gainers = await sql`SELECT * FROM stocks ORDER BY change_percent DESC LIMIT 5`;
    const losers  = await sql`SELECT * FROM stocks ORDER BY change_percent ASC  LIMIT 5`;

    // JDBC-style stats (raw SQL aggregates)
    const userCount  = await sql`SELECT COUNT(*) as c FROM users`;
    const topGainers = await sql`
      SELECT symbol, change_percent FROM stocks ORDER BY change_percent DESC LIMIT 3
    `;
    const tradeSummary = await sql`
      SELECT u.username, COUNT(t.id) as trade_count, SUM(t.total_amount) as total_volume
      FROM users u LEFT JOIN trades t ON t.user_id = u.id
      GROUP BY u.id, u.username ORDER BY trade_count DESC LIMIT 5
    `;

    return res.status(200).json({
      user: {
        username: user.username,
        fullName: user.full_name || user.username,
        balance:  parseFloat(user.balance)
      },
      portfolioValue:           +totalValue.toFixed(2),
      totalInvested:            +totalInvested.toFixed(2),
      totalProfitLoss:          +totalPL.toFixed(2),
      totalProfitLossPercent:   +totalPLPct.toFixed(2),
      positions:                holdings.length,
      gainers:                  gainers.map(formatStock),
      losers:                   losers.map(formatStock),
      jdbcStats: {
        totalUsers:       parseInt(userCount[0].c),
        topGainersJdbc:   topGainers,
        userTradeSummary: tradeSummary
      }
    });
  } catch (err) {
    console.error('[dashboard]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
