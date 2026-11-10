// Семейный бюджет: общая семья на несколько аккаунтов, приглашение по коду, общие траты и лимит на месяц.
// Каждый участник присылает свои «семейные» траты за последние 120 дней целиком (POST /family/sync):
// сервер заменяет его записи этим списком и возвращает траты всей семьи. Личные операции не видны никому.
import express from 'express';
import crypto from 'node:crypto';
import { requireAuth } from './auth.js';

const WINDOW_DAYS = 120;
const MAX_MEMBERS = 8;
const INVITE_MS = 48 * 3600 * 1000;
const ISO = /^\d{4}-\d\d-\d\d$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих 0/O, 1/I

const since = () => new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);

async function myFamily(db, userId) {
  const { rows } = await db.query('SELECT f.* FROM families f JOIN family_members m ON m.family_id=f.id WHERE m.user_id=$1', [userId]);
  return rows[0] || null;
}

async function snapshot(db, userId) {
  const f = await myFamily(db, userId);
  if (!f) return { family: null };
  const members = (await db.query('SELECT u.id, u.name, m.joined_at FROM family_members m JOIN users u ON u.id=m.user_id WHERE m.family_id=$1 ORDER BY m.joined_at', [f.id])).rows;
  const recs = (await db.query('SELECT user_id, rec_id, data FROM family_records WHERE family_id=$1 AND date >= $2 ORDER BY date DESC LIMIT 3000', [f.id, since()])).rows;
  return {
    family: { id: f.id, name: f.name, limit: Number(f.month_limit), owner: f.owner, isOwner: f.owner === userId },
    members: members.map((m) => ({ id: m.id, name: m.name, me: m.id === userId, owner: m.id === f.owner })),
    records: recs.map((r) => ({ id: r.rec_id, by: r.user_id, ...r.data }))
  };
}

function validRec(x) {
  return x && typeof x.id === 'string' && x.id.length <= 100 && ISO.test(x.date) && Number.isFinite(x.amount) && Math.abs(x.amount) < 1e12 &&
    typeof x.cat === 'string' && x.cat.length <= 40 && (x.merchant == null || (typeof x.merchant === 'string' && x.merchant.length <= 120));
}

