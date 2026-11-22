import { useRef, useState, type FormEvent } from 'react';

import { Drawer } from '../Drawer';
import { Icon } from '../Icon';
import { toast } from '../lib';
import { envoyerUnRetour, LIBELLES_DES_TYPES, type TypeDeRetour } from '../retours';

/**
 * En bas du menu : « Un bug ? Une idée ? ». Le message part à l'équipe d'Allianceo (pas au bureau
 * de l'association), avec une capture d'écran facultative.
 */
export function BoutonRetour({ auteur }: { auteur: string }) {
  const [estOuvert, setEstOuvert] = useState(false);
  return (
    <>
      <button type="button" className="ghost bouton-retour" onClick={() => setEstOuvert(true)}><Icon name="sparkle" size={16} /> Un bug ? Une idée ?</button>
      {estOuvert && <FormulaireDeRetour auteur={auteur} onFermer={() => setEstOuvert(false)} />}
    </>
  );
}

function FormulaireDeRetour({ auteur, onFermer }: { auteur: string; onFermer: () => void }) {
  const [type, setType] = useState<TypeDeRetour>('bug');
  const [texte, setTexte] = useState('');
  const [capture, setCapture] = useState<File | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const champCapture = useRef<HTMLInputElement>(null);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (texte.trim().length < 3) return toast('Décrivez en quelques mots ce qui se passe ou ce que vous proposez.', 'error');
    setEnvoiEnCours(true);
    try {
      await envoyerUnRetour(auteur, type, texte, capture);
      toast('Merci ! Votre message est parti à l’équipe d’Allianceo.');
      onFermer();
    } catch {
      toast('Le message n’a pas pu partir. Réessayez dans un instant.', 'error');
      setEnvoiEnCours(false);
    }
  }

  const estUnBug = type === 'bug';
  return (
    <Drawer title="Un bug ? Une idée ?" subtitle="Votre message part à l’équipe qui fabrique Allianceo, pas au bureau." onClose={onFermer}
      footer={<button className="primary" form="formulaire-retour" disabled={envoiEnCours}>{envoiEnCours ? 'Envoi…' : 'Envoyer'}</button>}>
      <form id="formulaire-retour" className="formulaire-retour" onSubmit={envoyer}>
        <div className="seg" role="radiogroup" aria-label="Type de message">
          {(['bug', 'idee'] as const).map((choix) => (
            <button key={choix} type="button" role="radio" aria-checked={type === choix} className={type === choix ? 'on' : ''} onClick={() => setType(choix)}>{LIBELLES_DES_TYPES[choix]}</button>
          ))}
        </div>
        <label>{estUnBug ? 'Que se passe-t-il ?' : 'Que proposez-vous ?'}
          <textarea className="plain-text" rows={7} maxLength={4000} value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus
            placeholder={estUnBug ? 'Sur quelle page, ce que vous avez fait, ce qui s’est passé…' : 'Ce qui vous simplifierait la vie…'} />
        </label>
        <div>
          <span className="lbl">Capture d’écran (facultative)</span>
          <div className="row" style={{ marginTop: 6 }}>
            <input ref={champCapture} type="file" accept="image/*" hidden onChange={(e) => setCapture(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => champCapture.current?.click()}><Icon name="upload" size={15} /> {capture ? 'Changer' : 'Choisir une image'}</button>
            {capture && <span className="muted nom-capture">{capture.name}</span>}
            {capture && <button type="button" className="link danger" onClick={() => setCapture(null)}>Retirer</button>}
          </div>
        </div>
      </form>
    </Drawer>
  );
}
