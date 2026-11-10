package android.service.notification;
import android.app.Service;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public abstract class NotificationListenerService extends Service {
    public void onNotificationPosted(StatusBarNotification sbn) { throw new RuntimeException("stub"); }
}