export function familyRouter(db) {
  const r = express.Router();
  const auth = requireAuth(db);

  r.get('/family', auth, async (req, res) => res.json(await snapshot(db, req.userId)));

  r.post('/family', auth, async (req, res) => {
    const name = String((req.body || {}).name || '').trim();
    if (!name || name.length > 40) return res.status(400).json({ error: 'validation', fields: { name: 'invalid' } });
    if (await myFamily(db, req.userId)) return res.status(409).json({ error: 'already_in_family' });
    const { rows } = await db.query('INSERT INTO families(name, owner) VALUES ($1,$2) RETURNING id', [name, req.userId]);
    await db.query('INSERT INTO family_members(user_id, family_id) VALUES ($1,$2)', [req.userId, rows[0].id]);
    res.status(201).json(await snapshot(db, req.userId));
  });

  // Только владелец: название и лимит семьи на месяц
  r.put('/family', auth, async (req, res) => {
    const f = await myFamily(db, req.userId);
    if (!f) return res.status(404).json({ error: 'no_family' });
    if (f.owner !== req.userId) return res.status(403).json({ error: 'owner_only' });
    const b = req.body || {};
    const name = b.name === undefined ? f.name : String(b.name).trim();
    const limit = b.limit === undefined ? Number(f.month_limit) : Number(b.limit);
    if (!name || name.length > 40 || !Number.isSafeInteger(limit) || limit < 0) return res.status(400).json({ error: 'validation' });
    await db.query('UPDATE families SET name=$2, month_limit=$3 WHERE id=$1', [f.id, name, limit]);
    res.json(await snapshot(db, req.userId));
  });

  r.post('/family/invite', auth, async (req, res) => {
    const f = await myFamily(db, req.userId);
    if (!f) return res.status(404).json({ error: 'no_family' });
    const n = (await db.query('SELECT count(*)::int AS n FROM family_members WHERE family_id=$1', [f.id])).rows[0].n;
    if (n >= MAX_MEMBERS) return res.status(409).json({ error: 'family_full' });
    let code = '';
    for (let i = 0; i < 6; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    const expires = new Date(Date.now() + INVITE_MS);
    await db.query('DELETE FROM family_invites WHERE expires < now()');
    await db.query('INSERT INTO family_invites(code, family_id, expires) VALUES ($1,$2,$3)', [code, f.id, expires]);
    res.json({ code, expires: expires.toISOString() });
  });

  r.post('/family/join', auth, async (req, res) => {
    const code = String((req.body || {}).code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ error: 'bad_code' });
    if (await myFamily(db, req.userId)) return res.status(409).json({ error: 'already_in_family' });
    const { rows } = await db.query('SELECT family_id FROM family_invites WHERE code=$1 AND expires > now()', [code]);
    if (!rows.length) return res.status(404).json({ error: 'bad_code' });
    const n = (await db.query('SELECT count(*)::int AS n FROM family_members WHERE family_id=$1', [rows[0].family_id])).rows[0].n;
    if (n >= MAX_MEMBERS) return res.status(409).json({ error: 'family_full' });
    await db.query('INSERT INTO family_members(user_id, family_id) VALUES ($1,$2)', [req.userId, rows[0].family_id]);
    await db.query('DELETE FROM family_invites WHERE code=$1', [code]);
    res.json(await snapshot(db, req.userId));
  });

  async function removeMember(familyId, userId) {
    await db.query('DELETE FROM family_records WHERE family_id=$1 AND user_id=$2', [familyId, userId]);
    await db.query('DELETE FROM family_members WHERE family_id=$1 AND user_id=$2', [familyId, userId]);
    const rest = (await db.query('SELECT user_id FROM family_members WHERE family_id=$1 ORDER BY joined_at', [familyId])).rows;
    if (!rest.length) await db.query('DELETE FROM families WHERE id=$1', [familyId]);
    else await db.query('UPDATE families SET owner=$2 WHERE id=$1 AND (owner IS NULL OR owner NOT IN (SELECT user_id FROM family_members WHERE family_id=$1))', [familyId, rest[0].user_id]);
  }

  // Выйти из семьи: мои общие траты удаляются; если ушёл владелец — владельцем становится самый давний участник
  r.post('/family/leave', auth, async (req, res) => {
    const f = await myFamily(db, req.userId);
    if (f) await removeMember(f.id, req.userId);
    res.json({ family: null });
  });

  r.delete('/family/members/:id', auth, async (req, res) => {
    const f = await myFamily(db, req.userId);
    if (!f) return res.status(404).json({ error: 'no_family' });
    if (f.owner !== req.userId) return res.status(403).json({ error: 'owner_only' });
    if (req.params.id === req.userId) return res.status(400).json({ error: 'validation' });
    const m = await db.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2', [f.id, req.params.id]);
    if (m.rows.length) await removeMember(f.id, req.params.id);
    res.json(await snapshot(db, req.userId));
  });

  r.post('/family/sync', auth, async (req, res) => {
    const f = await myFamily(db, req.userId);
    if (!f) return res.json({ family: null });
    const mine = (req.body || {}).mine;
    if (!Array.isArray(mine) || mine.length > 2000 || !mine.every(validRec)) return res.status(400).json({ error: 'validation' });
    const from = since();
    const ids = [];
    for (const x of mine) {
      if (x.date < from) continue;
      ids.push(x.id);
      await db.query(`INSERT INTO family_records(family_id, user_id, rec_id, date, data) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (family_id, user_id, rec_id) DO UPDATE SET date=EXCLUDED.date, data=EXCLUDED.data`,
        [f.id, req.userId, x.id, x.date, { date: x.date, amount: Math.round(x.amount), cat: x.cat, merchant: x.merchant || '' }]);
    }
    await db.query('DELETE FROM family_records WHERE family_id=$1 AND user_id=$2 AND NOT (rec_id = ANY($3::text[]))', [f.id, req.userId, ids]);
    res.json(await snapshot(db, req.userId));
  });

  return r;
}
