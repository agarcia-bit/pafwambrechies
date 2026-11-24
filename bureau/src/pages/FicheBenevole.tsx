import { actionsDuBenevole, chargerLesCreneauxDuBenevole, motDeRemerciement, type LigneDuBilan, type Periode } from '../bilan';
import { libelleDeTranche } from '../creneaux';
import { Drawer } from '../Drawer';
import { Icon, Skeleton } from '../Icon';
import { formatDay, toast, useAsync } from '../lib';

/** Les actions et créneaux d'un bénévole sur la période, et un mot de remerciement prêt à copier. */
export function FicheBenevole({ ligne, periode, onClose }: { ligne: LigneDuBilan; periode: Periode; onClose: () => void }) {
  const creneaux = useAsync(() => chargerLesCreneauxDuBenevole(ligne.cle, periode), [ligne.cle, periode.debut, periode.fin]);
  const actions = actionsDuBenevole(creneaux.data ?? []);
  const mot = motDeRemerciement(ligne.nom, actions, periode);
  async function copier() {
    try {
      await navigator.clipboard.writeText(mot);
      toast('Mot copié : collez-le dans un message.');
    } catch {
      toast('La copie n’a pas marché : sélectionnez le texte à la main.', 'error');
    }
  }
  const sousTitre = `${ligne.creneaux} créneau${ligne.creneaux > 1 ? 'x' : ''} tenu${ligne.creneaux > 1 ? 's' : ''} · ${periode.libelle}${ligne.a_compte ? '' : ' · sans l’app'}`;
  return (
    <Drawer title={ligne.nom} subtitle={sousTitre} onClose={onClose}>
      <section className="drawer-section">
        <div className="section-head"><h3>Un mot pour remercier</h3></div>
        <p className="mot-de-remerciement">{mot}</p>
        <button onClick={copier}><Icon name="check" size={15} /> Copier le mot</button>
      </section>
      <section className="drawer-section">
        <div className="section-head"><h3>Ses créneaux</h3></div>
        {creneaux.loading && !creneaux.data ? <Skeleton lines={3} />
          : creneaux.error ? <p className="small error">Impossible de charger ses créneaux.</p>
          : !actions.length ? <p className="muted small">Aucun créneau sur cette période.</p>
          : (
            <ul className="fiche-benevole-actions">
              {actions.map((a) => (
                <li key={a.actionId}>
                  <strong>{a.emoji ? `${a.emoji} ` : ''}{a.titre}</strong> <span className="muted small">· {formatDay(a.date)}</span>
                  <ul>
                    {a.creneaux.map((c) => (
                      <li key={`${c.pole}-${c.debut}`} className="small">
                        {c.pole}, {libelleDeTranche(c.debut, 0).split(' – ')[0]}
                        {c.presence === 'absent' && <span className="badge warn"> absent</span>}
                        {c.presence === 'venu' && <span className="badge ok"> venu</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
      </section>
    </Drawer>
  );
}
