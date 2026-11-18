import { useEffect, useRef, useState, type PointerEvent } from 'react';

import { echelleDAffichage, limiterReglage, ZOOM_MAX, zoneDeRecadrage, type Cadre, type Reglage, type Zone } from '../../recadrage';

const LARGEUR_CADRE = 360;
const RATIO = 4 / 3;

/**
 * Fenêtre pour cadrer la photo d'une fiche de l'annuaire avant l'envoi : on fait glisser la photo
 * et on zoome (curseur ou molette) ; le cadre 4:3 montre ce que verront les adhérents.
 */
export function RecadrageDePhoto({ fichier, onValider, onAnnuler }: { fichier: File; onValider: (zone: Zone) => void; onAnnuler: () => void }) {
  const adresse = useAdresseDuFichier(fichier);
  const [cadre, setCadre] = useState<Cadre | null>(null);
  const [reglage, setReglage] = useState<Reglage>({ zoom: 1, x: 0, y: 0 });
  const glissement = useRef<{ x: number; y: number } | null>(null);
  const largeurCadre = Math.min(LARGEUR_CADRE, innerWidth - 64);

  const regler = (suivant: Reglage) => cadre && setReglage(limiterReglage(cadre, suivant));
  // Le décalage suit le zoom : le point au centre du cadre y reste.
  const zoomer = (zoom: number) => {
    const nouveau = Math.min(ZOOM_MAX, Math.max(1, zoom));
    regler({ zoom: nouveau, x: (reglage.x * nouveau) / reglage.zoom, y: (reglage.y * nouveau) / reglage.zoom });
  };
  const deplacer = (e: PointerEvent) => {
    if (!glissement.current) return;
    regler({ ...reglage, x: reglage.x + e.clientX - glissement.current.x, y: reglage.y + e.clientY - glissement.current.y });
    glissement.current = { x: e.clientX, y: e.clientY };
  };
  const echelle = cadre ? echelleDAffichage(cadre, 1) : 0;

  return (
    <>
      <div className="scrim recadrage-voile" />
      <div className="recadrage" role="dialog" aria-modal="true" aria-label="Cadrer la photo">
        <h3>Cadrer la photo</h3>
        <p className="muted">Faites glisser la photo et zoomez pour choisir ce qui apparaît sur la fiche.</p>
        <div
          className="recadrage-cadre" style={{ width: largeurCadre, height: largeurCadre / RATIO }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); glissement.current = { x: e.clientX, y: e.clientY }; }}
          onPointerMove={deplacer} onPointerUp={() => (glissement.current = null)}
          onWheel={(e) => zoomer(reglage.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        >
          {adresse && (
            <img
              src={adresse} alt="" draggable={false}
              onLoad={(e) => setCadre({ largeurImage: e.currentTarget.naturalWidth, hauteurImage: e.currentTarget.naturalHeight, largeurCadre, hauteurCadre: largeurCadre / RATIO })}
              style={cadre ? { width: cadre.largeurImage * echelle, height: cadre.hauteurImage * echelle, transform: `translate(-50%, -50%) translate(${reglage.x}px, ${reglage.y}px) scale(${reglage.zoom})` } : { visibility: 'hidden' }}
            />
          )}
        </div>
        <label className="recadrage-zoom">Zoom
          <input type="range" min={1} max={ZOOM_MAX} step={0.01} value={reglage.zoom} onChange={(e) => zoomer(Number(e.target.value))} />
        </label>
        <div className="row recadrage-boutons">
          <button type="button" className="ghost" onClick={onAnnuler}>Annuler</button>
          <button type="button" className="primary" disabled={!cadre} onClick={() => cadre && onValider(zoneDeRecadrage(cadre, reglage))}>Valider</button>
        </div>
      </div>
    </>
  );
}

/** Une adresse locale pour afficher le fichier choisi, libérée quand la fenêtre se ferme. */
function useAdresseDuFichier(fichier: File) {
  const [adresse, setAdresse] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(fichier);
    setAdresse(url);
    return () => URL.revokeObjectURL(url);
  }, [fichier]);
  return adresse;
}
