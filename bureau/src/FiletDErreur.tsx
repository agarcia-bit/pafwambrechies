import { Component, type ErrorInfo, type ReactNode } from 'react';

// Une erreur pendant l'affichage vidait toute la page (écran blanc). Ce filet l'attrape, garde le
// menu utilisable et montre le message exact : il suffit d'en faire une capture pour la corriger.
type Etat = { erreur: Error | null };

export class FiletDErreur extends Component<{ children: ReactNode; cle?: string }, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, infos: ErrorInfo) {
    console.error('[bureau] erreur d’affichage', erreur, infos.componentStack);
  }

  // Changer de page efface l'erreur : le reste de l'espace bureau reste accessible.
  componentDidUpdate(avant: { cle?: string }) {
    if (avant.cle !== this.props.cle && this.state.erreur) this.setState({ erreur: null });
  }

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;
    return (
      <div className="card filet-erreur" role="alert">
        <h2>Cette page n’a pas pu s’afficher</h2>
        <p className="muted">Rechargez la page. Si cela recommence, faites une capture de ce message.</p>
        <pre>{erreur.message}</pre>
        <button className="primary" onClick={() => location.reload()}>Recharger la page</button>
      </div>
    );
  }
}
