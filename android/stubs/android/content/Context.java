package android.content;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public abstract class Context {
    public static final int MODE_PRIVATE = 0;
    public SharedPreferences getSharedPreferences(String name, int mode) { throw new RuntimeException("stub"); }
    public ContentResolver getContentResolver() { throw new RuntimeException("stub"); }
    public String getPackageName() { throw new RuntimeException("stub"); }
}
