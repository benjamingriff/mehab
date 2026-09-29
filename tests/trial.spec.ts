import { test, expect } from '@playwright/test';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pool, migrate } from '../apps/api/src/db';
const account = { userId: randomUUID(), token: randomBytes(32).toString('hex') };
test.beforeAll(async () => {
  await migrate();
  await pool.query('INSERT INTO users(id,name) VALUES($1,$2)', [account.userId, 'Trial']);
  await pool.query('INSERT INTO tokens(id,user_id,hash,name) VALUES($1,$2,$3,$4)', [
    randomUUID(),
    account.userId,
    createHash('sha256').update(account.token).digest('hex'),
    'Browser test',
  ]);
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed.ts'], {
    env: { ...process.env, API_TOKEN: account.token },
    stdio: 'pipe',
  });
});
test.afterAll(async () => {
  const users = [account.userId];
  for (const table of ['assessment_responses', 'completion_events', 'sessions'])
    await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::uuid[])`, [users]);
  await pool.query(
    'DELETE FROM assessment_versions WHERE assessment_id IN(SELECT id FROM assessments WHERE user_id=ANY($1::uuid[]))',
    [users],
  );
  await pool.query('DELETE FROM assessments WHERE user_id=ANY($1::uuid[])', [users]);
  await pool.query(
    'DELETE FROM programme_versions WHERE programme_id IN(SELECT id FROM programmes WHERE user_id=ANY($1::uuid[]))',
    [users],
  );
  for (const table of ['programmes', 'exercises', 'tokens'])
    await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::uuid[])`, [users]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
  await pool.end();
});
test('connect, read the whole session, complete offline, reload, sync, check in, and see progress', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource'))
      errors.push(msg.text());
  });
  await page.goto('/');
  await page.getByLabel('Server address').fill('http://localhost:3000');
  await page.getByLabel('Personal access token').fill(account.token);
  await page.getByRole('button', { name: 'Connect my account' }).click();
  await expect(page.getByText('Your plan for today', { exact: true })).toBeVisible();
  await expect(page.getByText('Morning mobility', { exact: true })).toBeVisible();
  await expect(page.getByText('Midday reset', { exact: true })).toBeVisible();
  await expect(page.getByText('Evening mobility', { exact: true })).toBeVisible();
  await expect(page.getByText('Neck strength', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/today.png', fullPage: true });
  await page.getByText('Morning mobility', { exact: true }).click();
  await expect(page.getByText('Cervical rotation', { exact: true })).toBeVisible();
  await expect(page.getByText('Chin tuck', { exact: true })).toBeVisible();
  await expect(page.getByText('Thoracic extension', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'How to do it' }).first().click();
  await expect(
    page.getByText('Sit tall with your shoulders relaxed.', { exact: true }),
  ).toBeVisible();
  // Reset if this repeatable trial test has been run before.
  const undo = page.getByText('Undo completion', { exact: true });
  if (await undo.count()) await undo.click();
  await page.screenshot({ path: 'artifacts/session.png', fullPage: true });
  await page.route('http://localhost:3000/**', (route) => route.abort());
  await page.getByRole('button', { name: 'Mark session complete', exact: true }).click();
  await expect(page.getByText('A little stronger.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('A little stronger.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to today', exact: true }).click();
  await page.getByText('Daily check-in', { exact: true }).click();
  await page.getByRole('radio', { name: 'Pain 3', exact: true }).click();
  await page.getByRole('radio', { name: 'Stiffness 4', exact: true }).click();
  await page.getByRole('radio', { name: 'Mild', exact: true }).click();
  await page.getByLabel('Anything you’d like to note?').fill('Browser trial: saved while offline.');
  await page.screenshot({ path: 'artifacts/check-in.png', fullPage: true });
  await page.getByRole('button', { name: 'Save check-in', exact: true }).click();
  await expect(page.getByText('A moment, noted.', { exact: true })).toBeVisible();
  await page.reload();
  await page.goto('/settings');
  await expect(page.getByText('2 changes saved on this device', { exact: true })).toBeVisible();
  await page.unroute('http://localhost:3000/**');
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByText('Everything is up to date', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.goto('/progress');
  await expect(page.getByText('Pain', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText('Browser trial: saved while offline.', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/progress.png', fullPage: true });
  await page.goto('/programme');
  await expect(page.getByText('Settle & mobilise', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/programme.png', fullPage: true });
  // A revoked mobile token must not strand locally saved changes.
  const tokenResponse = await request.post('http://localhost:3000/tokens', {
    headers: { authorization: `Bearer ${account.token}` },
    data: { name: 'Replacement' },
  });
  const replacement = await tokenResponse.json();
  await pool.query('UPDATE tokens SET revoked_at=now() WHERE user_id=$1 AND hash=$2', [
    account.userId,
    createHash('sha256').update(account.token).digest('hex'),
  ]);
  await page.goto('/');
  await page.getByText('Midday reset', { exact: true }).click();
  await page.getByRole('button', { name: 'Skip this session', exact: true }).click();
  await expect(page.getByText('Space for a rest.', { exact: true })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByText('1 change saved on this device', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Replace access token', exact: true }).click();
  await page.getByLabel('Replacement token').fill(replacement.token);
  await page.getByRole('button', { name: 'Save new token', exact: true }).click();
  await expect(page.getByText('Everything is up to date', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
