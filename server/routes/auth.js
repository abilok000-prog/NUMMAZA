// Регистрация, вход, обновление токенов, выход, профиль аккаунта, удаление аккаунта.
import express from 'express';
import crypto from 'node:crypto';
import { resetEmail } from '../mail.js';
import { hashPassword, verifyPassword, DUMMY_HASH, newToken, sha256, normLogin, validPassword } from '../security.js';

const ACCESS_MS = 15 * 60 * 1000;           // 15 минут
const REFRESH_MS = 30 * 24 * 3600 * 1000;   // 30 дней
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

async function issueSession(db, userId, userAgent, sessionId) {
  const access = newToken();
  const refresh = newToken();
  const now = Date.now();
  const params = [sha256(access), new Date(now + ACCESS_MS), sha256(refresh), new Date(now + REFRESH_MS)];
  if (sessionId) {
    await db.query('UPDATE sessions SET access_hash=$1, access_expires=$2, refresh_hash=$3, refresh_expires=$4 WHERE id=$5', [...params, sessionId]);
  } else {
    await db.query('INSERT INTO sessions(user_id, access_hash, access_expires, refresh_hash, refresh_expires, user_agent) VALUES ($5,$1,$2,$3,$4,$6)', [...params, userId, String(userAgent || '').slice(0, 200)]);
  }
  return { accessToken: access, refreshToken: refresh, accessExpiresIn: ACCESS_MS / 1000 };
}

const publicUser = (u) => ({ id: u.id, name: u.name, login: u.login, email: u.email || (u.login.includes('@') ? u.login : null), createdAt: u.created_at });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_MS = 15 * 60 * 1000;
const RESET_GAP_MS = 60 * 1000;     // не чаще одного письма в минуту
const RESET_TRIES = 5;
const codeHash = (userId, code) => sha256(userId + ':' + code);

// Проверка access-токена: кладёт req.userId и req.sessionId
export function requireAuth(db) {
  return async (req, res, next) => {
    const m = /^Bearer\s+(\S+)$/.exec(req.get('authorization') || '');
    if (!m) return res.status(401).json({ error: 'unauthorized' });
    const { rows } = await db.query('SELECT id, user_id FROM sessions WHERE access_hash=$1 AND access_expires > now() AND revoked_at IS NULL', [sha256(m[1])]);
    if (!rows.length) return res.status(401).json({ error: 'unauthorized' });
    req.userId = rows[0].user_id;
    req.sessionId = rows[0].id;
    next();
  };
}

