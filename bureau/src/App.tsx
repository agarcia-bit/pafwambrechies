import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase, useAsync, type Profile } from './lib';
import { Adherents } from './pages/Adherents';
import { Documents } from './pages/Documents';
import { Evenements } from './pages/Evenements';
import { Importer } from './pages/Importer';
import { Overview } from './pages/Overview';

const PAGES = [
  { path: 'accueil', label: 'Vue d’ensemble', el: Overview },
  { path: 'adherents', label: 'Adhérents', el: Adherents },
  { path: 'evenements', label: 'Événements', el: Evenements },
  { path: 'documents', label: 'Documents', el: Documents },
  { path: 'importer', label: 'Importer', el: Importer },
] as const;

const useHash = () => {
  const [hash, setHash] = useState(location.hash.slice(1) || 'accueil');
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || 'accueil');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
};

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div className="center muted">Chargement…</div>;
  if (!session) return <Login />;
  return <Shell userId={session.user.id} />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError('Adresse e-mail ou mot de passe incorrect.');
    setBusy(false);
  }
  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>Allianceo</h1>
        <p className="muted">Espace réservé au bureau de l’association.</p>
        <label>Adresse e-mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </div>
  );
}

function Shell({ userId }: { userId: string }) {
  const hash = useHash();
  const me = useAsync(async () => {
    const { data, error } = await supabase.from('profiles').select('id, prenom, nom, email, role, tenant_id').eq('id', userId).single();
    if (error) throw error;
    const { data: t } = await supabase.from('tenants').select('name').eq('id', data.tenant_id).maybeSingle();
    return { profile: data as Profile, association: (t?.name as string | undefined) ?? 'Mon association' };
  }, [userId]);

  if (me.loading) return <div className="center muted">Chargement…</div>;
  if (!me.data) return <Denied text="Impossible de charger votre profil." />;
  const { profile, association } = me.data;
  if (profile.role === 'adherent') return <Denied text="Cet espace est réservé au bureau. Utilisez l’application sur votre téléphone." />;

  const page = PAGES.find((p) => p.path === hash) ?? PAGES[0];
  const Page = page.el;
  return (
    <div className="shell">
      <aside>
        <div className="brand">Allianceo<small>{association}</small></div>
        <nav>
          {PAGES.map((p) => (
            <a key={p.path} href={'#' + p.path} className={p.path === page.path ? 'active' : ''}>{p.label}</a>
          ))}
        </nav>
        <div className="me">
          {profile.prenom ?? profile.email}
          <button className="link" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
        </div>
      </aside>
      <main>
        <h1>{page.label}</h1>
        <Page profile={profile} association={association} />
      </main>
    </div>
  );
}

function Denied({ text }: { text: string }) {
  return (
    <div className="center">
      <div className="card login">
        <h1>Accès refusé</h1>
        <p className="muted">{text}</p>
        <button onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </div>
    </div>
  );
}

export type PageProps = { profile: Profile; association: string };
