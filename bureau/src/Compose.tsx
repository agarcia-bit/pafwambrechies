import { useEffect, useState } from 'react';

import { Drawer } from './Drawer';
import { Icon } from './Icon';
import { mailto, sendMail, toast, type Recipient } from './lib';

const MAIL_GROUP = 50; // au-delà, les messageries refusent le mailto:

/** Sujet, message et envoi : au nom de l'association par la fonction send-mail, ou, tant
 *  qu'elle n'est pas configurée (ou pour ce qui n'est pas parti), par la messagerie de la personne. */
export function MailForm({ to, subject = '', body = '', onClose, onSent, inline }: {
  to: Recipient[]; subject?: string; body?: string; onClose: () => void; onSent?: (sent: number) => void;
  /** Dans une page (pas un volet) : pas de bouton « Annuler », champs plus hauts. */
  inline?: boolean;
}) {
  const [sujet, setSujet] = useState(subject);
  const [corps, setCorps] = useState(body);
  const [busy, setBusy] = useState(false);
  // Adresses à envoyer par la messagerie de la personne : toutes (envoi direct pas activé)
  // ou seulement celles qui ont échoué (quota du jour atteint, panne du fournisseur).
  const [fallback, setFallback] = useState<{ emails: string[]; reason: string } | null>(null);
  const emails = [...new Set(to.map((r) => r.email.trim().toLowerCase()).filter(Boolean))];
  const rest = fallback?.emails ?? emails;
  const groups = Array.from({ length: Math.ceil(rest.length / MAIL_GROUP) }, (_, k) => rest.slice(k * MAIL_GROUP, (k + 1) * MAIL_GROUP));

  async function send() {
    if (!sujet.trim() || !corps.trim()) return toast('Indiquez un sujet et un message.', 'error');
    setBusy(true);
    startSending(emails.length);
    try {
      const r = await sendMail(to, sujet.trim(), corps.trim());
      if (r === 'not_configured') {
        cancelSending();
        setFallback({ emails, reason: 'L’envoi direct n’est pas encore activé. Ouvrez votre messagerie avec les destinataires en copie cachée' });
        toast('L’envoi direct n’est pas encore activé : utilisez votre messagerie ci-dessous.', 'error');
        return;
      }
      if (r.sent) { onSent?.(r.sent); finishSending(r.sent); } else cancelSending();
      if (r.failed) {
        const failed = r.failed_emails?.length ? r.failed_emails : emails;
        setFallback({
          emails: failed,
          reason: `${r.sent} envoyé${r.sent > 1 ? 's' : ''}, ${r.failed} non parti${r.failed > 1 ? 's' : ''}${r.limit ? ' : la limite d’envoi du jour est atteinte' : ''}. Envoyez le reste depuis votre messagerie`,
        });
        toast(`${r.failed} e-mail${r.failed > 1 ? 's' : ''} non envoyé${r.failed > 1 ? 's' : ''} : finissez depuis votre messagerie`, 'error');
        return;
      }
      setSujet(subject);
      setCorps(body);
      onClose();
    } catch (e) {
      cancelSending();
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="form">
        <label>Sujet<input type="text" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Ex. : Cotisation 2027" autoFocus={!inline} /></label>
        <label>Message<textarea className="plain-text" rows={inline ? 12 : 10} value={corps} onChange={(e) => setCorps(e.target.value)} placeholder="Bonjour,&#10;&#10;…" /></label>
        <p className="muted small" style={{ margin: 0 }}>Envoyé au nom de l’association, signé de son nom. Chaque personne reçoit son propre e-mail, sans voir les autres destinataires.</p>
      </div>
      {fallback && (
        <div className="note">
          <p className="small">{fallback.reason}{groups.length > 1 ? `, par groupes de ${MAIL_GROUP}` : ''} :</p>
          <div className="row" style={{ marginTop: 8 }}>
            {groups.map((g, k) => (
              <a key={k} className="button" href={mailto(g, sujet, corps)}>{groups.length > 1 ? `Groupe ${k + 1} (${g.length})` : 'Ouvrir ma messagerie'}</a>
            ))}
          </div>
        </div>
      )}
      {!emails.length && <p className="muted small">Aucune adresse e-mail parmi les personnes choisies.</p>}
      <div className={'row mail-actions' + (inline ? '' : ' in-drawer')}>
        {!inline && <button onClick={onClose} disabled={busy}>Annuler</button>}
        <span className="grow" />
        {fallback
          ? <button className="primary" onClick={onClose}>Terminé</button>
          : <button className={'primary send-btn' + (busy ? ' busy' : '')} onClick={send} disabled={busy || !emails.length}>
              <Icon name="send" size={15} /> {busy ? 'Envoi…' : emails.length > 1 ? `Envoyer à ${emails.length} personnes` : 'Envoyer'}
            </button>}
      </div>
    </>
  );
}

/** Le formulaire dans un volet, pour écrire à quelques personnes depuis une liste. */
export function Compose({ to, subject, body, onClose, onSent }: {
  to: Recipient[]; subject?: string; body?: string; onClose: () => void; onSent?: () => void;
}) {
  const emails = [...new Set(to.map((r) => r.email.trim().toLowerCase()).filter(Boolean))];
  return (
    <Drawer title={emails.length === 1 ? `Écrire à ${emails[0]}` : `Écrire à ${emails.length} personnes`} subtitle="Au nom de l’association." onClose={onClose}>
      <MailForm to={to} subject={subject} body={body} onClose={onClose} onSent={onSent} />
    </Drawer>
  );
}

// ── L'envoi en images ──────────────────────────────────────────────────────────────────
// Dès le clic : des courriers se rangent dans leurs enveloppes, le temps que le serveur
// réponde (startSending). Puis l'enveloppe se ferme, décolle, et le compte s'affiche
// (finishSending) ; ou tout s'efface si rien n'est parti (cancelSending). Affiché par
// <SentOverlay /> monté une fois dans l'application.

const SEND_EVENT = 'mail-send';
type SendPhase = { phase: 'sending'; n: number } | { phase: 'sent'; n: number } | null;
const emit = (detail: SendPhase) => dispatchEvent(new CustomEvent(SEND_EVENT, { detail }));
export const startSending = (n: number) => emit({ phase: 'sending', n });
export const finishSending = (sent: number) => emit({ phase: 'sent', n: sent });
export const cancelSending = () => emit(null);

export function SentOverlay() {
  const [state, setState] = useState<SendPhase>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setState((e as CustomEvent<SendPhase>).detail);
    addEventListener(SEND_EVENT, on);
    return () => removeEventListener(SEND_EVENT, on);
  }, []);
  // Le compteur monte pendant que l'enveloppe s'éloigne, puis tout s'efface.
  useEffect(() => {
    if (state?.phase !== 'sent') return;
    const sent = state.n;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setShown(reduced ? sent : 0);
    const start = performance.now() + 900;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 600));
      setShown(Math.round(sent * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    if (!reduced) raf = requestAnimationFrame(tick);
    const end = setTimeout(() => setState(null), reduced ? 1400 : 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(end); };
  }, [state]);
  if (!state) return null;
  if (state.phase === 'sending') {
    return (
      <div className="sent-overlay" role="status" aria-live="polite">
        <div className="sending-scene" aria-hidden>
          <div className="sending-row">
            {[0, 1, 2].map((i) => (
              <div key={i} className="mini-env">
                <div className="env-back" />
                <div className="env-letter"><i /><i /><i /></div>
                <div className="env-front" />
                <div className="env-flap" />
              </div>
            ))}
          </div>
          <div className="sending-text">Envoi en cours<span className="dots" /><small>{state.n > 1 ? `${state.n} courriers à préparer` : '1 courrier à préparer'}</small></div>
        </div>
      </div>
    );
  }
  const sent = state.n;
  return (
    <div className="sent-overlay" role="status" aria-live="polite" onClick={() => setState(null)}>
      <div className="sent-scene" key="sent">
        <div className="sent-trail" aria-hidden>{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ animationDelay: `${0.55 + i * 0.06}s` }} />)}</div>
        <div className="sent-envelope" aria-hidden>
          <div className="env-back" />
          <div className="env-letter"><i /><i /><i /></div>
          <div className="env-front" />
          <div className="env-flap" />
        </div>
        <div className="sent-burst" aria-hidden>{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--r': `rotate(${i * 30}deg)` } as React.CSSProperties} />)}</div>
        <div className="sent-text">
          <strong>{shown.toLocaleString('fr-FR')}</strong>
          <span>{sent > 1 ? 'e-mails envoyés' : 'e-mail envoyé'}</span>
        </div>
      </div>
    </div>
  );
}
