import crypto from 'crypto';
import pkg from 'pg';

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}
