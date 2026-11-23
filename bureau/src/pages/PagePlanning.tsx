import { useEffect, useState } from 'react';

import type { PageProps } from '../App';
import { creneauxDuPlanning, messageDeRelance, resumeDesTrous, tranchesDeLaJournee, trousDuPlanning } from '../creneaux';
import { Drawer } from '../Drawer';
import { hashParam } from '../lib';
import { BilletsDuBureau } from './BilletDuBureau';
import { dateLongue, DemarrerLePlanning, ListeDesPoles, ReglagesDuPlanning, resumeDesHoraires, StatutDuPlanning } from './PlanningDeLAction';
import { DerniereRelance, FenetreDeRelance } from './RelanceDuPlanning';
import { usePlanning, type PlanningEtat } from './usePlanning';
import { useRelance, type RelanceEtat } from './useRelance';
import { GrilleDuPlanning, ListeDesTrous } from './VuesDuPlanning';
import './planning.css';

type Filtre = 'tout' | 'manque';

/** Vrai sur un écran étroit (téléphone) : on y ouvre directement « Ce qui manque », la grille n'y tient pas. */
function useEstEtroit() {
  const requete = '(max-width: 720px)';
  const [estEtroit, setEstEtroit] = useState(() => matchMedia(requete).matches);
  useEffect(() => {
    const liste = matchMedia(requete);
    const surChangement = () => setEstEtroit(liste.matches);
    liste.addEventListener('change', surChangement);
    return () => liste.removeEventListener('change', surChangement);
  }, []);
  return estEtroit;
}

/** L'action de l'adresse (#planning?action=12), relue quand on passe d'un planning à un autre sans quitter la page. */
function useActionDeLAdresse() {
  const [actionId, setActionId] = useState(() => Number(hashParam('action')));
  useEffect(() => {
    const surChangement = () => setActionId(Number(hashParam('action')));
    addEventListener('hashchange', surChangement);
    return () => removeEventListener('hashchange', surChangement);
  }, []);
  return actionId;
}

/**
 * La page Planning d'une action (#planning?action=12) : une phrase qui dit ce qui manque, le
 * bouton pour ouvrir le planning aux membres, ses propres créneaux, puis tout le planning en
 * grille ou seulement ce qui manque. Les horaires et les pôles se règlent dans un tiroir.
 */
export function PagePlanning({ profile }: PageProps) {
  const actionId = useActionDeLAdresse();
  if (!actionId) return <div className="card muted">Choisissez une action dans le Pilotage pour voir son planning.</div>;
  return <PlanningDUneAction key={actionId} actionId={actionId} moi={profile.id} />;
}

function PlanningDUneAction({ actionId, moi }: { actionId: number; moi: string }) {
  const planning = usePlanning(actionId);
  const estEtroit = useEstEtroit();
  const [filtre, setFiltre] = useState<Filtre | null>(null);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const relance = useRelance(actionId);
  if (!planning.estCharge) return <div className="card"><div className="skeleton" /></div>;
  const tranches = planning.horaires ? tranchesDeLaJournee(planning.horaires) : [];
  const estPret = tranches.length > 0 && planning.poles.length > 0;
  const trous = trousDuPlanning(planning.poles, tranches, planning.inscrits, moi);
  const filtreActif = filtre ?? (estEtroit ? 'manque' : 'tout');
  return (
    <div className="page-planning">
      <EnteteDeLaPage planning={planning} actionId={actionId} trous={trous} estPret={estPret} relance={relance} />
      {!planning.horaires && <DemarrerLePlanning onDemarrer={planning.enregistrerHoraires} />}
      {planning.horaires && !estPret && <div className="card planning-a-finir">Il reste à ajouter les pôles (stand, buvette…).<ReglagesEnLigne planning={planning} /></div>}
      {estPret && planning.horaires && (
        <>
          <div className="planning-bandeau">
            <BilletsDuBureau planning={planning} moi={moi} dureeMinutes={planning.horaires.dureeMinutes} />
            <div className="seg planning-filtres" role="group" aria-label="Que montrer">
              <button className={filtreActif === 'tout' ? 'on' : ''} aria-pressed={filtreActif === 'tout'} onClick={() => setFiltre('tout')}>Tout le planning</button>
              <button className={filtreActif === 'manque' ? 'on' : ''} aria-pressed={filtreActif === 'manque'} onClick={() => setFiltre('manque')}>
                Ce qui manque{trous.length > 0 && <span className="compte">{resumeDesTrous(trous).manque}</span>}
              </button>
            </div>
          </div>
          {filtreActif === 'tout' && !estEtroit && <GrilleDuPlanning planning={planning} tranches={tranches} moi={moi} />}
          {/* Sur téléphone, « Tout » est une liste : la grille ne tient pas sur un petit écran. */}
          {(filtreActif === 'manque' || estEtroit) && (
            <ListeDesTrous trous={filtreActif === 'manque' ? trous : creneauxDuPlanning(planning.poles, tranches, planning.inscrits, moi)} planning={planning} moi={moi} />
          )}
          <div className="planning-pied">
            <span>{resumeDesHoraires(planning.horaires)} · {planning.poles.length} pôle{planning.poles.length > 1 ? 's' : ''}</span>
            <button className="link" onClick={() => setReglagesOuverts(true)}>Horaires et pôles</button>
          </div>
        </>
      )}
      {reglagesOuverts && (
        <Drawer title="Horaires et pôles" onClose={() => setReglagesOuverts(false)}>
          <ReglagesEnLigne planning={planning} />
        </Drawer>
      )}
    </div>
  );
}

