package kz.nummaza.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebResourceResponse;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Обновление веб-части «по воздуху», без переустановки APK.
 *
 * Сервер описывает текущую веб-версию (GET /api/bundle: пути и sha256 файлов). Файлы, которые отличаются
 * от встроенных в APK (assets/www), скачиваются в ota-pending/, проверяются по sha256 и при следующем
 * запуске (или по кнопке «Обновить») становятся активными в ota/. Страница по-прежнему открывается
 * с file:///android_asset/www/ — WebView просто получает новые файлы вместо встроенных
 * (shouldInterceptRequest). Адрес страницы не меняется, поэтому данные в localStorage остаются на месте.
 *
 * Защита: только https-адрес из config.js, проверка sha256 и размера каждого файла, пути без «..».
 * Если новая версия дважды не запустилась (JS не вызвал bundleOk), приложение возвращается к встроенной.
 */
final class WebUpdater {
    /** Версия нативной части. Сервер не пришлёт веб-код, которому нужна более новая (minNative). */
    static final int NATIVE = 2; // 2 — версия 1.3: файлы, отпечаток, напоминания, виджет
    private static final String PREFIX = "file:///android_asset/www/";
    private static final long CHECK_EVERY_MS = 30L * 60 * 1000;
    private static final long MAX_TOTAL = 30L * 1024 * 1024;
    /** Путь вида js/app.js: латиница, цифры, «_», «-», «.», сегменты через «/»; «..» отдельно запрещён ниже. */
    private static final Pattern SAFE = Pattern.compile("^[A-Za-z0-9_\\-][A-Za-z0-9_.\\-]*(/[A-Za-z0-9_\\-][A-Za-z0-9_.\\-]*)*$");

    private final Context ctx;
    private final File active, pending, tmp;
    private final SharedPreferences prefs;
    /** Файлы активного обновления: путь → sha256 */
    private volatile Map<String, String> activeFiles = new HashMap<>();
    private volatile boolean checking;

    WebUpdater(Context ctx) {
        this.ctx = ctx;
        File base = ctx.getFilesDir();
        active = new File(base, "ota");
        pending = new File(base, "ota-pending");
        tmp = new File(base, "ota-tmp");
        prefs = ctx.getSharedPreferences("web_update", Context.MODE_PRIVATE);
    }

    /** Перед загрузкой страницы: применить скачанное обновление; откатиться, если новая версия не запускается. */
    void prepare() {
        applyPending();
        if (active.isDirectory()) {
            int starts = parseInt(prefs.getString("starts", "0")) + 1;
            if (starts > 2) { // два запуска подряд без bundleOk — возвращаемся к встроенной версии
                String bad = readId(active);
                delete(active);
                prefs.edit().putString("starts", "0").putString("broken", bad).apply();
            } else {
                prefs.edit().putString("starts", String.valueOf(starts)).apply();
            }
        }
        activeFiles = readFiles(active);
    }

    /** JS успешно отрисовал приложение. */
    void confirm() { prefs.edit().putString("starts", "0").apply(); }

    boolean hasPending() { return new File(pending, "manifest.txt").isFile(); }

    /** Применить скачанное обновление (при запуске или по кнопке «Обновить»). */
    synchronized boolean applyPending() {
        if (!hasPending()) return false;
        File old = new File(ctx.getFilesDir(), "ota-old");
        delete(old);
        if (active.exists() && !active.renameTo(old)) return false;
        if (!pending.renameTo(active)) { old.renameTo(active); return false; }
        delete(old);
        prefs.edit().putString("starts", "0").apply();
        activeFiles = readFiles(active);
        return true;
    }

    /** Подмена файла для WebView: новый файл из ota/, если он есть, иначе null (встроенный из APK). */
    WebResourceResponse intercept(String url) {
        if (url == null || !url.startsWith(PREFIX)) return null;
        String rel = url.substring(PREFIX.length());
        int cut = rel.indexOf('?');
        if (cut < 0) cut = rel.indexOf('#');
        if (cut >= 0) rel = rel.substring(0, cut);
        if (!activeFiles.containsKey(rel) || !SAFE.matcher(rel).matches()) return null;
        File f = new File(active, rel);
        try {
            return new WebResourceResponse(mime(rel), rel.endsWith(".woff2") || rel.endsWith(".png") ? null : "UTF-8", new FileInputStream(f));
        } catch (IOException e) {
            return null;
        }
    }

    /** Последняя версия APK, если она новее установленной: {"name","url"} или "". */
    String apkUpdate() {
        String url = prefs.getString("apk_url", "");
        int code = parseInt(prefs.getString("apk_code", "0"));
        if (url.isEmpty() || code <= BuildInfo.VERSION_CODE) return "";
        return "{\"name\":" + MainActivity.json(prefs.getString("apk_name", "")) + ",\"url\":" + MainActivity.json(url) + "}";
    }

