// api/portfolio.js — GET /api/portfolio
import { handleCors, requireAuth } from './_auth.js';
import { getDb } from './_db.js';
import { autoInit } from './_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const sql = getDb();

    const holdings = await sql`
      SELECT p.*, s.name as stock_name, s.current_price, s.predicted_price, s.change_amount
      FROM portfolio p
      LEFT JOIN stocks s ON s.symbol = p.stock_symbol
      WHERE p.user_id = ${user.id}
      ORDER BY p.stock_symbol ASC
    `;

    const freshUser = await sql`SELECT balance FROM users WHERE id = ${user.id} LIMIT 1`;
    const balance = parseFloat(freshUser[0].balance);

    let totalValue = 0;
    let totalInvested = 0;

    const holdingsData = holdings.map(p => {
      const qty = p.quantity;
      const avgBuy = parseFloat(p.average_buy_price);
      const currentPrice = parseFloat(p.current_price || 0);
      const invested = parseFloat(p.total_invested);
      const currentValue = currentPrice * qty;
      const profitLoss = currentValue - invested;
      const profitLossPct = invested > 0 ? (profitLoss / invested) * 100 : 0;
      totalValue += currentValue;
      totalInvested += invested;

      return {
        symbol:            p.stock_symbol,
        name:              p.stock_name || p.stock_symbol,
        quantity:          qty,
        averageBuyPrice:   avgBuy,
        currentPrice,
        totalInvested:     invested,
        currentValue:      +currentValue.toFixed(2),
        profitLoss:        +profitLoss.toFixed(2),
        profitLossPercent: +profitLossPct.toFixed(2),
        predictedPrice:    p.predicted_price ? parseFloat(p.predicted_price) : null,
        gaining:           parseFloat(p.change_amount || 0) >= 0
      };
    });

    const totalPL = totalValue - totalInvested;
    const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    return res.status(200).json({
      success: true,
      summary: {
        totalValue:           +totalValue.toFixed(2),
        totalInvested:        +totalInvested.toFixed(2),
        totalProfitLoss:      +totalPL.toFixed(2),
        totalProfitLossPercent: +totalPLPct.toFixed(2),
        availableBalance:     balance,
        positions:            holdings.length
      },
      holdings: holdingsData
    });
  } catch (err) {
    console.error('[portfolio]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
