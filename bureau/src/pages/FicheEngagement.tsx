import { useState } from 'react';

import { Compose } from '../Compose';
import { Drawer } from '../Drawer';
import {
  BAREME, JOURS_POUR_LE_MAXIMUM, PERIODE_JOURS, POINTS_PAR_ACTION, STATUTS,
  calculerNote, classerEngagement, tonDeLaNote, type MembreEngagement,
} from '../engagement';
import { Icon } from '../Icon';
import { formatDay, fullName, supabase, toast, type Recipient } from '../lib';

/** La barre colorée d'une note sur 100, dans le tableau comme dans la fiche. */
export function BarreDeNote({ note }: { note: number }) {
  return (
    <span className={'note-engagement ' + tonDeLaNote(note)} title={`Note d’engagement : ${note} sur 100`}>
      <strong>{note}</strong>
      <span className="note-piste"><span style={{ width: `${note}%` }} /></span>
    </span>
  );
}

/** Tout l'engagement d'un adhérent : sa note détaillée, chacune de ses actions, et de quoi lui écrire. */
export function FicheEngagement({ membre, actusPubliees, onClose }: { membre: MembreEngagement; actusPubliees: number; onClose: () => void }) {
  const detail = calculerNote(membre, actusPubliees);
  const statut = STATUTS.find((s) => s.cle === classerEngagement(membre))!;
  const [destinataire, setDestinataire] = useState<Recipient[] | null>(null);

  async function onLuiEcrire() {
    const { data } = await supabase.from('profiles').select('email').eq('id', membre.id).maybeSingle();
    if (!data?.email) return toast('Pas d’adresse e-mail pour cet adhérent.', 'error');
    setDestinataire([{ email: data.email, user_id: membre.id }]);
  }

  return (
    <>
      <Drawer
        title={fullName(membre)}
        subtitle={<>Sur les {PERIODE_JOURS} derniers jours · <span className={'badge ' + statut.ton}>{statut.libelle}</span></>}
        onClose={onClose}
        footer={<button className="primary" onClick={onLuiEcrire}><Icon name="mail" size={15} /> Lui écrire</button>}>
        <div className="fiche-note"><BarreDeNote note={detail.note} /><span className="muted small">sur 100</span></div>
        <h3 className="fiche-titre">Comment la note se construit</h3>
        <ul className="plain fiche-lignes">
          <PartDeLaNote libelle="Venir" points={detail.venir} sur={BAREME.venir} aide={`${membre.jours_visite} jour(s) de visite ; le maximum à ${JOURS_POUR_LE_MAXIMUM}`} />
          {detail.lire === null
            ? <li className="muted small">Lire : aucune actu publiée sur la période, la note est ramenée sur 100 sans cette partie.</li>
            : <PartDeLaNote libelle="Lire" points={detail.lire} sur={BAREME.lire} aide={`${membre.actus_lues} actu(s) lue(s) sur ${actusPubliees}`} />}
          <PartDeLaNote libelle="Participer" points={detail.participer} sur={BAREME.participer} aide="Likes, réponses, commentaires, idées et offres" />
          <PartDeLaNote libelle="Profil complet" points={detail.profil} sur={BAREME.profil} aide="Fiche dans l’annuaire, notifications activées" />
        </ul>
        <h3 className="fiche-titre">Ses actions</h3>
        <ActionsDuMembre membre={membre} actusPubliees={actusPubliees} />
      </Drawer>
      {destinataire && <Compose to={destinataire} onClose={() => setDestinataire(null)} />}
    </>
  );
}

function PartDeLaNote({ libelle, points, sur, aide }: { libelle: string; points: number; sur: number; aide: string }) {
  return (
    <li className="fiche-ligne">
      <span className="grow"><strong>{libelle}</strong><small className="muted">{aide}</small></span>
      <span className="fiche-points">{points} / {sur}</span>
    </li>
  );
}

function ActionsDuMembre({ membre, actusPubliees }: { membre: MembreEngagement; actusPubliees: number }) {
  const points = (action: keyof typeof POINTS_PAR_ACTION) => `${POINTS_PAR_ACTION[action]} pt${POINTS_PAR_ACTION[action] > 1 ? 's' : ''} chacun`;
  const lignes: [string, string, string?][] = [
    ['Jours de visite', String(membre.jours_visite)],
    ['Dernière visite', membre.derniere_visite ? formatDay(membre.derniere_visite) : 'jamais'],
    ['Actus lues', actusPubliees ? `${membre.actus_lues} / ${actusPubliees}` : String(membre.actus_lues)],
    ['Likes', String(membre.likes), points('likes')],
    ['Commentaires', String(membre.commentaires), points('commentaires')],
    ['Réponses aux sondages', String(membre.sondages), points('sondages')],
    ['Réponses aux événements', String(membre.evenements), points('evenements')],
    ['Idées proposées', String(membre.idees), points('idees')],
    ['Offres proposées', String(membre.offres), points('offres')],
    ['Fiche dans l’annuaire', membre.fiche_annuaire ? 'Oui' : 'Non'],
    ['Notifications', membre.notifications ? 'Activées' : 'Non'],
    ['Inscrit le', formatDay(membre.inscrit_le.slice(0, 10))],
  ];
  return (
    <ul className="plain fiche-lignes">
      {lignes.map(([libelle, valeur, aide]) => (
        <li key={libelle} className="fiche-ligne">
          <span className="grow">{libelle}{aide && <small className="muted">{aide}</small>}</span>
          <strong className={valeur === '0' || valeur === 'Non' || valeur === 'jamais' ? 'muted' : ''}>{valeur}</strong>
        </li>
      ))}
    </ul>
  );
}
