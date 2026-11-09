import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncPush } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

// Ce que le bureau voit de l'activité de chacun (supabase/engagement.sql) : les jours où l'app est
// ouverte, les actus ouvertes et si les notifications sont activées. Un envoi raté ne gêne jamais
// l'adhérent : il est simplement perdu.

// Le serveur ne garde qu'une ligne par jour : inutile de le rappeler à chaque retour dans l'app.
let dernierJourNote: string | null = null;

function noterVisiteDuJour() {
  const aujourdHui = new Date().toDateString();
  if (dernierJourNote === aujourdHui) return;
  dernierJourNote = aujourdHui;
  supabase.rpc('noter_visite').then(({ error }) => {
    if (error) dernierJourNote = null;
  });
  // Les notifications coupées dans les réglages du téléphone ne se voient qu'à l'ouverture de l'app.
  syncPush().catch(() => undefined);
}

/** Note la visite à l'ouverture de l'app et à chaque retour au premier plan. */
export function useNoterVisite() {
  useEffect(() => {
    noterVisiteDuJour();
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') noterVisiteDuJour();
    });
    return () => abonnement.remove();
  }, []);
}

/** Monté une fois dans les onglets, comme NotificationObserver. */
export function NoteurDeVisite() {
  useNoterVisite();
  return null;
}

/** Une actu ouverte compte comme lue ; le serveur ignore les ouvertures suivantes. */
export function useNoterLecture(actuId: number) {
  useEffect(() => {
    if (!Number.isFinite(actuId)) return;
    supabase.rpc('noter_lecture', { p_actu: actuId }).then(
      () => undefined,
      () => undefined
    );
  }, [actuId]);
}
