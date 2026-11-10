package kz.nummaza.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Напоминания без сервера: веб-приложение считает план (утром — «сколько можно потратить»,
 * накануне — «завтра платёж») и отдаёт его сюда. План хранится в SharedPreferences,
 * будильники ставит AlarmManager, после перезагрузки телефона их восстанавливает BootReceiver.
 * Будильники неточные (setAndAllowWhileIdle): система может сдвинуть их на несколько минут — так
 * не нужно разрешение на точные будильники, и батарея не страдает.
 */
final class Reminders {
    static final String CHANNEL = "reminders";
    static final String ACTION = "kz.nummaza.app.REMINDER";
    private static final String PREFS = "reminders";
    private static final String KEY_PLAN = "plan";
    private static final String KEY_CODES = "codes";
    private static final int MAX = 40;

    private Reminders() {}

    /** Новый план (JSON-массив {id, at, title, body}): старые будильники снимаются, новые ставятся. */
    static synchronized void schedule(Context ctx, String json) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        cancelAll(ctx, sp.getString(KEY_CODES, ""));
        sp.edit().putString(KEY_PLAN, json == null ? "[]" : json).apply();
        arm(ctx, json);
    }

    /** После перезагрузки или обновления приложения: заново ставим ещё не наступившие напоминания. */
    static synchronized void restore(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        arm(ctx, sp.getString(KEY_PLAN, "[]"));
    }

    private static void arm(Context ctx, String json) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        StringBuilder codes = new StringBuilder();
        long now = System.currentTimeMillis();
        try {
            JSONArray arr = new JSONArray(json == null ? "[]" : json);
            int n = Math.min(arr.length(), MAX);
            for (int i = 0; i < n; i++) {
                JSONObject o = arr.getJSONObject(i);
                long at = o.optLong("at", 0);
                if (at <= now) continue;
                int code = 1000 + i;
                PendingIntent pi = PendingIntent.getBroadcast(ctx, code, intent(ctx, o.optString("id", ""), o.optString("title", "NUMMAZA"), o.optString("body", "")),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                if (codes.length() > 0) codes.append(',');
                codes.append(code);
            }
        } catch (Exception ignored) { /* испорченный план — просто без напоминаний */ }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_CODES, codes.toString()).apply();
    }

    private static void cancelAll(Context ctx, String codes) {
        if (codes == null || codes.isEmpty()) return;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        for (String c : codes.split(",")) {
            try {
                PendingIntent pi = PendingIntent.getBroadcast(ctx, Integer.parseInt(c.trim()), intent(ctx, "", "", ""), PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pi != null) { am.cancel(pi); pi.cancel(); }
            } catch (Exception ignored) { }
        }
    }

    private static Intent intent(Context ctx, String id, String title, String body) {
        Intent i = new Intent(ctx, ReminderReceiver.class);
        i.setAction(ACTION);
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("body", body);
        return i;
    }

    /** Показать уведомление сейчас (напоминание наступило или «конверт заполнен на 80%»). */
    static void show(Context ctx, String id, String title, String body) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Напоминания NUMMAZA", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Сколько можно потратить, платежи и конверты");
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int icon = ctx.getResources().getIdentifier("ic_stat", "drawable", ctx.getPackageName());
        Notification.Builder b = new Notification.Builder(ctx, CHANNEL)
            .setSmallIcon(icon != 0 ? icon : ctx.getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setColor(0xFF0B6E64)
            .setAutoCancel(true)
            .setContentIntent(pi);
        try { nm.notify(id == null || id.isEmpty() ? (int) (System.currentTimeMillis() & 0x7fffffff) : id.hashCode(), b.build()); }
        catch (SecurityException ignored) { /* Android 13+: уведомления не разрешены */ }
    }
}
