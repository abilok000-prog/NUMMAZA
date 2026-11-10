package android.app;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class AlarmManager {
    public static final int RTC_WAKEUP = 0;
    public void setAndAllowWhileIdle(int type, long triggerAtMillis, PendingIntent operation) { throw new RuntimeException("stub"); }
    public void cancel(PendingIntent operation) { throw new RuntimeException("stub"); }
}
