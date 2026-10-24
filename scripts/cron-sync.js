#!/usr/bin/env node
/**
 * Sunflower Land Farm Sync - CLI & GitHub Actions Runner
 * Reuses the canonical cron engine from api/cron-sync.js to eliminate duplication and sync drift.
 */
import handler from '../api/cron-sync.js';
import { pool } from '../api/db.js';

async function runCliSync() {
  console.log('🚀 Starting Sunflower Land Farm Sync (CLI / Action Runner)...');

  const req = { headers: {} };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      if (this.statusCode >= 400) {
        console.error('💥 Sync Failed:', data.error || data);
        process.exit(1);
      } else {
        console.log('✔ Sync Complete:', data.message || 'Done');
        if (data.processedUsers !== undefined) {
          console.log(`• Processed: ${data.processedUsers} users`);
        }
        if (data.results && data.results.length > 0) {
          data.results.forEach(r => {
            console.log(`  ✔ Successfully saved "${r.username}" (${r.totalTickets} total tickets, track: ${r.trackTickets} tix)`);
          });
        }
        if (data.errors && data.errors.length > 0) {
          console.warn(`• Errors (${data.errors.length}):`, data.errors);
        }
      }
    }
  };

  try {
    await handler(req, res);
  } catch (err) {
    console.error('💥 Fatal Cron Error:', err.message);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (e) {}
  }
}

runCliSync();
