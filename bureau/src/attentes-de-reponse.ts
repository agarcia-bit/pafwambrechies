import type { AttenteDeReponse } from './groupes-destinataires';
import { formatDay, supabase, today } from './lib';
import { filtreNonTermines, formatPeriode } from './periode';

// Les événements et sondages en cours qui attendent une réponse des adhérents, avec ceux qui ont
// déjà répondu : de quoi relancer les autres d'un clic dans « Envoyer un message ».
// Le bureau lit toutes les réponses de son association (règles d'accès des deux tables).

type EvenementLu = { id: number; titre: string; date: string; date_fin: string | null; evenement_reponses: { user_id: string }[] };
type SondageLu = { id: number; question: string; date_limite: string | null; sondage_reponses: { user_id: string }[] };

export async function chargerAttentesDeReponse(): Promise<AttenteDeReponse[]> {
  const [evenements, sondages] = await Promise.all([
    supabase.from('evenements').select('id, titre, date, date_fin, evenement_reponses(user_id)')
      .eq('participation', true).or(filtreNonTermines()).order('date'),
    supabase.from('sondages').select('id, question, date_limite, sondage_reponses(user_id)')
      .eq('actif', true).order('created_at', { ascending: false }),
  ]);
  if (evenements.error) throw evenements.error;
  if (sondages.error) throw sondages.error;
  return [
    ...(evenements.data as EvenementLu[]).map((ev) => ({
      cle: `evenement:${ev.id}`,
      libelle: ev.titre,
      indice: `Événement · ${formatPeriode(ev)}`,
      repondants: ev.evenement_reponses.map((r) => r.user_id),
    })),
    ...(sondages.data as SondageLu[])
      // Un sondage dont la date limite est passée n'attend plus de réponse.
      .filter((s) => !s.date_limite || s.date_limite >= today())
      .map((s) => ({
        cle: `sondage:${s.id}`,
        libelle: s.question,
        indice: s.date_limite ? `Sondage · jusqu’au ${formatDay(s.date_limite)}` : 'Sondage',
        repondants: s.sondage_reponses.map((r) => r.user_id),
      })),
  ];
}
