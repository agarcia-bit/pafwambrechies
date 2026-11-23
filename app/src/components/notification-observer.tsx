import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Opens what a tapped push notification is about (sent by notify-new-actu): the actu
 * (data.actu_id), the event to answer (data.evenement_id), the feed for a new poll (data.sondage_id) or a dues reminder (data.cotisation),
 * where the poll or the reminder is pinned, or the reports screen for a new report
 * (data.signalement_id, for the bureau and the admins), or the thread of a bureau message
 * (data.bureau_fil: 0 = general thread, otherwise the action's id), or a Pilotage task confiée or due
 * (data.bureau_action, sent by notify-taches: the action, or 0 = the bureau's task list), or the
 * planning of an action a member signed up for (data.planning_action, the reminder the day before).
 */
export function NotificationObserver() {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (ouvrirLaCible(response.notification.request.content.data ?? {})) Notifications.clearLastNotificationResponse();
  }, [response]);

  return null;
}

type Donnees = Record<string, unknown>;

// Dans l'ordre : la première cible reconnue l'emporte.
const CIBLES: { reconnait: (d: Donnees) => unknown; ouvre: (d: Donnees) => void }[] = [
  { reconnait: (d) => d.actu_id, ouvre: (d) => router.push({ pathname: '/actu/[id]', params: { id: String(d.actu_id) } }) },
  { reconnait: (d) => d.evenement_id, ouvre: (d) => router.push({ pathname: '/agenda/[id]', params: { id: String(d.evenement_id) } }) },
  { reconnait: (d) => d.signalement_id, ouvre: () => router.push('/plus/admin/signalements') },
  { reconnait: (d) => d.bureau_fil !== undefined, ouvre: (d) => router.push({ pathname: '/plus/bureau/discussion', params: { fil: String(d.bureau_fil) } }) },
  { reconnait: (d) => d.planning_action, ouvre: (d) => router.push({ pathname: '/agenda/creneaux/[action]', params: { action: String(d.planning_action) } }) },
  { reconnait: (d) => d.bureau_action, ouvre: (d) => router.push({ pathname: '/plus/bureau/action/[id]', params: { id: String(d.bureau_action) } }) },
  { reconnait: (d) => d.bureau_action !== undefined, ouvre: () => router.push('/plus/bureau') },
  { reconnait: (d) => d.sondage_id || d.cotisation, ouvre: () => router.navigate('/') },
];

/** Ouvre l'écran dont parle la notification ; faux si elle ne mène nulle part. */
function ouvrirLaCible(data: Donnees): boolean {
  const cible = CIBLES.find((c) => c.reconnait(data));
  cible?.ouvre(data);
  return !!cible;
}
