// Описание текущей веб-версии для обновлений «по воздуху».
// GET /api/bundle → { id, version, files: [{ p, h, s }], minNative, apk }
//   id        — хеш всех файлов: поменялся хотя бы один файл → новый id
//   files     — путь, sha256, размер. Android-приложение скачивает только изменившиеся файлы.
//   minNative — минимальная версия нативной части (NATIVE в MainActivity), которой подходит этот код
//   apk       — последняя версия APK и ссылка на скачивание (если задана APK_URL)
// js/config.js не входит: в APK там свой адрес сервера, а сайт отдаёт его сам.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SKIP = new Set(['js/config.js']);

function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

/** Номер и название версии APK из android/build.sh (VERSION_CODE / VERSION_NAME по умолчанию). */
export function readApkVersion(buildSh) {
  try {
    const s = fs.readFileSync(buildSh, 'utf8');
    const code = /VERSION_CODE=\$\{VERSION_CODE:-(\d+)\}/.exec(s);
    const name = /VERSION_NAME=\$\{VERSION_NAME:-([\w.]+)\}/.exec(s);
    return code ? { versionCode: Number(code[1]), versionName: name ? name[1] : String(code[1]) } : null;
  } catch (e) {
    return null;
  }
}

export function buildManifest(appDir, opts = {}) {
  const files = walk(appDir).filter((p) => !SKIP.has(p)).map((p) => {
    const buf = fs.readFileSync(path.join(appDir, p));
    return { p, h: crypto.createHash('sha256').update(buf).digest('hex'), s: buf.length };
  });
  const id = crypto.createHash('sha256').update(files.map((f) => f.p + ':' + f.h).join('\n')).digest('hex').slice(0, 16);
  let version = null;
  try { version = (/NZ\.VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(appDir, 'js/core.js'), 'utf8')) || [])[1] || null; } catch (e) { /* нет core.js */ }
  const m = { id, version, minNative: Number(opts.minNative) || 0, files };
  if (opts.apkUrl && opts.apk) m.apk = { ...opts.apk, url: opts.apkUrl };
  return m;
}
