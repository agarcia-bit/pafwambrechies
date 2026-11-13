import { chargerAttentesDeReponse } from './attentes-de-reponse';
import { chargerFichesResumees } from './collegues';
import { chargerEngagement } from './engagement';
import { chargerFonctions, loadBureau, loadCotisConfig, loadLastSends, loadMembers, loadTenantConfig, prechargerDansLeCache } from './lib';
import { chargerCodeDAcces, chargerInscrits, chargerInvitations } from './pages/Adherents';
import { chargeurDeContenus } from './pages/Contenus';
import { chargerDocuments } from './pages/Documents';
import { chargerStatsEnvois } from './pages/Envois';
import { chargerEvenements } from './pages/Evenements';
import { chargerIdees, chargerSignalements } from './pages/Moderation';
import { chargerProchainsEvenements } from './pages/Overview';
import { chargerAgendaPilotage } from './pages/Pilotage';
import { chargerSondages } from './pages/Sondages';
import { chargerFichesAnnuaire, chargerGroupesEnvoi } from './pages/useDestinataires';

// À l'ouverture du bureau, les données de tous les onglets se chargent d'un coup, derrière un court
// écran de préparation : ensuite, chaque onglet s'affiche aussitôt au lieu d'attendre la base
// (un quart de seconde par demande, plusieurs demandes par onglet).
type Chargement = { charger: () => Promise<unknown>; deps?: unknown[] };

const CHARGEMENTS: Chargement[] = [
  loadMembers, loadBureau, loadCotisConfig, loadLastSends, loadTenantConfig, chargerFonctions,
  chargerEngagement, chargerInscrits, chargerInvitations, chargerCodeDAcces,
  chargerFichesAnnuaire, chargerGroupesEnvoi, chargerAttentesDeReponse, chargerFichesResumees,
  chargerProchainsEvenements, chargerAgendaPilotage, chargerEvenements, chargerSondages,
  chargerDocuments, chargerSignalements, chargerIdees, chargerStatsEnvois,
].map((charger) => ({ charger }) as Chargement).concat(
  (['actus', 'offres', 'annuaire', 'liens'] as const).map((sorte) => ({ charger: chargeurDeContenus(sorte), deps: [sorte] }))
);

/** Lance tous les chargements ; `auFil` reçoit l'avancement, pour la barre de l'écran de préparation. */
export function prechargerLesOnglets(auFil?: (faits: number, total: number) => void) {
  let faits = 0;
  return Promise.all(CHARGEMENTS.map(({ charger, deps }) =>
    prechargerDansLeCache(charger, deps).then(() => auFil?.(++faits, CHARGEMENTS.length))
  ));
}
