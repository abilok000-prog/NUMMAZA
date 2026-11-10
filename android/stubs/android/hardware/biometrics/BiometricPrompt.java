package android.hardware.biometrics;
import android.content.Context;
import android.content.DialogInterface;
import android.os.CancellationSignal;
import java.util.concurrent.Executor;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class BiometricPrompt {
    public static class Builder {
        public Builder(Context context) { throw new RuntimeException("stub"); }
        public Builder setTitle(CharSequence title) { throw new RuntimeException("stub"); }
        public Builder setNegativeButton(CharSequence text, Executor executor, DialogInterface.OnClickListener listener) { throw new RuntimeException("stub"); }
        public BiometricPrompt build() { throw new RuntimeException("stub"); }
    }
    public void authenticate(CancellationSignal cancel, Executor executor, AuthenticationCallback callback) { throw new RuntimeException("stub"); }
    public static abstract class AuthenticationCallback {
        public void onAuthenticationError(int errorCode, CharSequence errString) {}
        public void onAuthenticationSucceeded(AuthenticationResult result) {}
    }
    public static class AuthenticationResult {}
}
