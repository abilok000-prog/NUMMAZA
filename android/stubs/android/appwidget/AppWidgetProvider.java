package android.appwidget;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class AppWidgetProvider extends BroadcastReceiver {
    public AppWidgetProvider() { throw new RuntimeException("stub"); }
    public void onReceive(Context context, Intent intent) { throw new RuntimeException("stub"); }
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) { throw new RuntimeException("stub"); }
}
