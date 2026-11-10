package android.content;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public abstract class Context {
    public static final int MODE_PRIVATE = 0;
    public static final String ALARM_SERVICE = "alarm";
    public static final String NOTIFICATION_SERVICE = "notification";
    public SharedPreferences getSharedPreferences(String name, int mode) { throw new RuntimeException("stub"); }
    public ContentResolver getContentResolver() { throw new RuntimeException("stub"); }
    public String getPackageName() { throw new RuntimeException("stub"); }
    public java.io.File getFilesDir() { throw new RuntimeException("stub"); }
    public android.content.res.AssetManager getAssets() { throw new RuntimeException("stub"); }
    public android.content.res.Resources getResources() { throw new RuntimeException("stub"); }
    public android.content.pm.ApplicationInfo getApplicationInfo() { throw new RuntimeException("stub"); }
    public Context getApplicationContext() { throw new RuntimeException("stub"); }
    public Object getSystemService(String name) { throw new RuntimeException("stub"); }
    public final <T> T getSystemService(Class<T> serviceClass) { throw new RuntimeException("stub"); }
    public java.util.concurrent.Executor getMainExecutor() { throw new RuntimeException("stub"); }
    public int checkSelfPermission(String permission) { throw new RuntimeException("stub"); }
}
