import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { pool, migrate } from './db.js';
await migrate();
const name = process.argv[2] || 'My account';
const userId = process.argv[3] || randomUUID();
const token = `rehab_${randomBytes(32).toString('hex')}`;
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query('INSERT INTO users(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING', [
    userId,
    name,
  ]);
  await c.query('INSERT INTO tokens(id,user_id,hash,name) VALUES($1,$2,$3,$4)', [
    randomUUID(),
    userId,
    createHash('sha256').update(token).digest('hex'),
    'Initial personal token',
  ]);
  await c.query('COMMIT');
} finally {
  c.release();
  await pool.end();
}
console.log(JSON.stringify({ userId, token }, null, 2));
