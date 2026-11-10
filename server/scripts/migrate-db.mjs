// Перенос всех данных NUMMAZA из одной базы PostgreSQL в другую (например, Render → Neon).
//
//   FROM_URL='postgres://…render…' TO_URL='postgres://…neon…' node scripts/migrate-db.mjs
//
// Строки подключения берутся только из переменных окружения — так они не попадут в историю команд
// и в логи. Для проверки на компьютере можно указать папку PGlite: FROM_URL=pglite:./old TO_URL=pglite:./new
//
// Что делает:
//   1) создаёт в новой базе те же таблицы (schema.sql, как при запуске сервера);
//   2) копирует все таблицы с теми же id, пачками, в порядке зависимостей; повторный запуск
//      не создаёт дублей (ON CONFLICT DO NOTHING) — если связь оборвалась, просто запустите снова;
//   3) переносит счётчик records_seq, чтобы синхронизация телефонов продолжилась без пропусков;
//   4) сверяет количество строк в каждой таблице и печатает итог.
// Старую базу скрипт только читает.
import { openDb } from '../db.js';

const TABLES = ['users', 'sessions', 'records', 'password_resets', 'push_subs', 'push_items', 'families', 'family_members', 'family_invites', 'family_records'];
const BATCH = 200;

const conn = (u) => (u.startsWith('pglite:') ? { pglite: u.slice(7) || true } : { url: u });
const hide = (u) => (u.startsWith('pglite:') ? u : u.replace(/\/\/([^:@/]+)(:[^@/]*)?@/, '//$1:***@'));

export async function migrate(fromUrl, toUrl, log = console.log) {
  if (!fromUrl || !toUrl) throw new Error('Задайте FROM_URL (старая база) и TO_URL (новая база)');
  if (fromUrl === toUrl) throw new Error('FROM_URL и TO_URL совпадают');
  log('Старая база: ' + hide(fromUrl));
  log('Новая база:  ' + hide(toUrl));
  const src = await openDb(conn(fromUrl));
  const dst = await openDb(conn(toUrl)); // создаёт таблицы
  const report = [];
  try {
    for (const t of TABLES) {
      const exists = (await src.query('SELECT to_regclass($1) AS r', ['public.' + t])).rows[0].r;
      if (!exists) { report.push({ t, from: 0, to: 0, note: 'нет в старой базе' }); continue; }
      const cols = (await dst.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [t])).rows.map((r) => r.column_name);
      const srcCols = new Set((await src.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [t])).rows.map((r) => r.column_name));
      const use = cols.filter((c) => srcCols.has(c));
      const list = use.map((c) => '"' + c + '"').join(',');
      const total = +(await src.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
      let done = 0;
      for (let off = 0; off < total; off += BATCH) {
        // ctid — физический порядок строк: стабилен, пока старую базу никто не меняет (сервер на время переноса лучше остановить)
        const rows = (await src.query(`SELECT ${list} FROM ${t} ORDER BY ctid LIMIT ${BATCH} OFFSET ${off}`)).rows;
        if (!rows.length) break;
        const params = [];
        const values = rows.map((r) => '(' + use.map((c) => { const v = r[c]; params.push(v !== null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v); return '$' + params.length; }).join(',') + ')');
        await dst.query(`INSERT INTO ${t} (${list}) VALUES ${values.join(',')} ON CONFLICT DO NOTHING`, params);
        done += rows.length;
      }
      const after = +(await dst.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
      report.push({ t, from: total, to: after });
      log(`  ${t}: ${done} из ${total} → в новой базе ${after}`);
    }
    // Счётчик изменений: новая база должна продолжать с того же места (иначе телефоны пропустят изменения)
    const seqSrc = (await src.query('SELECT last_value, is_called FROM records_seq')).rows[0];
    const maxSeq = +((await dst.query('SELECT coalesce(max(seq),0)::bigint AS m FROM records')).rows[0].m);
    const next = Math.max(+seqSrc.last_value, maxSeq, 1);
    await dst.query('SELECT setval($1, $2, true)', ['records_seq', next]);
    log(`  records_seq: ${next}`);
  } finally {
    await src.close();
    await dst.close();
  }
  const bad = report.filter((r) => r.to < r.from);
  log(bad.length ? '\nВНИМАНИЕ: перенесено не всё: ' + bad.map((r) => r.t).join(', ') + '. Запустите скрипт ещё раз.' : '\nГотово: все таблицы перенесены, количество строк совпадает.');
  return { report, ok: !bad.length };
}

if ((process.argv[1] || '').split('\\').join('/').endsWith('scripts/migrate-db.mjs')) {
  migrate(process.env.FROM_URL, process.env.TO_URL).then((r) => process.exit(r.ok ? 0 : 1)).catch((e) => { console.error('Ошибка: ' + e.message); process.exit(1); });
}
