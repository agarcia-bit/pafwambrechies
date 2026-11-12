import { useState } from 'react';

import type { PageProps } from '../App';
import { MailForm } from '../Compose';
import type { Recipient } from '../lib';
import { ChoixDesDestinataires } from './ChoixDesDestinataires';
import { Envois } from './Envois';
import { useDestinataires } from './useDestinataires';

/** Un e-mail aux adhérents, au nom de l'association : on choisit à qui, on écrit, on envoie.
 *  L'historique des envois est en dessous. */
export function Message(props: PageProps) {
  const destinataires = useDestinataires();
  const [sentTick, setSentTick] = useState(0);
  const to: Recipient[] = destinataires.destinataires.map((m) => ({ email: m.email!, user_id: m.id }));

  return (
    <>
      <div className="message-grid">
        <ChoixDesDestinataires etat={destinataires} />

        <section className="card">
          <div className="head">
            <h2>Le message</h2>
            <span className={'pill ' + (to.length ? 'brand' : 'neutral')}>{to.length} destinataire{to.length > 1 ? 's' : ''}</span>
          </div>
          <MailForm key={`${destinataires.cle}-${sentTick}`} to={to} inline onClose={() => undefined} onSent={() => { setSentTick((t) => t + 1); destinataires.toutDecocher(); }} />
        </section>
      </div>

      <h2 className="section-title">Envoyés</h2>
      <Envois key={sentTick} {...props} />
    </>
  );
}
