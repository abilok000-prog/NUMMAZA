package android.os;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class Build {
    public static class VERSION {
        /** В настоящем SDK значение берётся из системы при запуске — не константа, javac не должен его подставлять. */
        public static final int SDK_INT = Integer.parseInt("0");
    }
}
