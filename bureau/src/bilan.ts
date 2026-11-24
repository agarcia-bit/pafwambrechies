import { telechargerCsv } from './csv';
import { supabase } from './lib';

// Le bilan des bénévoles (supabase/presences_benevoles.sql) : qui a aidé combien de fois sur une
// période, pour l'assemblée générale ou pour remercier les plus présents. Un absent pointé ne
// compte pas comme créneau tenu.

export type LigneDuBilan = {
  cle: string; nom: string; a_compte: boolean; creneaux: number; actions: number; absences: number; derniere: string | null;
};
export type Periode = { cle: string; libelle: string; quand: string; debut: string; fin: string };
export type CreneauDuBenevole = {
  action_id: number; titre: string; emoji: string | null; date_action: string; pole: string; debut: string; presence: 'venu' | 'absent' | null;
};
export type ActionDuBenevole = { actionId: number; titre: string; emoji: string | null; date: string; creneaux: CreneauDuBenevole[] };

/** Cette année, l'an dernier, ou les douze derniers mois, à partir du jour donné (« AAAA-MM-JJ »). */
export function periodesDuBilan(aujourdhui: string): Periode[] {
  const annee = Number(aujourdhui.slice(0, 4));
  // Un 29 février devient le 28 : le 29 février de l'an dernier n'existe pas.
  const ilYAUnAn = `${annee - 1}${aujourdhui.slice(4).replace('-02-29', '-02-28')}`;
  return [
    { cle: 'annee', libelle: `Année ${annee}`, quand: `en ${annee}`, debut: `${annee}-01-01`, fin: `${annee}-12-31` },
    { cle: 'douze-mois', libelle: '12 derniers mois', quand: 'ces douze derniers mois', debut: ilYAUnAn, fin: aujourdhui },
    { cle: 'an-dernier', libelle: `Année ${annee - 1}`, quand: `en ${annee - 1}`, debut: `${annee - 1}-01-01`, fin: `${annee - 1}-12-31` },
  ];
}

export async function chargerLeBilan(periode: Periode): Promise<LigneDuBilan[]> {
  const { data, error } = await supabase.rpc('bilan_des_benevoles', { p_debut: periode.debut, p_fin: periode.fin });
  if (error) throw error;
  return (data ?? []) as LigneDuBilan[];
}

/** Les chiffres clés : combien de bénévoles ont aidé, combien de créneaux tenus, combien d'absences. */
export function resumeDuBilan(lignes: LigneDuBilan[]) {
  const aidants = lignes.filter((l) => l.creneaux > 0);
  return {
    benevoles: aidants.length,
    creneaux: aidants.reduce((total, l) => total + l.creneaux, 0),
    absences: lignes.reduce((total, l) => total + l.absences, 0),
  };
}

export function telechargerLeBilan(periode: Periode, lignes: LigneDuBilan[]) {
  telechargerCsv(`benevoles-${periode.debut}-${periode.fin}.csv`, ['Bénévole', 'Créneaux tenus', 'Actions', 'Absences', 'Dernière fois'],
    lignes.map((l) => [l.nom, l.creneaux, l.actions, l.absences, l.derniere ?? '']));
}

export async function chargerLesCreneauxDuBenevole(cle: string, periode: Periode): Promise<CreneauDuBenevole[]> {
  const { data, error } = await supabase.rpc('creneaux_du_benevole', { p_cle: cle, p_debut: periode.debut, p_fin: periode.fin });
  if (error) throw error;
  return (data ?? []) as CreneauDuBenevole[];
}

/** Les créneaux regroupés par action, dans l'ordre reçu (la plus récente d'abord). */
export function actionsDuBenevole(creneaux: CreneauDuBenevole[]): ActionDuBenevole[] {
  const parAction = new Map<number, ActionDuBenevole>();
  for (const c of creneaux) {
    const action = parAction.get(c.action_id) ?? { actionId: c.action_id, titre: c.titre, emoji: c.emoji, date: c.date_action, creneaux: [] };
    action.creneaux.push(c);
    parAction.set(c.action_id, action);
  }
  return [...parAction.values()];
}

/**
 * Un mot de remerciement prêt à copier : « Merci Léa ! En 2026, vous avez tenu 5 créneaux sur
 * 3 actions (Marché de Noël, Braderie…). » Les absences ne sont pas comptées ni citées.
 */
export function motDeRemerciement(nom: string, actions: ActionDuBenevole[], periode: Periode): string {
  const tenues = actions.map((a) => ({ titre: a.titre, nombre: a.creneaux.filter((c) => c.presence !== 'absent').length })).filter((a) => a.nombre > 0);
  const creneaux = tenues.reduce((total, a) => total + a.nombre, 0);
  const prenom = nom.trim().split(/\s+/)[0] || nom;
  const quand = periode.quand.charAt(0).toUpperCase() + periode.quand.slice(1);
  if (!creneaux) return `Merci ${prenom} pour votre engagement auprès de l’association !`;
  const surLesActions = tenues.length > 1 ? ` sur ${tenues.length} actions (${tenues.map((a) => a.titre).join(', ')})` : ` à « ${tenues[0].titre} »`;
  return `Merci ${prenom} ! ${quand}, vous avez tenu ${creneaux} créneau${creneaux > 1 ? 'x' : ''}${surLesActions}. Votre aide compte beaucoup pour l’association.`;
}
