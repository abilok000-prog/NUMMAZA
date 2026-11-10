package kz.nummaza.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Виджет «Сегодня можно» на главном экране. Сумму считает веб-приложение (там все данные) и
 * передаёт через мост setWidget при каждом изменении; виджет показывает последнюю переданную.
 */
public class BalanceWidget extends AppWidgetProvider {
    private static final String PREFS = "widget";
    private static final String KEY = "data";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    /** Новые данные из веб-приложения: {label, value, sub} */
    static void save(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json == null ? "" : json).apply();
        refresh(ctx);
    }

    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        if (mgr == null) return;
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, BalanceWidget.class));
        if (ids != null && ids.length > 0) render(ctx, mgr, ids);
    }

    private static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        String pkg = ctx.getPackageName();
        int layout = ctx.getResources().getIdentifier("widget_balance", "layout", pkg);
        if (layout == 0) return;
        String label = "Сегодня можно потратить";
        String value = "—";
        String sub = "Откройте NUMMAZA";
        try {
            String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "");
            if (raw != null && !raw.isEmpty()) {
                JSONObject o = new JSONObject(raw);
                label = o.optString("label", label);
                value = o.optString("value", value);
                sub = o.optString("sub", "");
            }
        } catch (Exception ignored) { }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(pkg, layout);
            v.setTextViewText(ctx.getResources().getIdentifier("w_label", "id", pkg), label);
            v.setTextViewText(ctx.getResources().getIdentifier("w_value", "id", pkg), value);
            v.setTextViewText(ctx.getResources().getIdentifier("w_sub", "id", pkg), sub);
            v.setOnClickPendingIntent(ctx.getResources().getIdentifier("w_root", "id", pkg), pi);
            mgr.updateAppWidget(id, v);
        }
    }
}
