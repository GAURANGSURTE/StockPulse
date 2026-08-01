// api/_stocks.js — NSE Stock simulation engine + auto-initialization
// Direct JavaScript port of StockService.java logic

import { getDb, ensureTables } from './_db.js';
import bcrypt from 'bcryptjs';

// ── NSE Symbols & Metadata ────────────────────────────────────────────────
const TRACKED_SYMBOLS = [
  'RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK',
  'WIPRO','BAJFINANCE','HINDUNILVR','SBIN','AXISBANK',
  'KOTAKBANK','LT','ITC','MARUTI','TATAMOTORS',
  'SUNPHARMA','ONGC','POWERGRID','NTPC','ULTRACEMCO'
];

const STOCK_NAMES = {
  RELIANCE:   'Reliance Industries Ltd.',
  TCS:        'Tata Consultancy Services',
  INFY:       'Infosys Ltd.',
  HDFCBANK:   'HDFC Bank Ltd.',
  ICICIBANK:  'ICICI Bank Ltd.',
  WIPRO:      'Wipro Ltd.',
  BAJFINANCE: 'Bajaj Finance Ltd.',
  HINDUNILVR: 'Hindustan Unilever Ltd.',
  SBIN:       'State Bank of India',
  AXISBANK:   'Axis Bank Ltd.',
  KOTAKBANK:  'Kotak Mahindra Bank',
  LT:         'Larsen & Toubro Ltd.',
  ITC:        'ITC Ltd.',
  MARUTI:     'Maruti Suzuki India Ltd.',
  TATAMOTORS: 'Tata Motors Ltd.',
  SUNPHARMA:  'Sun Pharmaceutical Industries',
  ONGC:       'Oil & Natural Gas Corp.',
  POWERGRID:  'Power Grid Corp. of India',
  NTPC:       'NTPC Ltd.',
  ULTRACEMCO: 'UltraTech Cement Ltd.'
};

const STOCK_SECTORS = {
  RELIANCE:   'Energy',
  TCS:        'Information Technology',
  INFY:       'Information Technology',
  HDFCBANK:   'Banking',
  ICICIBANK:  'Banking',
  WIPRO:      'Information Technology',
  BAJFINANCE: 'Financial Services',
  HINDUNILVR: 'FMCG',
  SBIN:       'Banking',
  AXISBANK:   'Banking',
  KOTAKBANK:  'Banking',
  LT:         'Infrastructure',
  ITC:        'FMCG',
  MARUTI:     'Automobile',
  TATAMOTORS: 'Automobile',
  SUNPHARMA:  'Pharmaceuticals',
  ONGC:       'Energy',
  POWERGRID:  'Utilities',
  NTPC:       'Utilities',
  ULTRACEMCO: 'Cement'
};

// Realistic NSE base prices in INR
const BASE_PRICES = [
   2950.00, 3820.00, 1580.00, 1720.00, 1245.00,
    510.00, 7100.00, 2680.00,  825.00, 1180.00,
   1790.00, 3620.00,  468.00,12450.00,  965.00,
   1520.00,  275.00,  340.00,  380.00, 9800.00
];

