import { describe, expect, it, vi } from 'vitest';

import { actionsDuBenevole, motDeRemerciement, periodesDuBilan, resumeDuBilan, type CreneauDuBenevole, type LigneDuBilan } from './bilan';

vi.mock('./lib', () => ({ supabase: {} }));

const ligne = (cle: string, creneaux: number, absences = 0): LigneDuBilan =>
  ({ cle, nom: cle, a_compte: true, creneaux, actions: creneaux ? 1 : 0, absences, derniere: null });

describe('bilan des bénévoles', () => {
  it('propose l’année en cours, les douze derniers mois et l’année d’avant', () => {
    expect(periodesDuBilan('2026-11-24').map((p) => [p.libelle, p.debut, p.fin])).toEqual([
      ['Année 2026', '2026-01-01', '2026-12-31'],
      ['12 derniers mois', '2025-11-24', '2026-11-24'],
      ['Année 2025', '2025-01-01', '2025-12-31'],
    ]);
  });

  it('recule d’un an sans tomber sur un 29 février qui n’existe pas', () => {
    expect(periodesDuBilan('2028-02-29')[1].debut).toBe('2027-02-28');
  });

  it('ne compte comme bénévole que qui a tenu au moins un créneau', () => {
    expect(resumeDuBilan([ligne('lea', 5), ligne('tom', 2, 1), ligne('max', 0, 2)])).toEqual({ benevoles: 2, creneaux: 7, absences: 3 });
  });

  it('regroupe les créneaux d’un bénévole par action', () => {
    const actions = actionsDuBenevole([creneau(7, 'Marché de Noël', '10:00'), creneau(7, 'Marché de Noël', '12:00'), creneau(3, 'Braderie', '09:00')]);
    expect(actions.map((a) => [a.titre, a.creneaux.length])).toEqual([['Marché de Noël', 2], ['Braderie', 1]]);
  });

  it('écrit un mot de remerciement avec le prénom, sans compter les absences', () => {
    const [annee] = periodesDuBilan('2026-11-24');
    const actions = actionsDuBenevole([creneau(7, 'Marché de Noël', '10:00'), creneau(7, 'Marché de Noël', '12:00'), creneau(3, 'Braderie', '09:00', 'absent')]);
    expect(motDeRemerciement('Léa Martin', actions, annee))
      .toBe('Merci Léa ! En 2026, vous avez tenu 2 créneaux à « Marché de Noël ». Votre aide compte beaucoup pour l’association.');
    expect(motDeRemerciement('Tom', actionsDuBenevole([creneau(3, 'Braderie', '09:00', 'absent')]), annee))
      .toBe('Merci Tom pour votre engagement auprès de l’association !');
  });
});

function creneau(action_id: number, titre: string, debut: string, presence: CreneauDuBenevole['presence'] = null): CreneauDuBenevole {
  return { action_id, titre, emoji: null, date_action: '2026-06-01', pole: 'Gaufres', debut, presence };
}
