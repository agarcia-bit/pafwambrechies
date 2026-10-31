import type { Session } from '@supabase/supabase-js';
import { Fragment, useEffect, useState } from 'react';

import { fullName, supabase, useAsync, type Profile } from './lib';
import { Adherents } from './pages/Adherents';
import { Documents } from './pages/Documents';
import { Evenements } from './pages/Evenements';
import { Importer } from './pages/Importer';
import { Overview } from './pages/Overview';
import { Pilotage } from './pages/Pilotage';
import { Avatar, Icon, Skeleton } from './Icon';
import { Toasts } from './Toasts';

const PAGES = [
  { path: 'accueil', label: 'Vue d’ensemble', icon: 'home', sub: 'L’essentiel de votre association en un coup d’œil', el: Overview },
  { path: 'pilotage', label: 'Pilotage', icon: 'tasks', sub: 'Les actions du bureau et la liste des choses à faire', el: Pilotage },
  { path: 'adherents', label: 'Adhérents', icon: 'users', sub: 'Cotisations, relances et messages', el: Adherents },
  { path: 'evenements', label: 'Événements', icon: 'calendar', sub: 'Créez vos événements et suivez qui vient', el: Evenements },
  { path: 'documents', label: 'Documents', icon: 'file', sub: 'Les fichiers partagés avec les adhérents', el: Documents },
  { path: 'importer', label: 'Importer', icon: 'upload', sub: 'Ajoutez vos adhérents depuis un tableur', el: Importer },
] as const;

const useHash = () => {
  const [hash, setHash] = useState(location.hash.slice(1).split('?')[0] || 'accueil');
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1).split('?')[0] || 'accueil');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
};

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // Après un code de récupération, la personne est connectée mais doit choisir un mot de passe.
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      if (e === 'PASSWORD_RECOVERY') setRecovery(true);
      if (e === 'SIGNED_OUT') setRecovery(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div className="center"><div className="card" style={{ width: 320 }}><Skeleton lines={4} /></div></div>;
  if (!session) return <Login onRecovery={() => setRecovery(true)} />;
  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />;
  return <Shell userId={session.user.id} />;
}

function LoginPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="logo">A</div>
        <h1>Allianceo</h1>
        <p>L’espace de pilotage du bureau : adhérents, cotisations, événements et actions, au même endroit.</p>
        <ul>
          <li><Icon name="check" size={16} /> Les cotisations et les relances en un clic</li>
          <li><Icon name="check" size={16} /> Les actions du bureau et qui fait quoi</li>
          <li><Icon name="check" size={16} /> Les mêmes données que l’application</li>
        </ul>
      </div>
      <div className="login-form">{children}</div>
    </div>
  );
}

