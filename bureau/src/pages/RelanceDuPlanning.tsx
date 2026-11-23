import { useEffect, useState } from 'react';

import { Drawer } from '../Drawer';
import { Icon } from '../Icon';
import { estRecente, quandEstCe, type Apercu, type Relance, type RelanceEtat } from './useRelance';

/** « Dernière relance : hier à 18 h · 12 personnes prévenues » */
export function DerniereRelance({ relance }: { relance: Relance | null }) {
  if (!relance) return null;
  const total = relance.nb_notifications + relance.nb_emails;
  return <p className="planning-relance-info">Dernière relance : {quandEstCe(relance.created_at)} · {total} personne{total > 1 ? 's' : ''} prévenue{total > 1 ? 's' : ''}</p>;
}

type Props = { relance: RelanceEtat; messagePropose: string; estOuvert: boolean; onFermer: () => void; onEnvoyee: () => void };

/**
 * La fenêtre « Prévenir les membres » : combien de personnes seront prévenues et comment, le
 * message tout prêt à retoucher, un avertissement si la dernière relance a moins de 24 h, et
 * l'ouverture du planning aux membres s'il leur était encore fermé.
 */
export function FenetreDeRelance({ relance, messagePropose, estOuvert, onFermer, onEnvoyee }: Props) {
  const [message, setMessage] = useState(messagePropose);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  // L'aperçu ne se demande qu'une fois, à l'ouverture de la fenêtre.
  useEffect(() => { relance.apercu().then(setApercu); }, []);
  const total = apercu ? apercu.nb_notifications + apercu.nb_emails : null;
  async function envoyer() {
    if (await relance.envoyer(message)) onEnvoyee();
  }
  return (
    <Drawer title="Prévenir les membres" subtitle="Les membres pas encore inscrits sur cette action" onClose={onFermer}
      footer={<>
        <span className="grow" />
        <button className="ghost" onClick={onFermer}>Annuler</button>
        <button disabled={!message.trim() || relance.enCours} onClick={() => relance.essayer(message)}>M’envoyer un essai</button>
        <button className="primary" disabled={!message.trim() || relance.enCours || !total} onClick={envoyer}>
          <Icon name="send" size={15} /> {relance.enCours ? 'Envoi…' : 'Envoyer'}
        </button>
      </>}>
      <div className="relance">
        <p className="relance-qui" aria-live="polite">
          {apercu === null ? 'Calcul du nombre de personnes…'
            : total === 0 ? 'Tout le monde est déjà inscrit : personne à prévenir.'
            : <><strong>{total} personne{total! > 1 ? 's' : ''}</strong> {total! > 1 ? 'seront prévenues' : 'sera prévenue'} : {apercu.nb_notifications} par notification sur l’app, {apercu.nb_emails} par e-mail.</>}
        </p>
        {estRecente(relance.derniere) && relance.derniere && (
          <p className="relance-alerte"><Icon name="alert" size={15} /> Une relance est déjà partie {quandEstCe(relance.derniere.created_at)}. Évitez de prévenir les mêmes personnes trop souvent.</p>
        )}
        {!estOuvert && <p className="relance-alerte neutre"><Icon name="alert" size={15} /> Le planning est réservé au bureau : il sera ouvert aux membres à l’envoi.</p>}
        <label className="relance-message">Message
          <textarea className="plain-text" rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <p className="small muted">Par e-mail, on ajoute comment s’inscrire : ouvrir l’app Allianceo, onglet Agenda.</p>
      </div>
    </Drawer>
  );
}
