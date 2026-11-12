import { describe, expect, it } from 'vitest';

import { construireAudiences, emailsDuGroupe, groupeEnregistre, groupesDeLAnnuaire, type FicheAnnuaire } from './groupes-destinataires';
import type { MemberRow } from './lib';

const membre = (key: string, email: string | null, extra: Partial<MemberRow> = {}): MemberRow => ({
  key, id: key.startsWith('i:') ? null : key, prenom: key, nom: null, email, role: 'adherent', valide_jusqu: null, inscrit: !key.startsWith('i:'), ...extra,
});
const fiche = (nom: string, categorie: string | null, email: string | null, user_id: string | null = null): FicheAnnuaire =>
  ({ nom_entreprise: nom, categorie, email, user_id });

const ANNE = membre('anne', 'anne@ex.fr');
const BRUNO = membre('i:bruno@ex.fr', 'bruno@ex.fr');
const CLARA = membre('clara', 'clara@ex.fr');

describe('groupesDeLAnnuaire', () => {
  it('rattache une fiche par son compte, sinon par son e-mail, sans tenir compte des majuscules', () => {
    const [commercants] = groupesDeLAnnuaire([ANNE, BRUNO], [
      fiche('Boulangerie', 'Commerçant', 'autre@ex.fr', 'anne'),
      fiche('Fleuriste', 'Commerçant', ' Bruno@Ex.fr '),
    ]);
    expect(commercants.libelle).toBe('Commerçant');
    expect(commercants.membres.map((m) => m.key)).toEqual(['anne', 'i:bruno@ex.fr']);
    expect(commercants.manquants).toEqual([]);
  });

  it("signale les fiches sans e-mail ou dont l'e-mail ne mène à aucun adhérent", () => {
    const [groupe] = groupesDeLAnnuaire([ANNE], [
      fiche('Boucherie', 'Commerçant', null),
      fiche('Garage', 'Commerçant', 'inconnu@ex.fr'),
    ]);
    expect(groupe.membres).toEqual([]);
    expect(groupe.manquants).toEqual(["Boucherie (pas d'e-mail)", 'Garage (e-mail inconnu des adhérents)']);
  });

  it('ne compte un adhérent qu’une fois et range les catégories par ordre alphabétique', () => {
    const groupes = groupesDeLAnnuaire([ANNE], [
      fiche('A', 'Services', 'anne@ex.fr'),
      fiche('B', 'Services', 'anne@ex.fr'),
      fiche('C', 'Commerçant', 'anne@ex.fr'),
      fiche('D', null, 'anne@ex.fr'),
    ]);
    expect(groupes.map((g) => [g.libelle, g.membres.length])).toEqual([['Commerçant', 1], ['Services', 1]]);
  });
});

describe('groupeEnregistre', () => {
  it("retrouve les adhérents par e-mail et signale ceux qui ne sont plus là", () => {
    const groupe = groupeEnregistre([ANNE, CLARA], { id: 7, nom: 'Bénévoles', emails: ['ANNE@ex.fr', 'parti@ex.fr'] });
    expect(groupe.cle).toBe('groupe:7');
    expect(groupe.membres.map((m) => m.key)).toEqual(['anne']);
    expect(groupe.manquants).toEqual(["parti@ex.fr (n'est plus adhérent)"]);
  });
});

describe('construireAudiences', () => {
  it('met les groupes fixes, puis ceux de l’annuaire, puis les groupes enregistrés, sans les adhérents sans e-mail', () => {
    const audiences = construireAudiences(
      [ANNE, membre('sans', null)],
      [fiche('Boulangerie', 'Commerçant', 'anne@ex.fr')],
      [{ id: 2, nom: 'Zèbres', emails: [] }, { id: 1, nom: 'Amis', emails: ['anne@ex.fr'] }]
    );
    expect(audiences.map((a) => a.cle)).toEqual(['tous', 'a_relancer', 'non_inscrits', 'bureau', 'annuaire:Commerçant', 'groupe:1', 'groupe:2']);
    expect(audiences[0].membres).toEqual([ANNE]);
  });
});

describe('emailsDuGroupe', () => {
  it('garde des adresses uniques en minuscules', () => {
    expect(emailsDuGroupe([ANNE, membre('x', 'Anne@Ex.fr'), membre('y', null)])).toEqual(['anne@ex.fr']);
  });
});
