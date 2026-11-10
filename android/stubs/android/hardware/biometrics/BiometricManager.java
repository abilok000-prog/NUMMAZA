package android.hardware.biometrics;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class BiometricManager {
    public static final int BIOMETRIC_SUCCESS = 0;
    @Deprecated
    public int canAuthenticate() { throw new RuntimeException("stub"); }
}
