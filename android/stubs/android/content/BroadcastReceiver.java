package android.content;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public abstract class BroadcastReceiver {
    public BroadcastReceiver() { throw new RuntimeException("stub"); }
    public abstract void onReceive(Context context, Intent intent);
}
