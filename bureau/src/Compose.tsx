import { useState } from 'react';

import { Drawer } from './Drawer';
import { Icon } from './Icon';
import { mailto, sendMail, toast, type Recipient } from './lib';

const MAIL_GROUP = 50; // au-delà, les messageries refusent le mailto:

/** Rédaction d'un e-mail aux adhérents : envoi direct par la fonction send-mail,
 *  ou, tant qu'elle n'est pas configurée, par la messagerie de la personne (mailto:). */
export function Compose({ to, subject = '', body = '', onClose, onSent }: {
  to: Recipient[]; subject?: string; body?: string; onClose: () => void; onSent?: () => void;
}) {
  const [sujet, setSujet] = useState(subject);
  const [corps, setCorps] = useState(body);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const emails = [...new Set(to.map((r) => r.email.trim().toLowerCase()).filter(Boolean))];
  const groups = Array.from({ length: Math.ceil(emails.length / MAIL_GROUP) }, (_, k) => emails.slice(k * MAIL_GROUP, (k + 1) * MAIL_GROUP));

  async function send() {
    if (!sujet.trim() || !corps.trim()) return toast('Indiquez un sujet et un message.', 'error');
    setBusy(true);
    try {
      const r = await sendMail(to, sujet.trim(), corps.trim());
      if (r === 'not_configured') {
        setFallback(true);
        toast('L’envoi direct n’est pas encore activé : utilisez votre messagerie ci-dessous.', 'error');
        return;
      }
      toast(r.failed ? `${r.sent} envoyé${r.sent > 1 ? 's' : ''}, ${r.failed} en échec` : `${r.sent} e-mail${r.sent > 1 ? 's' : ''} envoyé${r.sent > 1 ? 's' : ''}`, r.failed ? 'error' : 'ok');
      onSent?.();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={emails.length === 1 ? `Écrire à ${emails[0]}` : `Écrire à ${emails.length} personnes`}
      subtitle="Envoyé au nom de l’association. Chaque personne reçoit son propre e-mail ; les réponses vous arrivent directement."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} disabled={busy}>Annuler</button>
          <span className="grow" />
          <button className="primary" onClick={send} disabled={busy || !emails.length}><Icon name="mail" size={15} /> {busy ? 'Envoi…' : 'Envoyer'}</button>
        </>
      }>
      <div className="form">
        <label>Sujet<input type="text" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Ex. : Cotisation 2027" autoFocus /></label>
        <label>Message<textarea className="plain-text" rows={10} value={corps} onChange={(e) => setCorps(e.target.value)} placeholder="Bonjour,&#10;&#10;…" /></label>
      </div>
      {fallback && (
        <div className="note">
          <p className="small">Ouvrez votre messagerie avec les destinataires en copie cachée{groups.length > 1 ? `, par groupes de ${MAIL_GROUP}` : ''} :</p>
          <div className="row" style={{ marginTop: 8 }}>
            {groups.map((g, k) => (
              <a key={k} className="button" href={mailto(g, sujet, corps)}>{groups.length > 1 ? `Groupe ${k + 1} (${g.length})` : 'Ouvrir ma messagerie'}</a>
            ))}
          </div>
        </div>
      )}
      {!emails.length && <p className="muted small">Aucune adresse e-mail parmi les personnes choisies.</p>}
    </Drawer>
  );
}
