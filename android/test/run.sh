#!/usr/bin/env bash
# Проверка обновлений по воздуху на компьютере: настоящий сервер NUMMAZA + WebUpdater с подменёнными Android-классами.
# Нужны: JDK 17+, Node 20+, python3, curl; зависимости сервера: (cd server && npm ci).
set -euo pipefail
cd "$(dirname "$0")"
TEST=$(pwd)
ROOT=$(cd ../.. && pwd)
W=$(mktemp -d)
trap 'kill "${SRV:-0}" 2>/dev/null || true; rm -rf "$W"' EXIT
SEP=':'
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) # Git Bash на Windows: Java нужны пути вида C:/… и «;» в classpath
  SEP=';'; W=$(cygpath -m "$W"); ROOT=$(cygpath -m "$ROOT"); TEST=$(cygpath -m "$TEST");;
esac
PY=python3; command -v python3 >/dev/null 2>&1 && python3 -c '' 2>/dev/null || PY=python

# org.json (на телефоне он встроен в Android)
mkdir -p "$ROOT/android/tools"
JSON="$ROOT/android/tools/json.jar"
[ -f "$JSON" ] || curl -sSfL https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar -o "$JSON"

# «APK»: встроенная версия + список sha256 (как в android/build.sh)
mkdir -p "$W/assets/www" "$W/server-app"
cp -r "$ROOT/app/." "$W/assets/www/"
"$PY" - "$W/assets/www" > "$W/assets/www-hashes.txt" <<'PY'
import hashlib, os, sys
root = sys.argv[1]
for d, _, files in sorted(os.walk(root)):
    for f in sorted(files):
        p = os.path.join(d, f)
        print(os.path.relpath(p, root).replace(os.sep, '/'), hashlib.sha256(open(p, 'rb').read()).hexdigest())
PY

# «Сервер после деплоя»: изменён core.js и добавлен новый файл
cp -r "$ROOT/app/." "$W/server-app/"
printf '\n// OTA-MARK\n' >> "$W/server-app/js/core.js"
echo "console.log('extra')" > "$W/server-app/js/extra.js"

cat > "$W/srv.mjs" <<EOF
import { pathToFileURL } from 'node:url';
const { openDb } = await import(pathToFileURL(process.argv[2] + '/server/db.js').href);
const { createApp } = await import(pathToFileURL(process.argv[2] + '/server/app.js').href);
const db = await openDb({ pglite: true });
const s = createApp(db, { appDir: process.argv[3], apkUrl: 'https://example.com/NUMMAZA.apk', apk: { versionCode: 9, versionName: '1.9' } })
  .listen(0, '127.0.0.1', () => console.log('PORT ' + s.address().port));
EOF
node "$W/srv.mjs" "$ROOT" "$W/server-app" > "$W/srv.log" 2>&1 &
SRV=$!
for _ in $(seq 1 60); do grep -q 'PORT' "$W/srv.log" && break; sleep 0.5; done
PORT=$(grep -o 'PORT [0-9]*' "$W/srv.log" | cut -d' ' -f2) || { cat "$W/srv.log"; exit 1; }

# Сборка: подменённые Android-классы + настоящий WebUpdater
mkdir -p "$W/cls"
printf 'package kz.nummaza.app;\nfinal class BuildInfo { static final int VERSION_CODE = 3; static final String VERSION_NAME = "1.2"; }\n' > "$W/BuildInfo.java"
javac -encoding UTF-8 -nowarn -cp "$JSON" -d "$W/cls" $(find "$TEST/fake" -name '*.java') "$TEST/OtaTest.java" "$ROOT/android/src/kz/nummaza/app/WebUpdater.java" "$W/BuildInfo.java"
java -cp "$W/cls$SEP$JSON" kz.nummaza.app.OtaTest "http://127.0.0.1:$PORT" "$W/assets"
