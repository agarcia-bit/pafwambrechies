import { useState } from 'react';

import { correspondALaRecherche, type Audience } from '../groupes-destinataires';
import { Avatar, Icon, Skeleton } from '../Icon';
import { fullName } from '../lib';
import { AUDIENCE_CHOIX, type EtatDestinataires } from './useDestinataires';

/** La carte « À qui ? » de l'envoi d'un message : groupes fixes, catégories de l'annuaire, groupes du bureau. */
export function ChoixDesDestinataires({ etat }: { etat: EtatDestinataires }) {
  const parRubrique = (rubrique: Audience['rubrique']) => etat.audiences.filter((a) => a.rubrique === rubrique);
  const annuaire = parRubrique('annuaire');
  const enregistres = parRubrique('enregistre');
  const choixALaMain = { cle: AUDIENCE_CHOIX, libelle: 'Choisir des personnes', indice: 'Une liste à cocher, à enregistrer comme groupe', nombre: etat.coches.size };

  return (
    <section className="card">
      <h2>À qui ?</h2>
      <p className="muted small">Chaque personne reçoit son propre e-mail.</p>
      {etat.chargement ? <Skeleton lines={5} /> : (
        <div className="audiences">
          {parRubrique('fixe').map((a) => <LigneAudience key={a.cle} audience={a} etat={etat} />)}
          <LigneAudience audience={{ ...choixALaMain, membres: [], manquants: [] }} nombre={choixALaMain.nombre} etat={etat} />
          {annuaire.length > 0 && <p className="rubrique-audiences">Par catégorie de l’annuaire</p>}
          {annuaire.map((a) => <LigneAudience key={a.cle} audience={a} etat={etat} />)}
          {enregistres.length > 0 && <p className="rubrique-audiences">Vos groupes</p>}
          {enregistres.map((a) => <LigneAudience key={a.cle} audience={a} etat={etat} />)}
        </div>
      )}
      {etat.audience && etat.audience.manquants.length > 0 && <InfosManquantes audience={etat.audience} />}
      {etat.audience?.rubrique === 'enregistre' && <ActionsDuGroupe groupe={etat.audience} etat={etat} />}
      {etat.cle === AUDIENCE_CHOIX && <ListeACocher etat={etat} />}
    </section>
  );
}

function LigneAudience({ audience, etat, nombre }: {
  audience: Pick<Audience, 'cle' | 'libelle' | 'indice' | 'membres' | 'manquants'>;
  etat: EtatDestinataires;
  nombre?: number;
}) {
  const estChoisie = etat.cle === audience.cle;
  return (
    <button className={'audience' + (estChoisie ? ' on' : '')} onClick={() => etat.choisir(audience.cle)} aria-pressed={estChoisie}>
      <span className="radio" />
      <span className="grow">
        <strong>{audience.libelle}</strong>
        <small>{audience.indice}</small>
      </span>
      {audience.manquants.length > 0 && (
        <span className="pill warn" title="Des fiches ne mènent à aucun adhérent">
          <Icon name="alert" size={12} /> {audience.manquants.length} manquant{audience.manquants.length > 1 ? 's' : ''}
        </span>
      )}
      <span className="count">{nombre ?? audience.membres.length}</span>
    </button>
  );
}

/** Ce qui n'a pas pu entrer dans le groupe, pour que le bureau complète l'annuaire ou la liste. */
function InfosManquantes({ audience }: { audience: Audience }) {
  const conseil = audience.rubrique === 'annuaire'
    ? 'Ajoutez l’adresse e-mail de l’adhérent sur sa fiche (Contenus › Annuaire) pour qu’il reçoive le message.'
    : 'Modifiez la liste du groupe pour la remettre à jour.';
  return (
    <div className="infos-manquantes pop-in" role="note">
      <strong><Icon name="alert" size={14} /> Pas dans ce groupe, faute d’information :</strong>
      <ul>{audience.manquants.map((m) => <li key={m}>{m}</li>)}</ul>
      <small>{conseil}</small>
    </div>
  );
}

function ActionsDuGroupe({ groupe, etat }: { groupe: Audience; etat: EtatDestinataires }) {
  return (
    <div className="actions-groupe">
      <button className="link" onClick={() => etat.modifierGroupe(groupe)}><Icon name="edit" size={14} /> Modifier la liste</button>
      <button className="link danger" onClick={() => etat.supprimerGroupe(groupe)}><Icon name="trash" size={14} /> Supprimer le groupe</button>
    </div>
  );
}

function ListeACocher({ etat }: { etat: EtatDestinataires }) {
  const [recherche, setRecherche] = useState('');
  const candidats = recherche.trim() ? etat.avecEmail.filter((m) => correspondALaRecherche(m, recherche)) : etat.avecEmail;
  return (
    <div className="pick pop-in">
      <div className="search"><Icon name="search" size={15} /><input type="search" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} /></div>
      <ul className="pick-list">
        {candidats.map((m) => (
          <li key={m.key}>
            <label>
              <input type="checkbox" checked={etat.coches.has(m.key)} onChange={() => etat.basculer(m.key)} />
              <Avatar name={fullName(m)} size={24} />
              <span className="grow">{fullName(m)}<small className="muted"> · {m.email}</small></span>
            </label>
          </li>
        ))}
        {!candidats.length && <li className="muted small empty-line">Personne ne correspond.</li>}
      </ul>
      {etat.coches.size > 0 && <button className="link" onClick={etat.toutDecocher}>Tout désélectionner</button>}
      {etat.coches.size > 0 && <EnregistrerLeGroupe key={etat.groupeEnEdition?.id ?? 'nouveau'} etat={etat} />}
    </div>
  );
}

function EnregistrerLeGroupe({ etat }: { etat: EtatDestinataires }) {
  const [nom, setNom] = useState(etat.groupeEnEdition?.nom ?? '');
  const [enCours, setEnCours] = useState(false);
  async function onEnregistrer() {
    setEnCours(true);
    await etat.enregistrerGroupe(nom);
    setEnCours(false);
  }
  return (
    <div className="enregistrer-groupe">
      <input type="text" maxLength={60} placeholder="Nom du groupe : Commerçants du centre, Bénévoles…" value={nom} onChange={(e) => setNom(e.target.value)} />
      <button className="ghost" disabled={!nom.trim() || enCours} onClick={onEnregistrer}>
        {etat.groupeEnEdition ? 'Mettre à jour le groupe' : 'Enregistrer ce groupe'}
      </button>
    </div>
  );
}