// Mot de passe oublié : un code à 8 chiffres par e-mail (même mécanisme que l'application,
// sans lien de redirection à configurer), puis choix d'un nouveau mot de passe.
function Login({ onRecovery }: { onRecovery: () => void }) {
  const [step, setStep] = useState<'login' | 'forgot' | 'code'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ error: { message: string } | null }>, onOk: () => void, msg: string) {
    setBusy(true);
    setError('');
    const { error } = await fn();
    setBusy(false);
    if (error) return setError(msg);
    onOk();
  }
  const login = (e: React.FormEvent) => { e.preventDefault(); run(() => supabase.auth.signInWithPassword({ email: email.trim(), password }), () => undefined, 'Adresse e-mail ou mot de passe incorrect.'); };
  const askCode = (e: React.FormEvent) => { e.preventDefault(); run(() => supabase.auth.resetPasswordForEmail(email.trim()), () => setStep('code'), 'Impossible d’envoyer le code. Réessayez dans une minute.'); };
  const checkCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => supabase.auth.verifyOtp({ email: email.trim(), token: code.replace(/\s/g, ''), type: 'recovery' }), onRecovery, 'Code incorrect ou expiré.');
  };

  if (step === 'forgot') return (
    <LoginPage>
      <form onSubmit={askCode}>
        <h2>Mot de passe oublié</h2>
        <p className="muted">Nous vous envoyons un code par e-mail pour choisir un nouveau mot de passe.</p>
        <label>Adresse e-mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary big" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir un code'}</button>
        <button type="button" className="link" onClick={() => { setStep('login'); setError(''); }}>← Retour à la connexion</button>
      </form>
    </LoginPage>
  );
  if (step === 'code') return (
    <LoginPage>
      <form onSubmit={checkCode}>
        <h2>Saisissez le code</h2>
        <p className="muted">Si un compte existe pour {email.trim()}, un e-mail avec un code vient de partir. Pensez aux courriers indésirables.</p>
        <label>Code reçu par e-mail<input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary big" disabled={busy}>{busy ? 'Vérification…' : 'Continuer'}</button>
        <button type="button" className="link" onClick={() => { setStep('forgot'); setError(''); }}>Renvoyer un code</button>
      </form>
    </LoginPage>
  );
  return (
    <LoginPage>
      <form onSubmit={login}>
        <h2>Connexion</h2>
        <p className="muted">Réservé aux membres du bureau.</p>
        <label>Adresse e-mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary big" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        <button type="button" className="link" onClick={() => { setStep('forgot'); setError(''); }}>Mot de passe oublié ?</button>
      </form>
    </LoginPage>
  );
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p1.length < 8) return setError('8 caractères minimum.');
    if (p1 !== p2) return setError('Les deux mots de passe ne correspondent pas.');
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setError(error.message);
    onDone();
  }
  return (
    <LoginPage>
      <form onSubmit={submit}>
        <h2>Nouveau mot de passe</h2>
        <p className="muted">Choisissez un mot de passe d’au moins 8 caractères.</p>
        <label>Nouveau mot de passe<input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} required autoFocus /></label>
        <label>Confirmez-le<input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary big" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer et continuer'}</button>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>Annuler</button>
      </form>
    </LoginPage>
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

  if (me.loading) return <div className="center"><div className="card" style={{ width: 320 }}><Skeleton lines={4} /></div></div>;
  if (!me.data) return <Denied text="Impossible de charger votre profil." />;
  const { profile, association } = me.data;
  if (profile.role === 'adherent') return <Denied text="Cet espace est réservé au bureau. Utilisez l’application sur votre téléphone." />;

  const page = PAGES.find((p) => p.path === hash) ?? PAGES[0];
  const Page = page.el;
  return (
    <div className="shell">
      <Toasts />
      <aside className="nav">
        <div className="brand"><span className="logo sm">A</span><div>Allianceo<small>{association}</small></div></div>
        <nav>
          {PAGES.map((p, i) => (
            <Fragment key={p.path}>
              {i === 2 && <div className="nav-label">Association</div>}
              {i === 5 && <div className="nav-label">Outils</div>}
              <a href={'#' + p.path} className={p.path === page.path ? 'active' : ''}><Icon name={p.icon} size={17} />{p.label}</a>
            </Fragment>
          ))}
        </nav>
        <div className="me">
          <Avatar name={fullName(profile)} size={34} />
          <div className="grow"><strong>{profile.prenom ?? profile.email}</strong><small>{profile.role === 'admin' ? 'Administrateur' : 'Bureau'}</small></div>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} aria-label="Se déconnecter" title="Se déconnecter"><Icon name="logout" /></button>
        </div>
      </aside>
      <main>
        <header className="page-head">
          <h1>{page.label}</h1>
          <p className="muted">{page.sub}</p>
        </header>
        <Page profile={profile} association={association} />
      </main>
    </div>
  );
}

function Denied({ text }: { text: string }) {
  return (
    <div className="center">
      <div className="card login">
        <h2>Accès refusé</h2>
        <p className="muted">{text}</p>
        <button onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </div>
    </div>
  );
}

export type PageProps = { profile: Profile; association: string };
