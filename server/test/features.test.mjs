// Тесты возможностей 1.3: восстановление пароля по почте, семейный бюджет, push-напоминания, курсы валют.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { createApp } from '../app.js';
import { pushTick } from '../routes/push.js';
import { parseNbk } from '../routes/rates.js';

const mails = [];
const mailer = { enabled: true, async send(m) { mails.push(m); return { sent: true }; } };
const pushed = [];
const pushSender = { publicKey: 'BTEST', async send(sub, payload) { if (sub.endpoint.includes('gone')) { const e = new Error('gone'); e.statusCode = 410; throw e; } pushed.push({ sub, payload: JSON.parse(payload) }); } };
const ratesSource = async () => ({ USD: 447.52, EUR: 502.21, RUB: 5.41, date: '2026-11-11' });

let db, server, base;
before(async () => {
  db = await openDb({ pglite: true });
  server = createApp(db, { authLimit: 1000, mailer, pushSender, ratesSource }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await db.close(); });

async function call(method, path, body, token) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const reg = async (login, name = 'Айдана') => (await call('POST', '/api/auth/register', { name, login, password: 'nummaza2026' })).body;
const codeFrom = (m) => /(\d{6})/.exec(m.text)[1];

test('сброс пароля: почта, код, новый пароль, старые сессии закрыты', async () => {
  const u = await reg('+7 701 000 11 22');
  assert.equal(u.user.email, null);
  const none = await call('POST', '/api/auth/forgot', { login: '+77010001122' });
  assert.equal(none.status, 200);
  assert.equal(mails.length, 0, 'без почты письмо не уходит, но ответ тот же');
  assert.equal((await call('PUT', '/api/me/email', { email: 'bad' }, u.accessToken)).status, 400);
  const set = await call('PUT', '/api/me/email', { email: 'Aidana@Mail.kz' }, u.accessToken);
  assert.equal(set.body.user.email, 'aidana@mail.kz');
  assert.equal((await call('POST', '/api/auth/forgot', { login: '87010001122', lang: 'kk' })).status, 200);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'aidana@mail.kz');
  assert.match(mails[0].subject, /құпиясөз/);
  await call('POST', '/api/auth/forgot', { login: '87010001122' });
  assert.equal(mails.length, 1, 'второе письмо не раньше чем через минуту');
  const code = codeFrom(mails[0]);
  const wrong = await call('POST', '/api/auth/reset', { login: '87010001122', code: code === '000000' ? '111111' : '000000', password: 'newpass2026' });
  assert.equal(wrong.body.error, 'bad_code');
  assert.equal(wrong.body.attemptsLeft, 4);
  assert.equal((await call('POST', '/api/auth/reset', { login: '87010001122', code, password: 'short' })).status, 400);
  const ok = await call('POST', '/api/auth/reset', { login: '87010001122', code, password: 'newpass2026' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.accessToken);
  assert.equal((await call('GET', '/api/me', undefined, u.accessToken)).status, 401, 'старая сессия закрыта');
  assert.equal((await call('POST', '/api/auth/login', { login: '87010001122', password: 'newpass2026' })).status, 200);
  assert.equal((await call('POST', '/api/auth/reset', { login: '87010001122', code, password: 'newpass2027' })).body.error, 'code_expired', 'код одноразовый');
});

test('сброс пароля: вход по почте — письмо на неё же, 5 неверных кодов — код сгорает', async () => {
  await reg('mail@test.kz');
  await call('POST', '/api/auth/forgot', { login: 'MAIL@test.kz' });
  const m = mails[mails.length - 1];
  assert.equal(m.to, 'mail@test.kz');
  const code = codeFrom(m);
  const bad = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/reset', { login: 'mail@test.kz', code: bad, password: 'newpass2026' });
  assert.equal((await call('POST', '/api/auth/reset', { login: 'mail@test.kz', code, password: 'newpass2026' })).body.error, 'code_expired');
  assert.equal((await call('POST', '/api/auth/forgot', { login: 'nobody@test.kz' })).status, 200, 'неизвестный логин — тот же ответ');
});

test('семья: создать, пригласить, общие траты, лимит, выход', async () => {
  const a = await reg('fam1@test.kz', 'Айдана');
  const b = await reg('fam2@test.kz', 'Ерлан');
  const c = await reg('fam3@test.kz', 'Чужой');
  assert.equal((await call('GET', '/api/family', undefined, a.accessToken)).body.family, null);
  const f = await call('POST', '/api/family', { name: 'Семья' }, a.accessToken);
  assert.equal(f.status, 201);
  assert.equal(f.body.family.isOwner, true);
  assert.equal((await call('POST', '/api/family', { name: 'Вторая' }, a.accessToken)).status, 409);
  const inv = await call('POST', '/api/family/invite', {}, a.accessToken);
  assert.match(inv.body.code, /^[A-Z2-9]{6}$/);
  assert.equal((await call('POST', '/api/family/join', { code: 'ZZZZZZ' }, b.accessToken)).status, 404);
  const j = await call('POST', '/api/family/join', { code: inv.body.code.toLowerCase() }, b.accessToken);
  assert.equal(j.status, 200);
  assert.equal(j.body.members.length, 2);
  assert.equal((await call('POST', '/api/family/join', { code: inv.body.code }, c.accessToken)).status, 404, 'код одноразовый');
  const today = new Date().toISOString().slice(0, 10);
  await call('POST', '/api/family/sync', { mine: [{ id: 'a1', date: today, amount: -5000, cat: 'groceries', merchant: 'Magnum' }] }, a.accessToken);
  const s2 = await call('POST', '/api/family/sync', { mine: [{ id: 'b1', date: today, amount: -3000, cat: 'cafe', merchant: 'Кофе' }] }, b.accessToken);
  assert.equal(s2.body.records.length, 2, 'видны траты обоих');
  assert.equal(s2.body.records.find((r) => r.id === 'a1').merchant, 'Magnum');
  assert.equal((await call('POST', '/api/family/sync', { mine: [{ id: 'x', date: 'bad', amount: 1, cat: 'c' }] }, b.accessToken)).status, 400);
  const s3 = await call('POST', '/api/family/sync', { mine: [] }, b.accessToken);
  assert.equal(s3.body.records.length, 1, 'удалённая у себя трата исчезает и из семьи');
  assert.equal((await call('PUT', '/api/family', { limit: 300000 }, b.accessToken)).status, 403, 'лимит меняет только владелец');
  assert.equal((await call('PUT', '/api/family', { limit: 300000 }, a.accessToken)).body.family.limit, 300000);
  assert.equal((await call('GET', '/api/family', undefined, c.accessToken)).body.family, null, 'чужой не видит семью');
  await call('POST', '/api/family/leave', {}, a.accessToken);
  const after = await call('GET', '/api/family', undefined, b.accessToken);
  assert.equal(after.body.family.isOwner, true, 'владелец ушёл — владельцем стал второй участник');
  assert.equal(after.body.records.length, 0, 'траты ушедшего удалены');
  const kick = await call('POST', '/api/family/invite', {}, b.accessToken);
  await call('POST', '/api/family/join', { code: kick.body.code }, c.accessToken);
  const cId = (await call('GET', '/api/me', undefined, c.accessToken)).body.user.id;
  const k = await call('DELETE', '/api/family/members/' + cId, undefined, b.accessToken);
  assert.equal(k.body.members.length, 1);
});

test('push: подписка, план, отправка в срок, отозванная подписка удаляется', async () => {
  const u = await reg('push@test.kz');
  assert.equal((await call('GET', '/api/push/key')).body.key, 'BTEST');
  const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } };
  assert.equal((await call('POST', '/api/push/subscribe', { subscription: sub })).status, 401);
  assert.equal((await call('POST', '/api/push/subscribe', { subscription: sub }, u.accessToken)).status, 200);
  const now = Date.now();
  const plan = await call('POST', '/api/push/plan', { endpoint: sub.endpoint, items: [
    { id: 'due', at: now - 1000, title: 'Сегодня можно', body: '8 000 ₸' },
    { id: 'later', at: now + 3600000, title: 'Завтра платёж', body: 'Kaspi Red' }
  ] }, u.accessToken);
  assert.equal(plan.body.planned, 2);
  assert.equal(await pushTick(db, pushSender), 1);
  assert.equal(pushed[0].payload.title, 'Сегодня можно');
  assert.equal(await pushTick(db, pushSender), 0, 'отправленное не повторяется');
  await call('POST', '/api/push/subscribe', { subscription: { endpoint: 'https://push.example/gone', keys: { p256dh: 'p', auth: 'a' } } }, u.accessToken);
  await call('POST', '/api/push/plan', { endpoint: 'https://push.example/gone', items: [{ id: 'x', at: now - 1000, title: 't', body: 'b' }] }, u.accessToken);
  await pushTick(db, pushSender);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM push_subs WHERE endpoint LIKE '%gone'");
  assert.equal(rows[0].n, 0);
  assert.equal((await call('POST', '/api/push/plan', { endpoint: sub.endpoint, items: [{ id: 'x', at: 'soon', title: 't', body: 'b' }] }, u.accessToken)).status, 400);
});

test('курсы валют НБ РК', async () => {
  const r = await call('GET', '/api/rates');
  assert.equal(r.body.USD, 447.52);
  const xml = '<rss><item><title>USD</title><pubDate>11.11.2026</pubDate><description>447.52</description><quant>1</quant></item><item><title>RUB</title><pubDate>11.11.2026</pubDate><description>54,1</description><quant>10</quant></item></rss>';
  assert.deepEqual(parseNbk(xml), { USD: 447.52, RUB: 5.41, date: '2026-11-11' });
});

test('синхронизация принимает рассрочки и счета', async () => {
  const u = await reg('loan@test.kz');
  const r = await call('POST', '/api/sync', { cursor: 0, changes: [
    { kind: 'loan', id: 'l1', data: { name: 'iPhone 0-0-12', monthly: 45000, left: 10, next: '2026-11-20' }, updatedAt: 1 },
    { kind: 'acc', id: 'a1', data: { name: 'Наличные', cur: 'KZT', balance: 20000 }, updatedAt: 1 }
  ] }, u.accessToken);
  assert.equal(r.body.applied, 2);
});
