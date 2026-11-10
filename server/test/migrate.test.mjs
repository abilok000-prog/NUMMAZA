// Перенос базы (Render → Neon): все таблицы, те же id, счётчик синхронизации, повторный запуск без дублей.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../db.js';
import { createApp } from '../app.js';
import { migrate } from '../scripts/migrate-db.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nz-mig-'));
const OLD = path.join(tmp, 'old');
const NEW = path.join(tmp, 'new');

async function withServer(dir, fn) {
  const db = await openDb({ pglite: dir });
  const server = createApp(db, { authLimit: 1000, ratesSource: async () => ({ USD: 1, EUR: 1, RUB: 1 }) }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (p, { method = 'GET', body, token } = {}) => {
    const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try { return await fn(call, db); } finally { server.close(); await db.close(); }
}

test('перенос базы: данные, вход, синхронизация и семья работают в новой базе', async () => {
  let seqOld;
  await withServer(OLD, async (call) => {
    const a = await call('/auth/register', { method: 'POST', body: { name: 'Айдана', login: '+77011112233', password: 'nummaza2026' } });
    assert.equal(a.status, 201);
    const tok = a.body.accessToken;
    const changes = [];
    for (let i = 0; i < 450; i++) changes.push({ kind: 'tx', id: 't' + i, data: { id: 't' + i, amount: -100 - i, merchant: 'Магазин «Ақ» ' + i }, updatedAt: 1000 + i });
    changes.push({ kind: 'loan', id: 'l1', data: { id: 'l1', name: 'iPhone', monthly: 45000, left: 10, next: '2026-11-20' }, updatedAt: 5000 });
    const s = await call('/sync', { method: 'POST', token: tok, body: { cursor: 0, changes } });
    assert.equal(s.status, 200);
    seqOld = s.body.cursor;
    const f = await call('/family', { method: 'POST', token: tok, body: { name: 'Семья' } });
    assert.equal(f.status, 201);
    await call('/family/sync', { method: 'POST', token: tok, body: { mine: [{ id: 't1', date: '2026-11-04', amount: -500, cat: 'cafe', merchant: 'Кофе' }] } });
  });

  const logs = [];
  const r = await migrate('pglite:' + OLD, 'pglite:' + NEW, (m) => logs.push(m));
  assert.ok(r.ok, logs.join('\n'));
  const counts = Object.fromEntries(r.report.map((x) => [x.t, x.to]));
  assert.equal(counts.users, 1);
  assert.equal(counts.records, 451);
  assert.equal(counts.families, 1);
  assert.equal(counts.family_records, 1);

  // Повторный запуск (например, после обрыва связи) — без дублей
  const again = await migrate('pglite:' + OLD, 'pglite:' + NEW, () => {});
  assert.equal(again.report.find((x) => x.t === 'records').to, 451);

  await withServer(NEW, async (call, db) => {
    const l = await call('/auth/login', { method: 'POST', body: { login: '+77011112233', password: 'nummaza2026' } });
    assert.equal(l.status, 200, 'вход старым паролем в новой базе');
    const tok = l.body.accessToken;
    const all = await call('/sync', { method: 'POST', token: tok, body: { cursor: 0, changes: [] } });
    assert.equal(all.body.changes.length, 451);
    assert.equal(all.body.changes.find((c) => c.id === 't7').data.merchant, 'Магазин «Ақ» 7', 'jsonb и кириллица/казахские буквы сохранены');
    // Новое изменение получает номер больше старых — телефоны с курсором из старой базы его не пропустят
    const next = await call('/sync', { method: 'POST', token: tok, body: { cursor: seqOld, changes: [{ kind: 'tx', id: 'new1', data: { id: 'new1', amount: -1 }, updatedAt: 9999 }] } });
    assert.ok(next.body.cursor > seqOld, `курсор ${next.body.cursor} > ${seqOld}`);
    const fam = await call('/family', { token: tok });
    assert.equal(fam.body.family.name, 'Семья');
    assert.equal(fam.body.records.length, 1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n >= 1, true);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('перенос: без адресов баз — понятная ошибка', async () => {
  await assert.rejects(() => migrate('', ''), /FROM_URL/);
  await assert.rejects(() => migrate('pglite:x', 'pglite:x'), /совпадают/);
});
