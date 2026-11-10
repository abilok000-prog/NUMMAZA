package kz.nummaza.app;

import android.content.Context;
import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.file.Files;

/**
 * Проверка обновлений по воздуху (WebUpdater) на компьютере, без телефона.
 * Android-классы подменены простыми рабочими версиями (test/fake), сервер — настоящий (server/), локальный.
 * Запуск: android/test/run.sh
 */
public class OtaTest {
    static int pass, fail;

    static void ok(boolean c, String m) {
        if (c) pass++; else fail++;
        System.out.println((c ? "  ✓ " : "  ✗ ") + m);
    }

    static String body(WebResourceResponse r) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] x = new byte[8192];
        int n;
        while ((n = r.data.read(x)) > 0) b.write(x, 0, n);
        r.data.close();
        return b.toString("UTF-8");
    }

    /** Проверка сервера синхронно (в приложении она идёт в фоновом потоке). */
    static boolean check(WebUpdater u) throws Exception {
        Method m = WebUpdater.class.getDeclaredMethod("check");
        m.setAccessible(true);
        try {
            return (Boolean) m.invoke(u);
        } catch (InvocationTargetException e) {
            System.out.println("    ! " + e.getCause());
            return false;
        }
    }

    public static void main(String[] a) throws Exception {
        System.setOut(new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8"));
        WebUpdater.testApiUrl = a[0];
        AssetManager.dir = new File(a[1]);
        Context.filesDir = Files.createTempDirectory("nzfiles").toFile();
        Context ctx = new Context() { };
        final String CORE = "file:///android_asset/www/js/core.js";

        System.out.println("1. Первый запуск: встроенная версия");
        WebUpdater u = new WebUpdater(ctx);
        u.prepare();
        ok(u.intercept(CORE) == null, "без обновления — файлы из APK");

        System.out.println("2. На сервере новая версия — скачиваются только изменённые файлы");
        ok(check(u), "обновление скачано");
        ok(u.hasPending(), "ждёт применения");
        File pend = new File(Context.filesDir, "ota-pending");
        ok(new File(pend, "js/core.js").isFile() && new File(pend, "js/extra.js").isFile(), "скачаны изменённый core.js и новый extra.js");
        ok(!new File(pend, "js/app.js").exists() && !new File(pend, "vendor").exists(), "неизменённые файлы (app.js, pdf.js) не скачивались");
        ok(u.intercept(CORE) == null, "до применения страница видит старую версию");

        System.out.println("3. Применение («Обновить» или следующий запуск)");
        ok(u.applyPending(), "применено");
        WebResourceResponse r = u.intercept(CORE + "?v=1");
        ok(r != null && body(r).contains("OTA-MARK"), "WebView получает новый core.js (и с ?query)");
        ok(r != null && r.mime.equals("application/javascript"), "правильный тип файла");
        ok(u.intercept("file:///android_asset/www/js/app.js") == null, "неизменённый app.js — из APK");
        ok(u.intercept("file:///android_asset/www/../shared_prefs/x") == null && u.intercept("https://evil.example/js/core.js") == null, "чужие пути и адреса не подменяются");

        System.out.println("4. Повторная проверка — та же версия, ничего не качаем");
        ok(!check(u), "без повторной загрузки");

        System.out.println("5. Откат, если новая версия не запускается");
        u.confirm();
        new WebUpdater(ctx).prepare();
        WebUpdater u3 = new WebUpdater(ctx);
        u3.prepare();
        ok(u3.intercept(CORE) != null, "после 2 запусков без подтверждения — ещё новая версия");
        WebUpdater u4 = new WebUpdater(ctx);
        u4.prepare();
        ok(u4.intercept(CORE) == null, "на 3-й запуск без bundleOk — вернулись к встроенной");
        ok(!check(u4), "сломанную версию заново не скачиваем");

        System.out.println("6. Новая версия APK");
        String apk = u4.apkUpdate();
        ok(apk.contains("\"url\":\"https://example.com/NUMMAZA.apk\"") && apk.contains("1.9"), "приложение узнаёт о новом APK: " + apk);

        System.out.println("\nИтого: " + pass + " прошло, " + fail + " упало");
        System.exit(fail > 0 ? 1 : 0);
    }
}
