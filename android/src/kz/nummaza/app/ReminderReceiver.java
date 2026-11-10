package kz.nummaza.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Наступило напоминание из плана (ставит Reminders). Не экспортируется: вызвать его может только само приложение. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !Reminders.ACTION.equals(intent.getAction())) return;
        Reminders.show(ctx, intent.getStringExtra("id"), intent.getStringExtra("title"), intent.getStringExtra("body"));
    }
}