    /** Проверить сервер в фоне (не чаще раза в 30 минут, force — сразу). onReady вызывается, когда обновление скачано. */
    void checkAsync(boolean force, final Runnable onReady) {
        long last = parseLong(prefs.getString("last_check", "0"));
        if (checking || (!force && System.currentTimeMillis() - last < CHECK_EVERY_MS)) return;
        checking = true;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (check() && onReady != null) onReady.run();
                    prefs.edit().putString("last_check", String.valueOf(System.currentTimeMillis())).apply();
                } catch (Exception ignored) {
                    // нет сети или сервер спит — попробуем в следующий раз
                } finally {
                    checking = false;
                }
            }
        }, "nummaza-update").start();
    }

    /** true — скачано новое обновление. */
    private boolean check() throws Exception {
        String api = apiUrl();
        if (api == null) return false;
        JSONObject m = new JSONObject(new String(get(api + "/api/bundle", 2L * 1024 * 1024), "UTF-8"));

        JSONObject apk = m.optJSONObject("apk");
        if (apk != null && apk.optString("url", "").startsWith("https://")) {
            prefs.edit().putString("apk_code", String.valueOf(apk.optInt("versionCode", 0)))
                .putString("apk_name", apk.optString("versionName", "")).putString("apk_url", apk.optString("url", "")).apply();
        }

        String id = m.getString("id");
        if (m.optInt("minNative", 0) > NATIVE) return false;
        if (id.equals(prefs.getString("broken", ""))) return false;
        if (id.equals(readId(pending)) || (!hasPending() && id.equals(readId(active)))) return false;

        Map<String, String> builtIn = assetHashes();
        Map<String, String> have = readFiles(active);
        JSONArray files = m.getJSONArray("files");
        delete(tmp);
        if (!tmp.mkdirs()) throw new IOException("mkdir");
        StringBuilder list = new StringBuilder(id).append('\n');
        long total = 0;
        for (int i = 0; i < files.length(); i++) {
            JSONObject f = files.getJSONObject(i);
            String p = f.getString("p"), h = f.getString("h");
            long size = f.optLong("s", -1);
            if (!SAFE.matcher(p).matches() || p.contains("..")) throw new IOException("bad path " + p);
            if (h.equals(builtIn.get(p))) continue; // такой же, как в APK — не нужен
            File out = new File(tmp, p);
            out.getParentFile().mkdirs();
            byte[] data;
            if (h.equals(have.get(p))) data = readFile(new File(active, p)); // уже скачан раньше
            else {
                total += Math.max(size, 0);
                if (total > MAX_TOTAL) throw new IOException("too big");
                data = get(api + "/" + p, Math.max(size, 0) + 1);
            }
            if ((size >= 0 && data.length != size) || !h.equals(sha256(data))) throw new IOException("hash " + p);
            try (OutputStream os = new FileOutputStream(out)) { os.write(data); }
            list.append(p).append(' ').append(h).append('\n');
        }
        try (OutputStream os = new FileOutputStream(new File(tmp, "manifest.txt"))) { os.write(list.toString().getBytes("UTF-8")); }
        synchronized (this) {
            delete(pending);
            if (!tmp.renameTo(pending)) throw new IOException("rename");
        }
        return true;
    }

    /** Только для теста на компьютере (android/test): адрес локального сервера. В приложении всегда null. */
    static String testApiUrl;

    /** Адрес сервера из встроенного config.js (только https). */
    private String apiUrl() {
        if (testApiUrl != null) return testApiUrl;
        try (InputStream in = ctx.getAssets().open("www/js/config.js")) {
            Matcher mt = Pattern.compile("API_URL\\s*=\\s*'(https://[^']+)'").matcher(new String(readAll(in, 64 * 1024), "UTF-8"));
            return mt.find() ? mt.group(1).replaceAll("/+$", "") : null;
        } catch (IOException e) {
            return null;
        }
    }

    /** sha256 встроенных файлов (android/build.sh кладёт www-hashes.txt рядом с www/). */
    private Map<String, String> assetHashes() {
        Map<String, String> out = new HashMap<>();
        try (InputStream in = ctx.getAssets().open("www-hashes.txt")) {
            BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"));
            String line;
            while ((line = r.readLine()) != null) {
                int sp = line.lastIndexOf(' ');
                if (sp > 0) out.put(line.substring(0, sp), line.substring(sp + 1));
            }
        } catch (IOException ignored) { /* нет списка — скачаем всё */ }
        return out;
    }

    private static Map<String, String> readFiles(File dir) {
        Map<String, String> out = new HashMap<>();
        File mf = new File(dir, "manifest.txt");
        if (!mf.isFile()) return out;
        try {
            String[] lines = new String(readFile(mf), "UTF-8").split("\n");
            for (int i = 1; i < lines.length; i++) {
                int sp = lines[i].lastIndexOf(' ');
                if (sp > 0) out.put(lines[i].substring(0, sp), lines[i].substring(sp + 1));
            }
        } catch (IOException ignored) { }
        return out;
    }

    private static String readId(File dir) {
        File mf = new File(dir, "manifest.txt");
        if (!mf.isFile()) return "";
        try { return new String(readFile(mf), "UTF-8").split("\n")[0].trim(); } catch (IOException e) { return ""; }
    }

    private static byte[] get(String url, long limit) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream()) { return readAll(in, limit); }
        } finally {
            c.disconnect();
        }
    }

    private static byte[] readAll(InputStream in, long limit) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[64 * 1024];
        int n;
        while ((n = in.read(chunk)) > 0) {
            buf.write(chunk, 0, n);
            if (buf.size() > limit) throw new IOException("too big");
        }
        return buf.toByteArray();
    }

    private static byte[] readFile(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) { return readAll(in, MAX_TOTAL); }
    }

    static String sha256(byte[] data) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder b = new StringBuilder();
            for (byte x : d) b.append(String.format("%02x", x & 0xff));
            return b.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String mime(String p) {
        String e = p.substring(p.lastIndexOf('.') + 1).toLowerCase();
        switch (e) {
            case "html": return "text/html";
            case "js": case "mjs": return "application/javascript";
            case "css": return "text/css";
            case "json": case "webmanifest": return "application/json";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "woff2": return "font/woff2";
            case "ttf": return "font/ttf";
            default: return "application/octet-stream";
        }
    }

    private static void delete(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) delete(k);
        f.delete();
    }

    private static int parseInt(String s) { try { return Integer.parseInt(s); } catch (Exception e) { return 0; } }
    private static long parseLong(String s) { try { return Long.parseLong(s); } catch (Exception e) { return 0; } }
}