function ReglagesEnLigne({ planning }: { planning: PlanningEtat }) {
  if (!planning.horaires) return null;
  return (
    <div className="planning-reglages">
      <ReglagesDuPlanning key={`${planning.horaires.debut}-${planning.horaires.fin}-${planning.horaires.dureeMinutes}`} planning={planning} horaires={planning.horaires} />
      <ListeDesPoles planning={planning} />
    </div>
  );
}

type PropsDEntete = { planning: PlanningEtat; actionId: number; trous: ReturnType<typeof trousDuPlanning>; estPret: boolean; relance: RelanceEtat };

/** Le fil d'Ariane, le titre, la phrase qui résume ce qui manque et le bouton d'ouverture aux membres. */
function EnteteDeLaPage({ planning, actionId, trous, estPret, relance }: PropsDEntete) {
  const { manque, poleLePlusEnManque } = resumeDesTrous(trous);
  const [fenetreOuverte, setFenetreOuverte] = useState(false);
  const titre = planning.action ? `${planning.action.emoji ? `${planning.action.emoji} ` : ''}${planning.action.titre}` : 'Action';
  const inscrits = planning.inscrits.length;
  return (
    <header className="planning-tete">
      <div>
        <p className="planning-fil"><a href="#pilotage">Pilotage</a> › <a href={`#pilotage?action=${actionId}`}>{titre}</a> › Planning</p>
        <h1>Planning · {planning.action?.titre ?? 'Action'}</h1>
        {estPret && (
          <p className="planning-phrase">
            {manque
              ? <>Il manque <em>{manque} personne{manque > 1 ? 's' : ''}</em>{poleLePlusEnManque ? <>, surtout au pôle {poleLePlusEnManque}</> : null}.</>
              : <>Tout est rempli. Merci à tous !</>}
          </p>
        )}
        {planning.action && planning.horaires && (
          <p className="planning-sous">{dateLongue(planning.action.date)} · {resumeDesHoraires(planning.horaires)} · {inscrits} bénévole{inscrits > 1 ? 's' : ''}</p>
        )}
        <DerniereRelance relance={relance.derniere} />
      </div>
      {planning.horaires && (
        <div className="planning-actions">
          <StatutDuPlanning ouvert={planning.ouvert} />
          {planning.ouvert
            ? <button onClick={() => planning.basculerOuverture(false)}>Réserver au bureau</button>
            : <button className={manque ? '' : 'primary'} disabled={!estPret} onClick={() => planning.basculerOuverture(true)}>Ouvrir aux membres</button>}
          {/* Le geste du bureau quand il manque du monde : un seul bouton principal à la fois. */}
          {estPret && manque > 0 && <button className="primary" onClick={() => setFenetreOuverte(true)}>Prévenir les membres</button>}
        </div>
      )}
      {fenetreOuverte && planning.action && planning.horaires && (
        <FenetreDeRelance relance={relance} estOuvert={planning.ouvert}
          messagePropose={messageDeRelance(planning.action.titre, dateLongue(planning.action.date), trous, planning.horaires.dureeMinutes)}
          onFermer={() => setFenetreOuverte(false)}
          onEnvoyee={() => { setFenetreOuverte(false); planning.recharger(); }} />
      )}
    </header>
  );
}
