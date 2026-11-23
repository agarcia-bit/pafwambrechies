import { useState } from 'react';

import { libelleDeTranche, minutesDe, tranchesDeLaJournee } from '../creneaux';
import { feuilleDeRoute, mentionDImpression, texteDuContact, type PoleDeFeuille } from '../feuilleDeRoute';
import { Icon } from '../Icon';
import { dateLongue } from './PlanningDeLAction';
import { useContactsDesInscrits, type Referent } from './useContactsDesInscrits';
import type { PlanningEtat } from './usePlanning';
import './feuille-de-route.css';

type Props = { planning: PlanningEtat; actionId: number };

/**
 * L'aperçu de la feuille de route du jour J (#planning?action=12&feuille=1) : la page A4 telle
 * qu'elle sortira de l'imprimante, la case « Avec les coordonnées » (décochée : c'est la version
 * qu'on affiche au stand) et le bouton Imprimer. À l'impression, seule la feuille sort.
 */
export function FeuilleDeRoute({ planning, actionId }: Props) {
  const [avecCoordonnees, setAvecCoordonnees] = useState(false);
  const membres = [...new Set(planning.inscrits.map((i) => i.membre).filter(Boolean))] as string[];
  const { referent, contacts } = useContactsDesInscrits(actionId, membres, avecCoordonnees);
  if (!planning.action || !planning.horaires) return <div className="card muted">Préparez d’abord le planning (horaires et pôles) pour imprimer sa feuille de route.</div>;
  const { horaires, action } = planning;
  const poles = feuilleDeRoute(planning.poles, tranchesDeLaJournee(horaires), horaires.dureeMinutes, planning.inscrits, avecCoordonnees ? contacts : null);
  return (
    <div className="feuille-page">
      <div className="feuille-outils">
        <a className="button ghost" href={`#planning?action=${actionId}`}>← Retour au planning</a>
        <span className="grow" />
        <label className="feuille-case">
          <input type="checkbox" checked={avecCoordonnees} onChange={(e) => setAvecCoordonnees(e.target.checked)} />
          Avec les coordonnées
        </label>
        <button className="primary" onClick={() => print()}><Icon name="printer" size={15} /> Imprimer</button>
      </div>
      {avecCoordonnees && <p className="feuille-avertissement" role="status">Cette version contient des e-mails et des téléphones : donnez-la aux responsables, ne l’affichez pas au stand.</p>}
      <article className="feuille" aria-label="Aperçu de la feuille de route">
        <header className="feuille-tete">
          <p className="feuille-surtitre">Feuille de route</p>
          <h1>{action.titre}</h1>
          <p className="feuille-infos">{dateLongue(action.date)} · {libelleDeTranche(horaires.debut, minutesDe(horaires.fin) - minutesDe(horaires.debut))}</p>
          <LigneDuReferent referent={referent} avecCoordonnees={avecCoordonnees} />
        </header>
        {poles.length ? poles.map((pole) => <TableauDuPole key={pole.nom} pole={pole} avecCoordonnees={avecCoordonnees} />)
          : <p className="feuille-vide">Aucun créneau à imprimer : ajoutez des pôles au planning.</p>}
        <footer className="feuille-pied">{mentionDImpression(new Date())} · les noms ajoutés au stylo ne sont pas dans l’app.</footer>
      </article>
    </div>
  );
}

function LigneDuReferent({ referent, avecCoordonnees }: { referent: Referent | null; avecCoordonnees: boolean }) {
  if (!referent) return null;
  const contact = avecCoordonnees ? texteDuContact(referent.contact) : '';
  return <p className="feuille-infos">Référent : <strong>{referent.nom}</strong>{contact && ` · ${contact}`}</p>;
}

/** Un pôle : une ligne par personne, l'horaire sur la première ligne de chaque tranche. */
function TableauDuPole({ pole, avecCoordonnees }: { pole: PoleDeFeuille; avecCoordonnees: boolean }) {
  return (
    <section className="feuille-pole">
      <h2>{pole.nom}</h2>
      <table>
        <tbody>
          {pole.tranches.map((tranche) => tranche.lignes.map((ligne, rang) => (
            <tr key={`${tranche.heure}-${rang}`} className={rang === tranche.lignes.length - 1 ? 'fin-de-tranche' : undefined}>
              {rang === 0 && <th scope="rowgroup" rowSpan={tranche.lignes.length} className="feuille-heure">{tranche.libelle}</th>}
              {ligne.nom ? <td>{ligne.nom}</td> : <td className="a-pourvoir">À pourvoir</td>}
              {avecCoordonnees && <td className="feuille-contact">{texteDuContact(ligne.contact)}</td>}
            </tr>
          )))}
        </tbody>
      </table>
    </section>
  );
}
