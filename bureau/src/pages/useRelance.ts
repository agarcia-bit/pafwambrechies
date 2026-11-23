import { useCallback, useEffect, useState } from 'react';

import { supabase, toast } from '../lib';

// La relance d'un planning (supabase/relances_planning.sql, fonction relancer-planning) : la
// dernière relance pour l'afficher, combien de personnes seraient prévenues, et l'envoi lui-même.

export type Relance = { created_at: string; nb_notifications: number; nb_emails: number };
export type Apercu = { nb_notifications: number; nb_emails: number };

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/** Vrai si la relance a moins de 24 h : la fenêtre demande alors confirmation avant de relancer. */
export const estRecente = (relance: Relance | null, maintenant = Date.now()) =>
  !!relance && maintenant - new Date(relance.created_at).getTime() < UN_JOUR_MS;

/** « hier à 18 h », « aujourd'hui à 9 h 05 », « le 3 décembre à 18 h » */
export function quandEstCe(iso: string, maintenant = new Date()): string {
  const date = new Date(iso);
  const jour = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const hier = new Date(maintenant.getTime() - UN_JOUR_MS);
  const heure = date.toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', ' h ').replace(' h 00', ' h');
  if (jour(date) === jour(maintenant)) return `aujourd’hui à ${heure}`;
  if (jour(date) === jour(hier)) return `hier à ${heure}`;
  return `le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} à ${heure}`;
}

/** L'erreur de la fonction en ligne, dite simplement. */
async function messageDErreur(erreur: unknown): Promise<string> {
  const corps = await (erreur as { context?: Response }).context?.json?.().catch(() => null);
  if (corps?.error === 'forbidden') return 'Seul le bureau peut prévenir les membres.';
  if (corps?.error === 'no_planning') return 'Préparez d’abord le planning (horaires et pôles).';
  return 'La relance n’a pas pu partir. Réessayez dans un instant.';
}

export function useRelance(actionId: number) {
  const [derniere, setDerniere] = useState<Relance | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.from('relances_planning').select('created_at, nb_notifications, nb_emails')
      .eq('action_id', actionId).order('created_at', { ascending: false }).limit(1);
    setDerniere((data?.[0] as Relance | undefined) ?? null);
  }, [actionId]);

  useEffect(() => { charger(); }, [charger]);

  /** Combien de personnes seraient prévenues, sans rien envoyer. */
  async function apercu(): Promise<Apercu | null> {
    const { data, error } = await supabase.functions.invoke('relancer-planning', { body: { action_id: actionId, apercu: true } });
    if (error) { toast(await messageDErreur(error), 'error'); return null; }
    return data as Apercu;
  }

  /** Envoie la relance ; rend vrai si elle est partie. */
  async function envoyer(message: string): Promise<boolean> {
    setEnCours(true);
    const { data, error } = await supabase.functions.invoke('relancer-planning', { body: { action_id: actionId, message } });
    setEnCours(false);
    if (error) { toast(await messageDErreur(error), 'error'); return false; }
    const { nb_notifications: notifications, nb_emails: emails } = data as Apercu;
    toast(`${notifications + emails} personne${notifications + emails > 1 ? 's' : ''} prévenue${notifications + emails > 1 ? 's' : ''}`);
    await charger();
    return true;
  }

  return { derniere, enCours, apercu, envoyer };
}

export type RelanceEtat = ReturnType<typeof useRelance>;
