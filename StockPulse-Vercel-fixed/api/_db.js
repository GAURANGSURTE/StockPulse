// api/_db.js — Neon Postgres shared connection pool
// Automatically creates all tables on first run (mirrors the MySQL schema)

import { neon } from '@neondatabase/serverless';

let _sql = null;

export function getDb() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is not set. Please configure it in your Vercel dashboard or .env.local file.');
    _sql = neon(url);
  }
  return _sql;
}

/**
 * Ensure all required tables exist. Called once per cold start.
 * Using IF NOT EXISTS so it is idempotent and safe to call repeatedly.
 */
export async function ensureTables() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id         BIGSERIAL PRIMARY KEY,
      username   VARCHAR(50)  UNIQUE NOT NULL,
      email      VARCHAR(100) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      balance    DECIMAL(15,2) DEFAULT 100000.00,
      full_name  VARCHAR(100),
      role       VARCHAR(20)  DEFAULT 'ROLE_USER',
      created_at TIMESTAMP    DEFAULT NOW(),
      updated_at TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stocks (
      id                   BIGSERIAL PRIMARY KEY,
      symbol               VARCHAR(20)  UNIQUE NOT NULL,
      name                 VARCHAR(100) NOT NULL,
      current_price        DECIMAL(15,4) DEFAULT 0,
      previous_close       DECIMAL(15,4) DEFAULT 0,
      change_amount        DECIMAL(15,4) DEFAULT 0,
      change_percent       DECIMAL(10,4) DEFAULT 0,
      open_price           DECIMAL(15,4) DEFAULT 0,
      high_price           DECIMAL(15,4) DEFAULT 0,
      low_price            DECIMAL(15,4) DEFAULT 0,
      volume               BIGINT        DEFAULT 0,
      sector               VARCHAR(50),
      predicted_price      DECIMAL(15,4),
      prediction_confidence DECIMAL(5,2),
      last_updated         TIMESTAMP     DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id             BIGSERIAL PRIMARY KEY,
      user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stock_symbol   VARCHAR(20) NOT NULL,
      trade_type     VARCHAR(10) NOT NULL,
      quantity       INT    NOT NULL,
      price_per_share DECIMAL(15,4) NOT NULL,
      total_amount   DECIMAL(15,2) NOT NULL,
      fee            DECIMAL(15,2) NOT NULL DEFAULT 0,
      status         VARCHAR(20)  DEFAULT 'COMPLETED',
      executed_at    TIMESTAMP    DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS portfolio (
      id               BIGSERIAL PRIMARY KEY,
      user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stock_symbol     VARCHAR(20) NOT NULL,
      quantity         INT    NOT NULL DEFAULT 0,
      average_buy_price DECIMAL(15,4) NOT NULL DEFAULT 0,
      total_invested   DECIMAL(15,2) NOT NULL DEFAULT 0,
      UNIQUE(user_id, stock_symbol)
    )
  `;
}
