import { useState } from 'react';

import { ajouterCollegue, chargerFichesResumees } from '../collegues';
import { Icon } from '../Icon';
import { supabase, toast, useAsync } from '../lib';

const VIDE = { prenom: '', nom: '', email: '', fiche: '' };

/**
 * Un nouvel adhérent entre deux imports : ajouté à la liste comme un import, puis invité aussitôt.
 * Rattaché à l'entreprise d'un adhérent déjà présent, il n'a pas de fiche d'annuaire à lui.
 */
export function FormulaireNouvelAdherent({ onAjoute }: { onAjoute: (email: string) => void }) {
  const fiches = useAsync(chargerFichesResumees, []);
  const [saisie, setSaisie] = useState(VIDE);
  const [enCours, setEnCours] = useState(false);
  const modifier = (cle: keyof typeof VIDE) => (e: { target: { value: string } }) => setSaisie((s) => ({ ...s, [cle]: e.target.value }));

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    const email = saisie.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Adresse e-mail invalide', 'error');
    setEnCours(true);
    const personne = { email, prenom: saisie.prenom.trim(), nom: saisie.nom.trim() };
    const { data, error } = saisie.fiche
      ? await ajouterCollegue(Number(saisie.fiche), personne, false)
      : await supabase.rpc('importer_adherents', { p_rows: [{ ...personne, valide_jusqu: '' }] });
    setEnCours(false);
    if (error) return toast(error.message, 'error');
    setSaisie(VIDE);
    const resultat = data as { invites: number; deja_inscrits: number } | null;
    if (resultat?.deja_inscrits && !resultat.invites) return toast('Cette personne a déjà un compte dans l’app');
    toast(saisie.fiche ? 'Adhérent ajouté et rattaché à son entreprise' : 'Adhérent ajouté');
    onAjoute(email);
  }

  return (
    <form className="add-one" onSubmit={ajouter}>
      <input type="text" placeholder="Prénom" value={saisie.prenom} onChange={modifier('prenom')} />
      <input type="text" placeholder="Nom" value={saisie.nom} onChange={modifier('nom')} />
      <input type="email" placeholder="E-mail" required value={saisie.email} onChange={modifier('email')} />
      <button className="primary" type="submit" disabled={enCours}><Icon name="plus" size={15} /> {enCours ? 'Ajout…' : 'Ajouter et inviter'}</button>
      <select className="add-one-entreprise" value={saisie.fiche} onChange={modifier('fiche')} aria-label="Même entreprise qu’un adhérent déjà présent">
        <option value="">Nouvelle entreprise : une fiche d’annuaire sera créée</option>
        {(fiches.data ?? []).map((f) => <option key={f.id} value={f.id}>Même entreprise que : {f.nom_entreprise}</option>)}
      </select>
    </form>
  );
}
