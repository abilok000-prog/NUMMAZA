package android.provider;
import android.content.ContentResolver;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public final class Settings {
    public static final String ACTION_NOTIFICATION_LISTENER_SETTINGS = "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS";
    public static final String ACTION_APP_NOTIFICATION_SETTINGS = "android.settings.APP_NOTIFICATION_SETTINGS";
    public static final String EXTRA_APP_PACKAGE = "android.provider.extra.APP_PACKAGE";
    public static final class Secure {
        public static String getString(ContentResolver resolver, String name) { throw new RuntimeException("stub"); }
    }
}
