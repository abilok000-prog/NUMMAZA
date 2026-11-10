// Push-уведомления для сайта (iPhone с NUMMAZA на экране «Домой», Android Chrome, компьютер).
// Устройство само считает план напоминаний (у него все данные) и присылает его сюда;
// сервер раз в минуту отправляет те, чьё время наступило.
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY — ключи (npx web-push generate-vapid-keys)
//   VAPID_SUBJECT — mailto:адрес для связи (по умолчанию mailto:admin@nummaza.kz)
import express from 'express';
import { requireAuth } from './auth.js';

const MAX_ITEMS = 60;
const okUrl = (s) => typeof s === 'string' && /^https:\/\//.test(s) && s.length < 1000;

export function pushRouter(db, sender) {
  const r = express.Router();

  r.get('/push/key', (req, res) => res.json({ key: sender ? sender.publicKey : null }));

  r.post('/push/subscribe', requireAuth(db), async (req, res) => {
    const s = (req.body || {}).subscription || {};
    const k = s.keys || {};
    if (!sender) return res.status(503).json({ error: 'push_disabled' });
    if (!okUrl(s.endpoint) || typeof k.p256dh !== 'string' || typeof k.auth !== 'string') return res.status(400).json({ error: 'validation' });
    await db.query(`INSERT INTO push_subs(user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
      ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth`, [req.userId, s.endpoint, k.p256dh, k.auth]);
    res.json({ ok: true });
  });

  r.post('/push/unsubscribe', requireAuth(db), async (req, res) => {
    const ep = (req.body || {}).endpoint;
    if (okUrl(ep)) await db.query('DELETE FROM push_subs WHERE endpoint=$1 AND user_id=$2', [ep, req.userId]);
    res.json({ ok: true });
  });

  // План напоминаний для этой подписки целиком заменяет прежний (уже отправленные не повторяются)
  r.post('/push/plan', requireAuth(db), async (req, res) => {
    const { endpoint, items } = req.body || {};
    if (!okUrl(endpoint) || !Array.isArray(items) || items.length > MAX_ITEMS) return res.status(400).json({ error: 'validation' });
    const valid = items.every((i) => i && typeof i.id === 'string' && i.id.length <= 120 && Number.isSafeInteger(i.at) &&
      typeof i.title === 'string' && i.title.length <= 120 && typeof i.body === 'string' && i.body.length <= 300);
    if (!valid) return res.status(400).json({ error: 'validation' });
    const { rows } = await db.query('SELECT id FROM push_subs WHERE endpoint=$1 AND user_id=$2', [endpoint, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'not_subscribed' });
    const sub = rows[0].id;
    await db.query('DELETE FROM push_items WHERE sub_id=$1 AND sent_at IS NULL', [sub]);
    for (const i of items) {
      await db.query(`INSERT INTO push_items(sub_id, item_id, at, title, body) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (sub_id, item_id) DO NOTHING`, [sub, i.id, new Date(i.at), i.title, i.body]);
    }
    res.json({ ok: true, planned: items.length });
  });
  return r;
}

/** Отправитель на web-push. Без ключей — null (push выключен). */
export async function createPushSender(env = process.env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:admin@nummaza.kz', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    send: (sub, payload) => webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 6 * 3600 })
  };
}

/** Один проход: отправить всё, чьё время наступило (не старше суток). Возвращает число отправленных. */
export async function pushTick(db, sender) {
  if (!sender) return 0;
  const { rows } = await db.query(`SELECT i.sub_id, i.item_id, i.title, i.body, s.endpoint, s.p256dh, s.auth
    FROM push_items i JOIN push_subs s ON s.id=i.sub_id
    WHERE i.sent_at IS NULL AND i.at <= now() AND i.at > now() - interval '1 day' ORDER BY i.at LIMIT 200`);
  let sent = 0;
  for (const x of rows) {
    await db.query('UPDATE push_items SET sent_at=now() WHERE sub_id=$1 AND item_id=$2', [x.sub_id, x.item_id]);
    try {
      await sender.send(x, JSON.stringify({ title: x.title, body: x.body, tag: x.item_id }));
      sent++;
    } catch (e) {
      // Подписка отозвана (приложение удалено, уведомления выключены) — забываем её
      if (e.statusCode === 404 || e.statusCode === 410) await db.query('DELETE FROM push_subs WHERE id=$1', [x.sub_id]);
      else console.warn('push', e.statusCode || '', e.message);
    }
  }
  await db.query("DELETE FROM push_items WHERE at < now() - interval '3 days'");
  return sent;
}
