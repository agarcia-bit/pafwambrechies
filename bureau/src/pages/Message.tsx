import { useMemo, useState } from 'react';

import type { PageProps } from '../App';
import { MailForm } from '../Compose';
import { Avatar, Icon, Skeleton } from '../Icon';
import { cotisStatus, fullName, loadMembers, useAsync, type MemberRow, type Recipient } from '../lib';
import { Envois } from './Envois';

type Audience = 'tous' | 'a_relancer' | 'non_inscrits' | 'bureau' | 'choix';

/** Un e-mail aux adhérents, au nom de l'association : on choisit à qui, on écrit, on envoie.
 *  L'historique des envois est en dessous. */
export function Message(props: PageProps) {
  const members = useAsync(loadMembers, []);
  const [audience, setAudience] = useState<Audience>('tous');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [sentTick, setSentTick] = useState(0);

  const all = useMemo(() => (members.data ?? []).filter((m) => m.email), [members.data]);
  const groups: Record<Exclude<Audience, 'choix'>, MemberRow[]> = useMemo(() => ({
    tous: all,
    a_relancer: all.filter((m) => cotisStatus(m.valide_jusqu) !== 'a_jour'),
    non_inscrits: all.filter((m) => !m.inscrit),
    bureau: all.filter((m) => m.role === 'bureau' || m.role === 'admin'),
  }), [all]);
  const chosen = audience === 'choix' ? all.filter((m) => picked.has(m.key)) : groups[audience];
  const to: Recipient[] = chosen.map((m) => ({ email: m.email!, user_id: m.id }));
  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const needle = q.trim().toLowerCase();
  const candidates = needle ? all.filter((m) => `${fullName(m)} ${m.email}`.toLowerCase().includes(needle)) : all;

  const AUDIENCES: { key: Audience; label: string; hint: string; n: number }[] = [
    { key: 'tous', label: 'Tous les adhérents', hint: 'Toutes les personnes ayant une adresse e-mail', n: groups.tous.length },
    { key: 'a_relancer', label: 'Cotisation à relancer', hint: 'Cotisation expirée ou jamais réglée', n: groups.a_relancer.length },
    { key: 'non_inscrits', label: 'Pas encore sur l’app', hint: 'Importés mais sans compte : pour les inviter', n: groups.non_inscrits.length },
    { key: 'bureau', label: 'Le bureau', hint: 'Membres du bureau et administrateurs', n: groups.bureau.length },
    { key: 'choix', label: 'Choisir des personnes', hint: 'Une liste à cocher', n: picked.size },
  ];

  return (
    <>
      <div className="message-grid">
        <section className="card">
          <h2>À qui ?</h2>
          <p className="muted small">Chaque personne reçoit son propre e-mail.</p>
          {members.loading && !members.data ? <Skeleton lines={5} /> : (
            <div className="audiences">
              {AUDIENCES.map((a) => (
                <button key={a.key} className={'audience' + (audience === a.key ? ' on' : '')} onClick={() => setAudience(a.key)} aria-pressed={audience === a.key}>
                  <span className="radio" />
                  <span className="grow"><strong>{a.label}</strong><small>{a.hint}</small></span>
                  <span className="count">{a.n}</span>
                </button>
              ))}
            </div>
          )}
          {audience === 'choix' && (
            <div className="pick pop-in">
              <div className="search"><Icon name="search" size={15} /><input type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <ul className="pick-list">
                {candidates.map((m) => (
                  <li key={m.key}>
                    <label>
                      <input type="checkbox" checked={picked.has(m.key)} onChange={() => toggle(m.key)} />
                      <Avatar name={fullName(m)} size={24} />
                      <span className="grow">{fullName(m)}<small className="muted"> · {m.email}</small></span>
                    </label>
                  </li>
                ))}
                {!candidates.length && <li className="muted small empty-line">Personne ne correspond.</li>}
              </ul>
              {picked.size > 0 && <button className="link" onClick={() => setPicked(new Set())}>Tout désélectionner</button>}
            </div>
          )}
        </section>

        <section className="card">
          <div className="head">
            <h2>Le message</h2>
            <span className={'pill ' + (to.length ? 'brand' : 'neutral')}>{to.length} destinataire{to.length > 1 ? 's' : ''}</span>
          </div>
          <MailForm key={`${audience}-${sentTick}`} to={to} inline onClose={() => undefined} onSent={() => { setSentTick((t) => t + 1); setPicked(new Set()); }} />
        </section>
      </div>

      <h2 className="section-title">Envoyés</h2>
      <Envois key={sentTick} {...props} />
    </>
  );
}
