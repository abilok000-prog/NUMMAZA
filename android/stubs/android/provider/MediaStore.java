package android.provider;
import android.net.Uri;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public final class MediaStore {
    public interface MediaColumns {
        String DISPLAY_NAME = "_display_name";
        String MIME_TYPE = "mime_type";
        String RELATIVE_PATH = "relative_path";
    }
    public static final class Downloads implements MediaColumns {
        public static final Uri EXTERNAL_CONTENT_URI = null;
    }
}
