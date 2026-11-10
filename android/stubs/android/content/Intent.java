package android.content;
import android.net.Uri;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class Intent implements android.os.Parcelable {
    public static final String ACTION_GET_CONTENT = "android.intent.action.GET_CONTENT";
    public static final String ACTION_SEND = "android.intent.action.SEND";
    public static final String ACTION_VIEW = "android.intent.action.VIEW";
    public static final String ACTION_CREATE_DOCUMENT = "android.intent.action.CREATE_DOCUMENT";
    public static final String ACTION_BOOT_COMPLETED = "android.intent.action.BOOT_COMPLETED";
    public static final String ACTION_MY_PACKAGE_REPLACED = "android.intent.action.MY_PACKAGE_REPLACED";
    public static final String CATEGORY_OPENABLE = "android.intent.category.OPENABLE";
    public static final String EXTRA_MIME_TYPES = "android.intent.extra.MIME_TYPES";
    public static final String EXTRA_TEXT = "android.intent.extra.TEXT";
    public static final String EXTRA_STREAM = "android.intent.extra.STREAM";
    public static final String EXTRA_TITLE = "android.intent.extra.TITLE";
    public static final int FLAG_ACTIVITY_NEW_TASK = 268435456;
    public static final int FLAG_ACTIVITY_CLEAR_TOP = 67108864;
    public Intent(String action) { throw new RuntimeException("stub"); }
    public Intent(String action, Uri uri) { throw new RuntimeException("stub"); }
    public Intent(Context packageContext, Class<?> cls) { throw new RuntimeException("stub"); }
    public Intent addCategory(String category) { throw new RuntimeException("stub"); }
    public Intent setType(String type) { throw new RuntimeException("stub"); }
    public Intent setAction(String action) { throw new RuntimeException("stub"); }
    public Intent setFlags(int flags) { throw new RuntimeException("stub"); }
    public Intent putExtra(String name, String value) { throw new RuntimeException("stub"); }
    public Intent putExtra(String name, String[] value) { throw new RuntimeException("stub"); }
    public String getStringExtra(String name) { throw new RuntimeException("stub"); }
    public Uri getData() { throw new RuntimeException("stub"); }
    public String getAction() { throw new RuntimeException("stub"); }
    public String getType() { throw new RuntimeException("stub"); }
    public <T extends android.os.Parcelable> T getParcelableExtra(String name) { throw new RuntimeException("stub"); }
    public static Intent createChooser(Intent target, CharSequence title) { throw new RuntimeException("stub"); }
}
