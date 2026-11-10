package android.app;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class NotificationManager {
    public static final int IMPORTANCE_DEFAULT = 3;
    public NotificationChannel getNotificationChannel(String channelId) { throw new RuntimeException("stub"); }
    public void createNotificationChannel(NotificationChannel channel) { throw new RuntimeException("stub"); }
    public void notify(int id, Notification notification) { throw new RuntimeException("stub"); }
    public boolean areNotificationsEnabled() { throw new RuntimeException("stub"); }
}
