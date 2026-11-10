package android.content;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public interface SharedPreferences {
    String getString(String key, String defValue);
    Editor edit();
    interface Editor {
        Editor putString(String key, String value);
        void apply();
        boolean commit();
    }
}
