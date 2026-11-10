package android.provider;
import android.content.ContentResolver;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public final class Settings {
    public static final String ACTION_NOTIFICATION_LISTENER_SETTINGS = "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS";
    public static final class Secure {
        public static String getString(ContentResolver resolver, String name) { throw new RuntimeException("stub"); }
    }
}
