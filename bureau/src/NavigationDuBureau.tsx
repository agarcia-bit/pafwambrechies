import { Fragment, type ReactNode } from 'react';

import { BoutonRetour } from './components/FormulaireDeRetour';
import { Avatar, Icon } from './Icon';
import { fullName, supabase, type Profile } from './lib';

// Le menu de l'espace bureau. Sur un grand écran, il reste à gauche. Sur un téléphone, une barre en
// haut porte le nom de la page et un bouton ☰ qui fait glisser ce même menu par-dessus la page.

export type EntreeDeMenu = { path: string; label: string; icon: string; section?: string };

type Props = {
  pages: EntreeDeMenu[];
  pageActive: string;
  association: string;
  logo: string | null;
  profile: Profile;
  estOuvert: boolean;
  onFermer: () => void;
};

export function NavigationDuBureau({ pages, pageActive, association, logo, profile, estOuvert, onFermer }: Props) {
  return (
    <>
      <aside className="nav" aria-label="Menu">
        <div className="nav-brand">
          <LogoDeLAssociation association={association} logo={logo} />
          <div className="grow">{association}<small>Espace bureau</small></div>
          <button className="icon-btn fermer-menu" onClick={onFermer} aria-label="Fermer le menu"><Icon name="x" /></button>
        </div>
        <nav>
          {pages.map((p) => (
            <Fragment key={p.path}>
              {p.section && <div className="nav-label">{p.section}</div>}
              <a href={'#' + p.path} className={p.path === pageActive ? 'active' : ''} onClick={onFermer}><Icon name={p.icon} size={17} />{p.label}</a>
            </Fragment>
          ))}
        </nav>
        <BoutonRetour auteur={profile.id} />
        <div className="me">
          <Avatar name={fullName(profile)} size={34} />
          <div className="grow"><strong>{profile.prenom ?? profile.email}</strong><small>{profile.role === 'admin' ? 'Administrateur' : 'Bureau'}</small></div>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} aria-label="Se déconnecter" title="Se déconnecter"><Icon name="logout" /></button>
        </div>
      </aside>
      {estOuvert && <div className="voile-menu" onClick={onFermer} aria-hidden />}
    </>
  );
}

/** Sur téléphone seulement : le bouton du menu, l'association, la page en cours et la discussion. */
export function BarreMobile({ association, logo, titre, onMenu, discussion }: {
  association: string;
  logo: string | null;
  titre: string;
  onMenu: () => void;
  discussion: ReactNode;
}) {
  return (
    <header className="barre-mobile">
      <button className="icon-btn" onClick={onMenu} aria-label="Ouvrir le menu"><Icon name="menu" size={22} /></button>
      <LogoDeLAssociation association={association} logo={logo} />
      <div className="grow"><small>{association}</small><strong>{titre}</strong></div>
      {discussion}
    </header>
  );
}

function LogoDeLAssociation({ association, logo }: { association: string; logo: string | null }) {
  return logo ? <img className="logo sm" src={logo} alt="" /> : <span className="logo sm">{association.slice(0, 1).toUpperCase()}</span>;
}
