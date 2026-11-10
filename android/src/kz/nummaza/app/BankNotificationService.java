package kz.nummaza.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Читает уведомления банковских приложений (Kaspi, Halyk, Freedom и др.) и кладёт их текст
 * в очередь на устройстве (BankInbox). Разбирает суммы уже веб-приложение (NZ.parsePush).
 * Работает, только если пользователь сам включил доступ к уведомлениям для NUMMAZA.
 * Уведомления других приложений не читаются и никуда не отправляются.
 */
public class BankNotificationService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || !BankInbox.isBank(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return;
            Bundle x = n.extras;
            String title = str(x.getCharSequence(Notification.EXTRA_TITLE));
            String text = str(x.getCharSequence(Notification.EXTRA_BIG_TEXT));
            if (text.isEmpty()) text = str(x.getCharSequence(Notification.EXTRA_TEXT));
            if (text.isEmpty() && title.isEmpty()) return;
            BankInbox.add(this, sbn.getPackageName(), title, text, sbn.getPostTime());
        } catch (Exception ignored) {
            // Ошибка в одном уведомлении не должна ронять сервис
        }
    }

    private static String str(CharSequence s) {
        return s == null ? "" : s.toString().trim();
    }
}
