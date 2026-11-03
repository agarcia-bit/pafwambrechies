import { useEffect, useRef, useState } from 'react';

import { Avatar, Icon, Skeleton } from './Icon';
import { supabase, toast, type Profile } from './lib';

// Discussion du bureau : un fil général (page « Discussion ») et un fil par action (fiche
// de l'action dans le Pilotage). Les messages arrivent en direct ; chacun voit ce qu'il
// n'a pas encore lu, ici et dans l'application.

export type Message = { id: number; action_id: number | null; auteur: string | null; auteur_nom: string | null; texte: string; created_at: string };

/** Fil 0 = fil général, sinon l'id de l'action. */
const filOf = (m: { action_id: number | null }) => m.action_id ?? 0;
const READ_EVENT = 'bureau-lu';

/** Nombre de messages non lus par fil, tenu à jour en direct. */
export function useUnread(tenant: string) {
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    let live = true;
    const load = async () => {
      const { data } = await supabase.rpc('bureau_non_lus');
      if (live) setCounts(new Map(((data ?? []) as { fil: number; n: number }[]).map((r) => [Number(r.fil), r.n])));
    };
    load();
    const channel = supabase
      .channel(`bureau-non-lus-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bureau_messages', filter: `tenant_id=eq.${tenant}` }, load)
      .subscribe();
    addEventListener(READ_EVENT, load);
    return () => {
      live = false;
      removeEventListener(READ_EVENT, load);
      supabase.removeChannel(channel);
    };
  }, [tenant]);
  return counts;
}

async function markRead(fil: number) {
  await supabase.rpc('bureau_marquer_lu', { p_fil: fil });
  dispatchEvent(new Event(READ_EVENT));
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Aujourd’hui';
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function Thread({ profile, actionId, placeholder, fill }: { profile: Profile; actionId: number | null; placeholder?: string; fill?: boolean }) {
  const fil = actionId ?? 0;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setMessages(null);
    let query = supabase.from('bureau_messages').select('id, action_id, auteur, auteur_nom, texte, created_at').order('created_at').limit(500);
    query = actionId ? query.eq('action_id', actionId) : query.is('action_id', null);
    query.then(({ data, error }) => {
      if (!live) return;
      if (error) toast(error.message, 'error');
      setMessages((data ?? []) as Message[]);
      markRead(fil);
    });
    const channel = supabase
      .channel(`bureau-fil-${fil}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bureau_messages', filter: `tenant_id=eq.${profile.tenant_id}` }, (p) => {
        const m = p.new as Message;
        if (filOf(m) !== fil) return;
        setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
        if (document.visibilityState === 'visible') markRead(fil);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bureau_messages' }, (p) => {
        const id = (p.old as { id?: number }).id;
        setMessages((list) => list?.filter((x) => x.id !== id) ?? list);
      })
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(channel);
    };
  }, [fil, actionId, profile.tenant_id]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages?.length]);

  async function send() {
    const texte = text.trim();
    if (!texte || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('bureau_messages')
      .insert({ tenant_id: profile.tenant_id, action_id: actionId, texte })
      .select('id, action_id, auteur, auteur_nom, texte, created_at')
      .single();
    setBusy(false);
    if (error) return toast('Message non envoyé. Vérifiez votre connexion.', 'error');
    setText('');
    setMessages((list) => (list && !list.some((x) => x.id === data.id) ? [...list, data as Message] : list));
  }

  async function remove(m: Message) {
    if (!confirm('Supprimer ce message ?')) return;
    const { error } = await supabase.from('bureau_messages').delete().eq('id', m.id);
    if (error) return toast(error.message, 'error');
    setMessages((list) => list?.filter((x) => x.id !== m.id) ?? list);
  }

  return (
    <div className={'thread' + (fill ? ' fill' : '')}>
      <div className="thread-list">
        {!messages ? <Skeleton lines={3} /> : !messages.length ? (
          <div className="thread-empty">
            <Icon name="inbox" size={22} />
            <p className="muted small">{actionId ? 'Aucun message sur cette action. Posez une question, partagez une info : tout le bureau la verra.' : 'Aucun message pour l’instant. Écrivez le premier : tout le bureau le verra, ici et dans l’application.'}</p>
          </div>
        ) : messages.map((m, i) => {
          const mine = m.auteur === profile.id;
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const grouped = !newDay && prev.auteur === m.auteur && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000;
          return (
            <div key={m.id}>
              {newDay && <div className="thread-day"><span>{dayLabel(m.created_at)}</span></div>}
              <div className={'msg' + (mine ? ' mine' : '') + (grouped ? ' grouped' : '')}>
                {!mine && <div className="msg-avatar">{!grouped && <Avatar name={m.auteur_nom ?? '?'} size={30} />}</div>}
                <div className="msg-body">
                  {!grouped && <div className="msg-head">{!mine && <strong>{m.auteur_nom ?? 'Ancien membre'}</strong>}<span>{timeLabel(m.created_at)}</span></div>}
                  <div className="bubble">{m.texte}</div>
                </div>
                {(mine || profile.role === 'admin') && (
                  <button className="icon-btn msg-del" aria-label="Supprimer ce message" title="Supprimer" onClick={() => remove(m)}><Icon name="trash" size={14} /></button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="thread-compose">
        <textarea
          className="plain-text"
          rows={1}
          value={text}
          maxLength={4000}
          placeholder={placeholder ?? 'Écrire au bureau…'}
          aria-label="Votre message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
        />
        <button className="primary" disabled={!text.trim() || busy} onClick={send} aria-label="Envoyer"><Icon name="arrow" size={16} /></button>
      </div>
      <p className="xs muted thread-hint">Entrée pour envoyer, Maj + Entrée pour aller à la ligne.</p>
    </div>
  );
}

/** Volet de droite, présent sur toutes les pages : le fil général du bureau, les actions qui ont
 *  de nouveaux messages, et le réglage des notifications sur le téléphone. */
export function ChatPanel({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [muted, setMuted] = useState<boolean | null>(null);
  const unread = useUnread(profile.tenant_id);
  const [titles, setTitles] = useState<Map<number, string>>(new Map());
  const actionIds = [...unread.keys()].filter((k) => k !== 0);
  const idsKey = actionIds.sort().join(',');
  useEffect(() => {
    if (!idsKey) return;
    supabase.from('actions').select('id, emoji, titre').in('id', idsKey.split(',').map(Number))
      .then(({ data }) => setTitles(new Map((data ?? []).map((a) => [a.id as number, `${a.emoji || '📌'} ${a.titre}`]))));
  }, [idsKey]);
  useEffect(() => {
    supabase.from('bureau_sourdine').select('user_id').eq('tenant_id', profile.tenant_id).maybeSingle()
      .then(({ data }) => setMuted(!!data));
  }, [profile.tenant_id]);

  async function toggleMute() {
    const mute = !muted;
    setMuted(mute);
    const { error } = mute
      ? await supabase.from('bureau_sourdine').insert({ user_id: profile.id, tenant_id: profile.tenant_id })
      : await supabase.from('bureau_sourdine').delete().eq('user_id', profile.id).eq('tenant_id', profile.tenant_id);
    if (error) { setMuted(!mute); return toast(error.message, 'error'); }
    toast(mute ? 'Notifications du téléphone coupées' : 'Notifications du téléphone activées');
  }

  return (
    <aside className="chat-panel" aria-label="Discussion du bureau">
      <div className="chat-head">
        <Icon name="chat" size={18} />
        <div className="grow"><strong>Discussion du bureau</strong><small>Bureau et administrateurs uniquement</small></div>
        {muted !== null && (
          <button className={'icon-btn' + (muted ? ' muted' : '')} onClick={toggleMute}
            aria-pressed={!muted} title={muted ? 'Notifications du téléphone coupées : cliquer pour les réactiver' : 'Notifications du téléphone activées : cliquer pour les couper'}>
            <Icon name={muted ? 'bellOff' : 'bell'} size={16} />
          </button>
        )}
        <button className="icon-btn" onClick={onClose} aria-label="Masquer la discussion" title="Masquer la discussion"><Icon name="right" size={16} /></button>
      </div>
      {actionIds.length > 0 && (
        <div className="thread-elsewhere">
          <span className="muted xs">Nouveau dans les actions :</span>
          {actionIds.map((id) => (
            <a key={id} className="chip-mini" href={`#pilotage?action=${id}`}>{titles.get(id) ?? 'Action'} <span className="unread">{unread.get(id)}</span></a>
          ))}
        </div>
      )}
      <Thread profile={profile} actionId={null} fill />
    </aside>
  );
}
