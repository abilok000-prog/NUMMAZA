package android.content;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public interface DialogInterface {
    interface OnClickListener {
        void onClick(DialogInterface dialog, int which);
    }
}
