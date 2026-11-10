package android.app;
import android.content.Context;
import android.content.Intent;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public final class PendingIntent implements android.os.Parcelable {
    public static final int FLAG_NO_CREATE = 536870912;
    public static final int FLAG_UPDATE_CURRENT = 134217728;
    public static final int FLAG_IMMUTABLE = 67108864;
    public static PendingIntent getBroadcast(Context context, int requestCode, Intent intent, int flags) { throw new RuntimeException("stub"); }
    public static PendingIntent getActivity(Context context, int requestCode, Intent intent, int flags) { throw new RuntimeException("stub"); }
    public void cancel() { throw new RuntimeException("stub"); }
}
