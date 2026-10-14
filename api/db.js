import crypto from 'crypto';
import pkg from 'pg';

const { Pool } = pkg;

// Database Connection Pool (Configured for YugabyteDB Aeon / PostgreSQL)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000
});

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}
