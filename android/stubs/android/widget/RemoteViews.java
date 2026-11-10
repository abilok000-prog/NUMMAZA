package android.widget;
import android.app.PendingIntent;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class RemoteViews implements android.os.Parcelable {
    public RemoteViews(String packageName, int layoutId) { throw new RuntimeException("stub"); }
    public void setTextViewText(int viewId, CharSequence text) { throw new RuntimeException("stub"); }
    public void setOnClickPendingIntent(int viewId, PendingIntent pendingIntent) { throw new RuntimeException("stub"); }
}
