import { telechargerCsv } from './csv';
import { supabase } from './lib';

// Le bilan des bénévoles (supabase/presences_benevoles.sql) : qui a aidé combien de fois sur une
// période, pour l'assemblée générale ou pour remercier les plus présents. Un absent pointé ne
// compte pas comme créneau tenu.

export type LigneDuBilan = {
  cle: string; nom: string; a_compte: boolean; creneaux: number; actions: number; absences: number; derniere: string | null;
};
export type Periode = { cle: string; libelle: string; debut: string; fin: string };

/** Cette année, l'an dernier, ou les douze derniers mois, à partir du jour donné (« AAAA-MM-JJ »). */
export function periodesDuBilan(aujourdhui: string): Periode[] {
  const annee = Number(aujourdhui.slice(0, 4));
  // Un 29 février devient le 28 : le 29 février de l'an dernier n'existe pas.
  const ilYAUnAn = `${annee - 1}${aujourdhui.slice(4).replace('-02-29', '-02-28')}`;
  return [
    { cle: 'annee', libelle: `Année ${annee}`, debut: `${annee}-01-01`, fin: `${annee}-12-31` },
    { cle: 'douze-mois', libelle: '12 derniers mois', debut: ilYAUnAn, fin: aujourdhui },
    { cle: 'an-dernier', libelle: `Année ${annee - 1}`, debut: `${annee - 1}-01-01`, fin: `${annee - 1}-12-31` },
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
