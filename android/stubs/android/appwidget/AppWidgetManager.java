package android.appwidget;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class AppWidgetManager {
    public static AppWidgetManager getInstance(Context context) { throw new RuntimeException("stub"); }
    public int[] getAppWidgetIds(ComponentName provider) { throw new RuntimeException("stub"); }
    public void updateAppWidget(int appWidgetId, RemoteViews views) { throw new RuntimeException("stub"); }
}
