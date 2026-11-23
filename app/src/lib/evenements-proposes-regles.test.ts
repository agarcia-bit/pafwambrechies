import { describe, expect, it } from 'vitest';

import { erreurDeLaProposition, libelleDuStatut, resumeDesSeances, seancesDeLaSerie, type ChampsDeProposition } from './evenements-proposes-regles';

describe('événements proposés par les membres', () => {
  it('calcule les séances comme la base : même jour du mois, ramené à la fin des mois courts', () => {
    expect(seancesDeLaSerie('2027-01-31', 'mois', 3)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    expect(seancesDeLaSerie('2027-11-14', 'mois', 3)).toEqual(['2027-11-14', '2027-12-14', '2028-01-14']);
    const semaines = seancesDeLaSerie('2027-01-14', 'semaine', 3);
    expect([semaines.length, semaines[0], semaines.at(-1)]).toEqual([13, '2027-01-14', '2027-04-08']);
    expect(seancesDeLaSerie('2027-01-14', 'aucune', 3)).toEqual(['2027-01-14']);
  });

  it('dit ce qui manque au formulaire', () => {
    const karaoke: ChampsDeProposition = {
      type: 'personnel', titre: 'Soirée karaoké', description: 'Au Bar du Centre', periode: '',
      date: '2027-01-14', heure: '20 h', lieu: 'Bar du Centre', repetition: 'mois', nbMois: 3,
    };
    expect(erreurDeLaProposition(karaoke, '2027-01-01')).toBeNull();
    expect(erreurDeLaProposition({ ...karaoke, lieu: ' ' }, '2027-01-01')).toBe('Indiquez le lieu de votre événement.');
    expect(erreurDeLaProposition(karaoke, '2027-02-01')).toBe('Cette date est déjà passée.');
    // À organiser : ni date ni lieu, le bureau les choisira.
    expect(erreurDeLaProposition({ ...karaoke, type: 'a_organiser', date: '', lieu: '' }, '2027-01-01')).toBeNull();
    expect(erreurDeLaProposition({ ...karaoke, titre: '' }, '2027-01-01')).toBe('Donnez un nom à votre événement.');
  });

  it('résume les séances et le statut en mots simples', () => {
    expect(resumeDesSeances(['2027-01-14', '2027-02-14', '2027-03-14'])).toBe('3 séances : 14 janv., 14 févr., 14 mars');
    expect(resumeDesSeances(seancesDeLaSerie('2027-01-14', 'semaine', 3))).toBe('13 séances, du 14 janv. au 8 avr.');
    expect(resumeDesSeances(['2027-01-14'])).toBe('Le 14 janv.');
    expect(libelleDuStatut('refusee')).toBe('Pas retenue');
  });
});
