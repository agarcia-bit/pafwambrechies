import { useState } from 'react';

import { ajouterCollegue, candidatsCollegues, chargerCollegues, retirerCollegue } from '../collegues';
import type { Row } from '../collections';
import { fullName, loadMembers, toast, useAsync } from '../lib';

/** Dans la fiche d'une entreprise : son titulaire et ses collègues, qui partagent la même fiche. */
export function PersonnesDeLEntreprise({ fiche }: { fiche: Row }) {
  const ficheId = fiche.id;
  const collegues = useAsync(() => chargerCollegues(ficheId), [ficheId]);
  const titulaire = fullName({ prenom: fiche.prenom_contact as string | null, nom: fiche.nom_contact as string | null, email: fiche.email as string | null });

  async function retirer(email: string, nom: string) {
    if (!confirm(`Détacher ${nom} de cette fiche ? Son compte n’est pas touché.`)) return;
    const { error } = await retirerCollegue(ficheId, email);
    if (error) return toast(error.message, 'error');
    toast(`${nom} détaché de la fiche`);
    collegues.reload();
  }

  if (collegues.error) return <p className="note small">Collègues indisponibles (script <code>annuaire_collegues.sql</code> à appliquer).</p>;
  return (
    <section className="personnes-entreprise">
      <h3 className="sect">Personnes de l’entreprise</h3>
      <ul className="plain compact">
        <li><span className="grow">{titulaire}</span><span className="pill neutral">Titulaire</span></li>
        {(collegues.data ?? []).map((c) => {
          const nom = fullName(c);
          return (
            <li key={c.email}>
              <span className="grow">{nom}<span className="muted small"> · {c.user_id ? 'inscrit' : 'pas encore inscrit'}</span></span>
              <button className="link danger" onClick={() => retirer(c.email, nom)}>Détacher</button>
            </li>
          );
        })}
      </ul>
      <AjoutDeCollegue ficheId={ficheId} emailDeLaFiche={fiche.email as string | null} dejaLa={collegues.data ?? []} onAjoute={collegues.reload} />
    </section>
  );
}

function AjoutDeCollegue({ ficheId, emailDeLaFiche, dejaLa, onAjoute }: {
  ficheId: number;
  emailDeLaFiche: string | null;
  dejaLa: Awaited<ReturnType<typeof chargerCollegues>>;
  onAjoute: () => void;
}) {
  const membres = useAsync(loadMembers, []);
  const [choisi, setChoisi] = useState('');
  const [supprimerSaFiche, setSupprimerSaFiche] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const candidats = candidatsCollegues(membres.data ?? [], dejaLa, emailDeLaFiche);

  async function ajouter() {
    const membre = candidats.find((m) => m.key === choisi);
    if (!membre?.email) return;
    setEnCours(true);
    const { error } = await ajouterCollegue(ficheId, { email: membre.email, prenom: membre.prenom ?? '', nom: membre.nom ?? '' }, supprimerSaFiche);
    setEnCours(false);
    if (error) return toast(error.message, 'error');
    toast(`${fullName(membre)} rattaché à la fiche`);
    setChoisi('');
    onAjoute();
  }

  return (
    <div className="form">
      <label>Ajouter un collègue
        <select value={choisi} onChange={(e) => setChoisi(e.target.value)}>
          <option value="">Choisir un adhérent…</option>
          {candidats.map((m) => <option key={m.key} value={m.key}>{fullName(m)} · {m.email}</option>)}
        </select>
      </label>
      <label className="check-line"><input type="checkbox" checked={supprimerSaFiche} onChange={(e) => setSupprimerSaFiche(e.target.checked)} /> Supprimer sa propre fiche, en double</label>
      <button disabled={!choisi || enCours} onClick={ajouter}>{enCours ? 'Ajout…' : 'Rattacher à cette fiche'}</button>
    </div>
  );
}