export function authRouter(db, opts = {}) {
  const r = express.Router();
  const mailer = opts.mailer;

  r.post('/auth/register', async (req, res) => {
    const { name, login, password } = req.body || {};
    const errors = {};
    const nm = typeof name === 'string' ? name.trim() : '';
    const lg = normLogin(login);
    if (!nm || nm.length > 60) errors.name = 'invalid';
    if (!lg) errors.login = 'invalid';
    if (!validPassword(password)) errors.password = 'invalid';
    if (Object.keys(errors).length) return res.status(400).json({ error: 'validation', fields: errors });
    const exists = await db.query('SELECT 1 FROM users WHERE login=$1', [lg]);
    if (exists.rows.length) return res.status(409).json({ error: 'login_taken' });
    let user;
    try {
      const { rows } = await db.query('INSERT INTO users(login, name, pass_hash) VALUES ($1,$2,$3) RETURNING *', [lg, nm, await hashPassword(password)]);
      user = rows[0];
    } catch (e) {
      if (String(e.code) === '23505') return res.status(409).json({ error: 'login_taken' });
      throw e;
    }
    const tokens = await issueSession(db, user.id, req.get('user-agent'));
    res.status(201).json({ user: publicUser(user), ...tokens });
  });

  r.post('/auth/login', async (req, res) => {
    const { login, password } = req.body || {};
    const lg = normLogin(login);
    if (!lg || typeof password !== 'string') return res.status(400).json({ error: 'validation', fields: { login: lg ? undefined : 'invalid' } });
    const { rows } = await db.query('SELECT * FROM users WHERE login=$1', [lg]);
    const user = rows[0];
    if (!user) {
      await verifyPassword(password, DUMMY_HASH); // одинаковое время ответа
      return res.status(401).json({ error: 'bad_credentials' });
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'locked', minutes: Math.ceil((new Date(user.locked_until) - Date.now()) / 60000) });
    }
    if (!(await verifyPassword(password, user.pass_hash))) {
      const fails = user.failed_logins + 1;
      if (fails >= MAX_FAILS) {
        await db.query('UPDATE users SET failed_logins=0, locked_until=$2 WHERE id=$1', [user.id, new Date(Date.now() + LOCK_MS)]);
        return res.status(423).json({ error: 'locked', minutes: LOCK_MS / 60000 });
      }
      await db.query('UPDATE users SET failed_logins=$2 WHERE id=$1', [user.id, fails]);
      return res.status(401).json({ error: 'bad_credentials', attemptsLeft: MAX_FAILS - fails });
    }
    await db.query('UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1', [user.id]);
    const tokens = await issueSession(db, user.id, req.get('user-agent'));
    res.json({ user: publicUser(user), ...tokens });
  });

  // Ротация: старый refresh-токен после обмена перестаёт работать
  r.post('/auth/refresh', async (req, res) => {
    const token = (req.body || {}).refreshToken;
    if (typeof token !== 'string') return res.status(400).json({ error: 'validation' });
    const { rows } = await db.query('SELECT id, user_id FROM sessions WHERE refresh_hash=$1 AND refresh_expires > now() AND revoked_at IS NULL', [sha256(token)]);
    if (!rows.length) return res.status(401).json({ error: 'unauthorized' });
    const tokens = await issueSession(db, rows[0].user_id, null, rows[0].id);
    res.json(tokens);
  });

  r.post('/auth/logout', requireAuth(db), async (req, res) => {
    await db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [req.sessionId]);
    res.json({ ok: true });
  });

  r.get('/me', requireAuth(db), async (req, res) => {
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    if (!rows.length) return res.status(401).json({ error: 'unauthorized' });
    res.json({ user: publicUser(rows[0]) });
  });

  // Почта для восстановления пароля (для входа по телефону). Пустая строка — убрать.
  r.put('/me/email', requireAuth(db), async (req, res) => {
    const raw = (req.body || {}).email;
    const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (email && (!EMAIL_RE.test(email) || email.length > 120)) return res.status(400).json({ error: 'validation', fields: { email: 'invalid' } });
    const { rows } = await db.query('UPDATE users SET email=$2 WHERE id=$1 RETURNING *', [req.userId, email || null]);
    res.json({ user: publicUser(rows[0]) });
  });

  // Забыли пароль: код на почту. Ответ всегда одинаковый — по нему не узнать, есть ли такой аккаунт.
  r.post('/auth/forgot', async (req, res) => {
    const { login, lang } = req.body || {};
    const lg = normLogin(login);
    if (!lg) return res.status(400).json({ error: 'validation', fields: { login: 'invalid' } });
    const { rows } = await db.query('SELECT * FROM users WHERE login=$1', [lg]);
    const user = rows[0];
    const email = user && (user.email || (user.login.includes('@') ? user.login : null));
    if (user && email && mailer) {
      const prev = await db.query('SELECT created_at FROM password_resets WHERE user_id=$1', [user.id]);
      const fresh = prev.rows[0] && Date.now() - new Date(prev.rows[0].created_at).getTime() < RESET_GAP_MS;
      if (!fresh) {
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await db.query(`INSERT INTO password_resets(user_id, code_hash, expires, attempts, created_at) VALUES ($1,$2,$3,0,now())
          ON CONFLICT (user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash, expires=EXCLUDED.expires, attempts=0, created_at=now()`,
          [user.id, codeHash(user.id, code), new Date(Date.now() + RESET_MS)]);
        const m = resetEmail(['ru', 'kk', 'en'].includes(lang) ? lang : 'ru', user.name, code);
        try { await mailer.send({ to: email, ...m }); } catch (e) { console.error('mail', e.message); return res.status(502).json({ error: 'mail_failed' }); }
      }
    }
    res.json({ ok: true, mail: !!(mailer && mailer.enabled) });
  });

  // Новый пароль по коду из письма: все старые сессии закрываются, устройство сразу входит
  r.post('/auth/reset', async (req, res) => {
    const { login, code, password } = req.body || {};
    const lg = normLogin(login);
    if (!lg || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return res.status(400).json({ error: 'bad_code' });
    if (!validPassword(password)) return res.status(400).json({ error: 'validation', fields: { password: 'invalid' } });
    const { rows } = await db.query('SELECT u.*, r.code_hash, r.expires, r.attempts FROM users u JOIN password_resets r ON r.user_id=u.id WHERE u.login=$1', [lg]);
    const u = rows[0];
    if (!u || new Date(u.expires) < new Date() || u.attempts >= RESET_TRIES) return res.status(400).json({ error: 'code_expired' });
    const ok = crypto.timingSafeEqual(Buffer.from(codeHash(u.id, code.trim())), Buffer.from(u.code_hash));
    if (!ok) {
      await db.query('UPDATE password_resets SET attempts=attempts+1 WHERE user_id=$1', [u.id]);
      return res.status(400).json({ error: 'bad_code', attemptsLeft: RESET_TRIES - u.attempts - 1 });
    }
    await db.query('UPDATE users SET pass_hash=$2, failed_logins=0, locked_until=NULL WHERE id=$1', [u.id, await hashPassword(password)]);
    await db.query('DELETE FROM password_resets WHERE user_id=$1', [u.id]);
    await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [u.id]);
    const tokens = await issueSession(db, u.id, req.get('user-agent'));
    res.json({ user: publicUser(u), ...tokens });
  });

  // Удаление аккаунта: сессии и все записи удаляются каскадно
  r.delete('/me', requireAuth(db), async (req, res) => {
    await db.query('DELETE FROM users WHERE id=$1', [req.userId]);
    res.json({ ok: true });
  });

  return r;
}
