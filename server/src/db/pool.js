import pg from 'pg';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in.');
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export function query(text, params) {
  return pool.query(text, params);
}
