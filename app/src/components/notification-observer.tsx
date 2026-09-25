import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

/** Opens the actu of a tapped push notification (sent by notify-new-actu with data.actu_id). */
export function NotificationObserver() {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const actuId = response?.notification.request.content.data?.actu_id;
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER || !actuId) return;
    Notifications.clearLastNotificationResponse();
    router.push({ pathname: '/actu/[id]', params: { id: String(actuId) } });
  }, [response]);

  return null;
}
