package kz.nummaza.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

/**
 * Очередь уведомлений банков на устройстве (SharedPreferences, только внутри приложения).
 * Сервис уведомлений добавляет записи, веб-приложение забирает их через мост и очищает очередь.
 * Хранится не больше MAX записей: если приложение долго не открывали, старые вытесняются.
 */
final class BankInbox {
    private static final String PREFS = "bank_inbox";
    private static final String KEY = "items";
    private static final int MAX = 300;
    private static final Object LOCK = new Object();

    // Пакеты банковских приложений Казахстана: сверяем по части имени пакета
    private static final String[] BANKS = { "kaspi", "halyk", "freedom", "ffin", "jusan", "bcc", "forte", "homecredit", "eubank", "altyn", "otbasy", "berekebank" };

    private BankInbox() {}

    static boolean isBank(String pkg) {
        if (pkg == null) return false;
        String p = pkg.toLowerCase();
        if (p.startsWith("kz.nummaza")) return false;
        for (String b : BANKS) if (p.contains(b)) return true;
        return false;
    }

    static void add(Context ctx, String pkg, String title, String text, long time) {
        String item = "{\"pkg\":" + q(pkg) + ",\"title\":" + q(title) + ",\"text\":" + q(text) + ",\"time\":" + time + "}";
        synchronized (LOCK) {
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String cur = sp.getString(KEY, "");
            String[] lines = cur.isEmpty() ? new String[0] : cur.split("\n");
            StringBuilder sb = new StringBuilder();
            int from = Math.max(0, lines.length - (MAX - 1));
            for (int i = from; i < lines.length; i++) sb.append(lines[i]).append('\n');
            sb.append(item);
            sp.edit().putString(KEY, sb.toString()).apply();
        }
    }

    /** JSON-массив накопленных уведомлений; очередь очищается. */
    static String pull(Context ctx) {
        synchronized (LOCK) {
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String cur = sp.getString(KEY, "");
            sp.edit().putString(KEY, "").apply();
            return "[" + cur.replace("\n", ",") + "]";
        }
    }

    /** Включён ли доступ к уведомлениям для NUMMAZA (Настройки → Доступ к уведомлениям). */
    static boolean enabled(Context ctx) {
        String list = Settings.Secure.getString(ctx.getContentResolver(), "enabled_notification_listeners");
        return list != null && list.contains(ctx.getPackageName());
    }

    // Строка → JSON-строка (переводы строк экранируются, поэтому одна запись = одна строка очереди)
    private static String q(String s) {
        if (s == null) return "\"\"";
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20 || c == 0x2028 || c == 0x2029) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.append('"').toString();
    }
}
