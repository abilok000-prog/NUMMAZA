package android.app;
import android.content.Context;
import android.os.Bundle;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class Notification implements android.os.Parcelable {
    public static final String EXTRA_TITLE = "android.title";
    public static final String EXTRA_TEXT = "android.text";
    public static final String EXTRA_BIG_TEXT = "android.bigText";
    public Bundle extras;
    public static class Builder {
        public Builder(Context context, String channelId) { throw new RuntimeException("stub"); }
        public Builder setSmallIcon(int icon) { throw new RuntimeException("stub"); }
        public Builder setContentTitle(CharSequence title) { throw new RuntimeException("stub"); }
        public Builder setContentText(CharSequence text) { throw new RuntimeException("stub"); }
        public Builder setStyle(Style style) { throw new RuntimeException("stub"); }
        public Builder setColor(int argb) { throw new RuntimeException("stub"); }
        public Builder setAutoCancel(boolean autoCancel) { throw new RuntimeException("stub"); }
        public Builder setContentIntent(PendingIntent intent) { throw new RuntimeException("stub"); }
        public Notification build() { throw new RuntimeException("stub"); }
    }
    public static abstract class Style {}
    public static class BigTextStyle extends Style {
        public BigTextStyle() { throw new RuntimeException("stub"); }
        public BigTextStyle bigText(CharSequence cs) { throw new RuntimeException("stub"); }
    }
}
