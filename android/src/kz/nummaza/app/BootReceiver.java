package kz.nummaza.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Телефон перезагрузился или приложение обновилось — будильники AlarmManager сброшены системой,
 * ставим напоминания заново из сохранённого плана. Никаких данных извне не принимает.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            Reminders.restore(ctx);
            BalanceWidget.refresh(ctx);
        }
    }
}