// ── Seeded PRNG (mirrors Java's Random(42)) ───────────────────────────────
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function gaussianRandom(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Auto-initialization ───────────────────────────────────────────────────
let _initialized = false;

/**
 * Run once per process: ensure tables exist, seed demo users + stocks.
 */
export async function autoInit() {
  if (_initialized) return;
  _initialized = true;

  try {
    await ensureTables();
    await seedDemoUsers();
    await seedStocks();
  } catch (err) {
    console.error('[autoInit] Error during initialization:', err.message);
    _initialized = false; // allow retry on next request
  }
}

async function seedDemoUsers() {
  const sql = getDb();

  const users = [
    { username: 'demo',  email: 'demo@stockpulse.com',  fullName: 'Demo Trader', password: 'demo123' },
    { username: 'admin', email: 'admin@stockpulse.com', fullName: 'Admin User',  password: 'admin123' }
  ];

  for (const u of users) {
    const existing = await sql`SELECT id FROM users WHERE username = ${u.username} LIMIT 1`;
    if (!existing.length) {
      const hash = await bcrypt.hash(u.password, 10);
      await sql`
        INSERT INTO users (username, email, full_name, password, balance, role)
        VALUES (${u.username}, ${u.email}, ${u.fullName}, ${hash}, 100000.00, 'ROLE_USER')
      `;
      console.log(`[init] Created user: ${u.username}`);
    }
  }
}

async function seedStocks() {
  const sql = getDb();
  const count = await sql`SELECT COUNT(*) as c FROM stocks`;
  if (parseInt(count[0].c) > 0) return;

  const rng = seededRandom(42);
  const stocks = TRACKED_SYMBOLS.map((symbol, i) => {
    const base = BASE_PRICES[i];
    const changePercent = gaussianRandom(rng) * 2.5;
    const change = base * changePercent / 100.0;
    const current = base + change;
    const high = current + Math.abs(gaussianRandom(rng) * base * 0.01);
    const low  = current - Math.abs(gaussianRandom(rng) * base * 0.01);
    const open = base * (1 + gaussianRandom(rng) * 0.005);
    const volume = Math.floor(Math.random() * 50000000) + 1000000;

    return {
      symbol,
      name: STOCK_NAMES[symbol] || symbol,
      currentPrice: +current.toFixed(4),
      previousClose: +base.toFixed(4),
      changeAmount: +change.toFixed(4),
      changePercent: +changePercent.toFixed(4),
      openPrice: +open.toFixed(4),
      highPrice: +high.toFixed(4),
      lowPrice: +low.toFixed(4),
      volume,
      sector: STOCK_SECTORS[symbol] || 'Others'
    };
  });

  for (const s of stocks) {
    await sql`
      INSERT INTO stocks
        (symbol, name, current_price, previous_close, change_amount, change_percent,
         open_price, high_price, low_price, volume, sector)
      VALUES
        (${s.symbol}, ${s.name}, ${s.currentPrice}, ${s.previousClose},
         ${s.changeAmount}, ${s.changePercent}, ${s.openPrice}, ${s.highPrice},
         ${s.lowPrice}, ${s.volume}, ${s.sector})
      ON CONFLICT (symbol) DO NOTHING
    `;
  }
  console.log(`[init] Seeded ${stocks.length} NSE stocks`);
}

// ── Live price simulation (called on each GET /api/stocks request) ────────
export async function refreshStockPrices() {
  const sql = getDb();
  const stocks = await sql`SELECT * FROM stocks`;
  if (!stocks.length) return;

  for (const stock of stocks) {
    const current = parseFloat(stock.current_price);
    const drift = 0.00002;
    const volatility = 0.003;
    const randomMove = gaussianRandom(Math.random) * volatility + drift;
    const newPrice = +(current * (1 + randomMove)).toFixed(4);
    const prevClose = parseFloat(stock.previous_close) || current;
    const change = +(newPrice - prevClose).toFixed(4);
    const changePct = +((change / prevClose) * 100).toFixed(4);

    await sql`
      UPDATE stocks SET
        current_price  = ${newPrice},
        change_amount  = ${change},
        change_percent = ${changePct},
        high_price     = GREATEST(high_price, ${newPrice}),
        low_price      = LEAST(low_price, ${newPrice}),
        last_updated   = NOW()
      WHERE symbol = ${stock.symbol}
    `;
  }
}

// ── Price prediction (mirrors StockService.predictPrice) ──────────────────
export function predictPrice(symbol, currentPrice, changePercent) {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed + Math.floor(Date.now() / 60000));
  const momentum    = changePercent / 100.0;
  const meanReversion = -momentum * 0.3;
  const randomNoise = (gaussianRandom(rng) * 0.01);
  const factor = 1.0 + momentum * 0.5 + meanReversion + randomNoise;
  const predicted = +(currentPrice * factor).toFixed(4);
  const confidence = +(60 + rng() * 30).toFixed(1);
  return { predicted, confidence };
}

// ── Format stock row for API response ─────────────────────────────────────
export function formatStock(s) {
  const change = parseFloat(s.change_amount || 0);
  return {
    id:                    s.id,
    symbol:                s.symbol,
    name:                  s.name,
    currentPrice:          parseFloat(s.current_price),
    previousClose:         parseFloat(s.previous_close),
    change:                change,
    changePercent:         parseFloat(s.change_percent || 0),
    openPrice:             parseFloat(s.open_price || 0),
    highPrice:             parseFloat(s.high_price || 0),
    lowPrice:              parseFloat(s.low_price || 0),
    volume:                parseInt(s.volume || 0),
    sector:                s.sector,
    predictedPrice:        s.predicted_price ? parseFloat(s.predicted_price) : null,
    predictionConfidence:  s.prediction_confidence ? parseFloat(s.prediction_confidence) : null,
    gaining:               change >= 0,
    lastUpdated:           s.last_updated ? s.last_updated.toISOString() : ''
  };
}
