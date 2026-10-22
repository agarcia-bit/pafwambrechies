import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Opens what a tapped push notification is about (sent by notify-new-actu): the actu
 * (data.actu_id), the feed for a new poll (data.sondage_id), where the poll is pinned, or the
 * reports screen for a new report (data.signalement_id, for the bureau and the admins).
 */
export function NotificationObserver() {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const data = response?.notification.request.content.data;
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (data?.actu_id) {
      Notifications.clearLastNotificationResponse();
      router.push({ pathname: '/actu/[id]', params: { id: String(data.actu_id) } });
    } else if (data?.signalement_id) {
      Notifications.clearLastNotificationResponse();
      router.push('/plus/admin/signalements');
    } else if (data?.sondage_id) {
      Notifications.clearLastNotificationResponse();
      router.navigate('/');
    }
  }, [response]);

  return null;
}
