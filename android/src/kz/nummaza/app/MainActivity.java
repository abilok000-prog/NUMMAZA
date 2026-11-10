package kz.nummaza.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.Executor;

/**
 * NUMMAZA для Android: веб-приложение из assets/www открывается во встроенном WebView.
 * Данные хранятся в localStorage на устройстве, интернет не нужен.
 * Нативная часть: выбор файла выписки, кнопка «Назад», «Поделиться» итогами,
 * приём выписки из других приложений (Kaspi → «Поделиться» → NUMMAZA).
 */
public class MainActivity extends Activity {
    private static final int PICK_FILE = 41;
    private static final int REQ_NOTIF = 42;
    private static final int SAVE_FILE = 43;
    private static final String POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS";
    /** Android 8–9: файл ждёт, пока пользователь выберет, куда сохранить */
    private volatile byte[] pendingSave;
    private WebView web;
    private static final int MAX_SHARED = 10 * 1024 * 1024; // как в веб-части: до 10 МБ
    private ValueCallback<Uri[]> fileCallback;
    /** Файл, полученный через «Поделиться», ждёт, пока JavaScript его заберёт (JSON или null). */
    private volatile String sharedJson;
    /** Обновления веб-части по воздуху (см. WebUpdater) */
    private WebUpdater updater;
    private final Runnable notifyUpdate = new Runnable() {
        @Override
        public void run() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (web != null) web.evaluateJavascript("window.NZ && NZ.onUpdateReady && NZ.onUpdateReady()", null);
                }
            });
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        updater = new WebUpdater(this);
        updater.prepare();
        web = new WebView(this);
        web.setBackgroundColor(0xFFF4F5F7);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                // Внешние ссылки открываем в браузере, свои страницы — внутри приложения
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (Exception ignored) { }
                    return true;
                }
                return false;
            }

            // Файлы обновления вместо встроенных (адрес страницы тот же — данные в localStorage не теряются)
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return updater.intercept(request.getUrl().toString());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "application/pdf", "text/csv", "text/comma-separated-values", "text/plain" });
                try {
                    startActivityForResult(Intent.createChooser(pick, "NUMMAZA"), PICK_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        web.addJavascriptInterface(new Bridge(), "NummazaNative");
        setContentView(web);
        if (state != null) web.restoreState(state);
        else {
            receive(getIntent());
            web.loadUrl("file:///android_asset/www/index.html");
        }
        updater.checkAsync(true, notifyUpdate);
    }

    /** Приложение уже открыто, а пользователь снова поделился файлом. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        receive(intent);
        if (sharedJson != null && web != null) {
            web.evaluateJavascript("window.NZ && NZ.app && NZ.app.pullShared && NZ.app.pullShared()", null);
        }
    }

    /** ACTION_SEND (поделиться) или ACTION_VIEW (открыть с помощью): читаем файл и готовим его для JavaScript. */
    private void receive(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_SEND.equals(action)) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        else if (Intent.ACTION_VIEW.equals(action)) uri = intent.getData();
        if (uri == null) return;
        String name = displayName(uri);
        String type = intent.getType();
        try { if (type == null) type = getContentResolver().getType(uri); } catch (Exception ignored) { }
        if (type == null) type = "";
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) throw new java.io.IOException("no stream");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[64 * 1024];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
                if (buf.size() > MAX_SHARED) { sharedJson = "{\"error\":\"size\"}"; return; }
            }
            sharedJson = "{\"name\":" + json(name) + ",\"type\":" + json(type) + ",\"data\":\""
                + Base64.getEncoder().encodeToString(buf.toByteArray()) + "\"}";
        } catch (Exception e) {
            sharedJson = "{\"error\":\"read\"}";
        }
    }

    private String displayName(Uri uri) {
        String name = null;
        try (Cursor c = getContentResolver().query(uri, new String[] { "_display_name" }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex("_display_name");
                if (i >= 0) name = c.getString(i);
            }
        } catch (Exception ignored) { }
        if (name == null || name.isEmpty()) name = uri.getLastPathSegment();
        return name == null || name.isEmpty() ? "statement.pdf" : name;
    }

    static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == '"' || ch == '\\') b.append('\\').append(ch);
            else if (ch < 0x20 || ch == 0x2028 || ch == 0x2029) b.append(String.format("\\u%04x", (int) ch));
            else b.append(ch);
        }
        return b.append('"').toString();
    }

    /** Выполнить JavaScript в странице (из любого потока) */
    private void js(final String code) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() { if (web != null) web.evaluateJavascript("window.NZ && (" + code + ")", null); }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQ_NOTIF) return;
        getSharedPreferences("reminders", MODE_PRIVATE).edit().putString("asked", "1").apply();
        js("NZ.onNotifPermission && NZ.onNotifPermission()");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == SAVE_FILE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) { out.write(bytes); ok = true; }
                } catch (Exception ignored) { }
            }
            if (resultCode == RESULT_OK) js("NZ.onFileSaved && NZ.onFileSaved(" + ok + ")");
            return;
        }
        if (requestCode == PICK_FILE && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[] { data.getData() };
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    // Вернулись в приложение (например, из настроек доступа или после покупки) — веб-приложение забирает новые уведомления
    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.NZ && NZ.onNativeResume && NZ.onNativeResume()", null);
        // Могли включить уведомления в настройках — веб-приложение обновит карточку и план напоминаний
        if (web != null) web.evaluateJavascript("window.NZ && NZ.onNotifPermission && NZ.onNotifPermission()", null);
        if (updater != null) updater.checkAsync(false, notifyUpdate);
    }

    /** Мост для JavaScript: window.NummazaNative.share(text), takeSharedFile(), уведомления банков */
    public class Bridge {
        /** Есть ли в этой сборке автоимпорт из уведомлений банков (NUMMAZA-full.apk) */
        @JavascriptInterface
        public boolean bankNotif() { return BuildInfo.BANK_NOTIF; }

        /** Включён ли доступ к уведомлениям */
        @JavascriptInterface
        public boolean notifAccess() {
            try { return BankInbox.enabled(MainActivity.this); } catch (Exception e) { return false; }
        }

        /** Открыть системный экран «Доступ к уведомлениям» */
        @JavascriptInterface
        public void openNotifSettings() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try { startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); } catch (Exception ignored) { }
                }
            });
        }

        /** Накопленные уведомления банков (JSON-массив); очередь после этого пустая */
        @JavascriptInterface
        public String pullNotifications() {
            try { return BankInbox.pull(MainActivity.this); } catch (Exception e) { return "[]"; }
        }

        /** Версия нативной части (для веб-кода: какие возможности есть в этом APK) */
        @JavascriptInterface
        public int nativeVersion() { return WebUpdater.NATIVE; }

        /** Веб-приложение успешно запустилось — обновление рабочее, откат не нужен */
        @JavascriptInterface
        public void bundleOk() { updater.confirm(); }

        /** Скачано обновление веб-части, ждёт перезапуска */
        @JavascriptInterface
        public boolean updateReady() { return updater.hasPending(); }

        /** Применить скачанное обновление и перезагрузить страницу */
        @JavascriptInterface
        public void applyUpdate() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (updater.applyPending() && web != null) web.reload();
                }
            });
        }

        /** Новая версия APK, если вышла: {"name","url"} или пустая строка */
        @JavascriptInterface
        public String apkUpdate() { return updater.apkUpdate(); }

        /** Отдаёт полученный через «Поделиться» файл один раз: {name, type, data: base64} или {error}. */
        @JavascriptInterface
        public String takeSharedFile() {
            String j = sharedJson;
            sharedJson = null;
            return j;
        }

        /* ---------- 1.3: файлы, отпечаток, напоминания, виджет ---------- */

        /** Сохранить файл (выгрузка для Excel). Android 10+: сразу в «Загрузки» → "downloads".
         *  Android 8–9: системный диалог «Сохранить как» → "picker" (итог придёт в NZ.onFileSaved). Ошибка → "". */
        @JavascriptInterface
        public String saveFile(String name, String mime, String content) {
            final String safe = (name == null ? "nummaza.csv" : name).replaceAll("[^A-Za-z0-9._-]", "_");
            final String type = mime == null || mime.isEmpty() ? "text/csv" : mime;
            final byte[] bytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_SHARED) return "";
            if (Build.VERSION.SDK_INT >= 29) {
                try {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, type);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return "";
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) return "";
                        out.write(bytes);
                    }
                    return "downloads";
                } catch (Exception e) {
                    return "";
                }
            }
            pendingSave = bytes;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(type);
                    i.putExtra(Intent.EXTRA_TITLE, safe);
                    try { startActivityForResult(i, SAVE_FILE); } catch (Exception e) { pendingSave = null; js("NZ.onFileSaved && NZ.onFileSaved(false)"); }
                }
            });
            return "picker";
        }

        /** Есть ли на телефоне отпечаток / распознавание лица (Android 10+) */
        @JavascriptInterface
        public boolean bioAvailable() {
            if (Build.VERSION.SDK_INT < 29) return false;
            try {
                BiometricManager bm = getSystemService(BiometricManager.class);
                return bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
            } catch (Exception e) {
                return false;
            }
        }

        /** Системный запрос отпечатка; результат — NZ.onBio(true|false) */
        @JavascriptInterface
        public void bioAuth(final String title, final String cancel) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT < 28) { js("NZ.onBio && NZ.onBio(false)"); return; }
                    try {
                        Executor ex = getMainExecutor();
                        BiometricPrompt p = new BiometricPrompt.Builder(MainActivity.this)
                            .setTitle(title == null || title.isEmpty() ? "NUMMAZA" : title)
                            .setNegativeButton(cancel == null || cancel.isEmpty() ? "Отмена" : cancel, ex, new DialogInterface.OnClickListener() {
                                @Override
                                public void onClick(DialogInterface d, int which) { js("NZ.onBio && NZ.onBio(false)"); }
                            })
                            .build();
                        p.authenticate(new CancellationSignal(), ex, new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) { js("NZ.onBio && NZ.onBio(true)"); }

                            @Override
                            public void onAuthenticationError(int code, CharSequence msg) { js("NZ.onBio && NZ.onBio(false)"); }
                        });
                    } catch (Exception e) {
                        js("NZ.onBio && NZ.onBio(false)");
                    }
                }
            });
        }

        /** Разрешены ли уведомления: "granted" | "default" (ещё не спрашивали) | "denied" */
        @JavascriptInterface
        public String notifPermission() {
            try {
                if (Build.VERSION.SDK_INT >= 33) {
                    if (checkSelfPermission(POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return "granted";
                    boolean asked = "1".equals(getSharedPreferences("reminders", MODE_PRIVATE).getString("asked", ""));
                    return asked && !shouldShowRequestPermissionRationale(POST_NOTIFICATIONS) ? "denied" : "default";
                }
                NotificationManager nm = getSystemService(NotificationManager.class);
                return nm == null || nm.areNotificationsEnabled() ? "granted" : "denied";
            } catch (Exception e) {
                return "granted";
            }
        }

        /** Попросить разрешение на уведомления (Android 13+), а если уже отказали — открыть настройки уведомлений приложения */
        @JavascriptInterface
        public void requestNotifPermission() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    String st = notifPermission();
                    if ("granted".equals(st)) { js("NZ.onNotifPermission && NZ.onNotifPermission()"); return; }
                    if (Build.VERSION.SDK_INT >= 33 && "default".equals(st)) {
                        requestPermissions(new String[] { POST_NOTIFICATIONS }, REQ_NOTIF);
                        return;
                    }
                    try {
                        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                        i.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                        startActivity(i);
                    } catch (Exception ignored) { }
                }
            });
        }

        /** План напоминаний из веб-приложения: JSON-массив {id, at, title, body} */
        @JavascriptInterface
        public void setReminders(String json) {
            try { Reminders.schedule(getApplicationContext(), json); } catch (Exception ignored) { }
        }

        /** Уведомление сразу (конверт заполнен на 80% и т. п.) */
        @JavascriptInterface
        public void notifyNow(String title, String body) {
            try { Reminders.show(getApplicationContext(), "now:" + title, title, body); } catch (Exception ignored) { }
        }

        /** Данные для виджета «Сегодня можно»: {label, value, sub} */
        @JavascriptInterface
        public void setWidget(String json) {
            try { BalanceWidget.save(getApplicationContext(), json); } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    try { startActivity(Intent.createChooser(send, null)); } catch (Exception ignored) { }
                }
            });
        }
    }
}
