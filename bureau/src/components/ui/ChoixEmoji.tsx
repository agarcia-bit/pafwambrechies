import { useEffect, useRef, useState } from 'react';

// Les icônes les plus utiles pour une action du bureau : un clic suffit, sans clavier emoji.
const EMOJIS = [
  '📌', '🎄', '🎉', '🎁', '🍽️', '🍷', '☕', '🎤',
  '📣', '📰', '📅', '🤝', '💼', '💡', '📊', '💰',
  '🏆', '⚽', '🎨', '🎵', '📸', '🛍️', '🏪', '🌱',
  '🚀', '🔧', '📝', '✉️', '🏛️', '❤️', '⭐', '✅',
];

/** L'icône d'une action : une grille d'emojis au clic, et la saisie libre reste possible. */
export function ChoixEmoji({ valeur, onChange }: { valeur: string; onChange: (emoji: string) => void }) {
  const [estOuvert, setEstOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  // Un clic ailleurs referme la grille.
  useEffect(() => {
    if (!estOuvert) return;
    const fermerSiDehors = (e: MouseEvent) => { if (!zone.current?.contains(e.target as Node)) setEstOuvert(false); };
    document.addEventListener('mousedown', fermerSiDehors);
    return () => document.removeEventListener('mousedown', fermerSiDehors);
  }, [estOuvert]);

  function choisir(emoji: string) {
    onChange(emoji);
    setEstOuvert(false);
  }

  return (
    <div className="choix-emoji" ref={zone}>
      <button type="button" className="choix-emoji-bouton" aria-label="Choisir l’icône" aria-expanded={estOuvert} onClick={() => setEstOuvert((v) => !v)}>
        {valeur || '📌'}
      </button>
      {estOuvert && (
        <div className="choix-emoji-grille pop-in" role="listbox" aria-label="Icônes">
          {EMOJIS.map((emoji) => (
            <button key={emoji} type="button" role="option" aria-selected={emoji === valeur} className={emoji === valeur ? 'on' : undefined} onClick={() => choisir(emoji)}>{emoji}</button>
          ))}
          <input type="text" maxLength={4} value={valeur} onChange={(e) => onChange(e.target.value)} placeholder="Autre" aria-label="Autre emoji" />
        </div>
      )}
    </div>
  );
}
