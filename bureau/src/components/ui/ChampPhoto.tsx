import { useRef, useState, type ChangeEvent } from 'react';

import { Icon } from '../../Icon';
import { toast, uploadPhoto } from '../../lib';
import type { Zone } from '../../recadrage';
import { RecadrageDePhoto } from './RecadrageDePhoto';

/**
 * Le champ photo d'un contenu. Une photo coupée en 4:3 (fiche de l'annuaire) passe d'abord par
 * la fenêtre de cadrage ; les autres partent telles quelles.
 */
export function ChampPhoto({ libelle, valeur, onChange, photo }: { libelle: string; valeur: string; onChange: (url: string) => void; photo: { bucket: string; width: number; crop: boolean } }) {
  const champ = useRef<HTMLInputElement>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [aCadrer, setACadrer] = useState<File | null>(null);

  async function envoyer(fichier: File, zone?: Zone) {
    setEnvoiEnCours(true);
    try { onChange(await uploadPhoto(fichier, photo.bucket, photo.width, zone ?? photo.crop)); toast('Photo ajoutée'); }
    catch (err) { toast((err as Error).message, 'error'); }
    finally { setEnvoiEnCours(false); }
  }
  function choisir(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (champ.current) champ.current.value = '';
    if (!fichier) return;
    if (photo.crop) setACadrer(fichier);
    else void envoyer(fichier);
  }

  return (
    <div className="photo-field">
      <span className="lbl">{libelle}</span>
      <div className="row" style={{ marginTop: 6 }}>
        {valeur ? <img src={valeur} alt="" className="photo-preview" /> : <span className="photo-preview empty"><Icon name="file" size={20} /></span>}
        <input ref={champ} type="file" accept="image/*" hidden onChange={choisir} />
        <button type="button" onClick={() => champ.current?.click()} disabled={envoiEnCours}><Icon name="upload" size={15} /> {envoiEnCours ? 'Envoi…' : valeur ? 'Changer' : 'Choisir une photo'}</button>
        {valeur && <button type="button" className="link danger" onClick={() => onChange('')}>Retirer</button>}
      </div>
      {aCadrer && (
        <RecadrageDePhoto
          fichier={aCadrer}
          onAnnuler={() => setACadrer(null)}
          onValider={(zone) => { setACadrer(null); void envoyer(aCadrer, zone); }}
        />
      )}
    </div>
  );
}
