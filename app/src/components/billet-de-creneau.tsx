import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { libelleDeTranche } from '@/lib/creneaux';
import { plural } from '@/lib/format';
import { useTheme } from '@/theme';
import { mix } from '@/theme/colors';

type Props = {
  nomDuPole: string;
  heure: string;
  dureeMinutes: number;
  /** Les autres bénévoles déjà inscrits sur ce créneau. */
  autres: number;
  /** Vrai pour le billet qu'on vient de prendre : lui seul apparaît avec un rebond. */
  estNouveau: boolean;
  enCours: boolean;
  onLiberer: () => void;
  /** Une seule ligne (Pilotage du bureau) : ses créneaux sans prendre la place du planning. */
  compact?: boolean;
  /** La personne cherche un remplaçant : le billet le dit, avec « Partager le lien » et « Finalement, je viens ». */
  remplacantRecherche?: boolean;
  onPartager?: () => void;
  onRevenir?: () => void;
  /** « Échanger » : proposer son créneau contre un autre de la même action. */
  onEchanger?: () => void;
};

/**
 * Un créneau de la personne, présenté comme un billet à garder (DESIGN.md, « Créneaux de
 * présence ») : ce qu'elle doit faire passe avant ce qu'elle peut encore prendre. Il apparaît
 * avec un léger rebond quand elle vient de s'inscrire : le seul effet de l'écran.
 */
export function BilletDeCreneau({ nomDuPole, heure, dureeMinutes, autres, estNouveau, enCours, onLiberer, compact = false, remplacantRecherche = false, onPartager, onRevenir, onEchanger }: Props) {
  const { colors } = useTheme();
  const moinsDAnimations = useReducedMotion();
  // La couleur de la bande de l'association : toujours assez foncée pour du blanc, en clair comme
  // en sombre (la couleur principale, elle, s'éclaircit en mode sombre). Même choix que l'espace bureau.
  const fond = colors.banner;
  const encre = '#FFFFFF';
  const pale = mix(fond, encre, 0.8);
  const compagnie = autres ? `avec ${plural(autres, 'autre bénévole', 'autres bénévoles')}` : 'personne d’autre pour l’instant';
  const creneau = `${nomDuPole}, ${libelleDeTranche(heure, dureeMinutes)}`;
  const lienDuBillet = (libelle: string, onPress?: () => void) => (
    <LienDuBillet key={libelle} libelle={libelle} detail={creneau} encre={encre} enCours={enCours} onPress={onPress} />
  );
  const lien = remplacantRecherche
    ? <View style={styles.liens}>{lienDuBillet('Partager le lien', onPartager)}{lienDuBillet('Finalement, je viens', onRevenir)}</View>
    : onEchanger ? <View style={styles.liens}>{lienDuBillet('Échanger', onEchanger)}{lienDuBillet('Je ne peux plus venir', onLiberer)}</View>
    : lienDuBillet('Je ne peux plus venir', onLiberer);
  const surtitre = remplacantRecherche ? 'Remplaçant recherché' : 'Votre créneau';
  if (compact) {
    return (
      <View style={[styles.billetCompact, { backgroundColor: fond }]}>
        <View style={styles.grandit}>
          <Text variant="caption" style={{ color: pale, fontWeight: '600' }}>{surtitre}</Text>
          <Text variant="headline" style={{ color: encre }}>{nomDuPole} · {libelleDeTranche(heure, dureeMinutes)}</Text>
        </View>
        {lien}
      </View>
    );
  }
  return (
    <Animated.View
      entering={estNouveau && !moinsDAnimations ? ZoomIn.springify().damping(14).duration(260) : undefined}
      style={[styles.billet, { backgroundColor: fond }]}>
      <Text variant="caption" style={{ color: pale, fontWeight: '600' }}>{surtitre}</Text>
      <Text variant="title" style={{ color: encre }}>{libelleDeTranche(heure, dureeMinutes)}</Text>
      <Text variant="subhead" style={{ color: encre, fontWeight: '600' }}>{nomDuPole} · {compagnie}</Text>
      <Perforation fond={colors.background} trait={pale} />
      <View style={styles.pied}>
        <Text variant="footnote" style={[styles.grandit, { color: pale }]}>{remplacantRecherche ? 'Encore à votre nom' : 'Rappel la veille'}</Text>
        {lien}
      </View>
    </Animated.View>
  );
}

/** Un lien souligné du billet (« Je ne peux plus venir »…), avec une zone de clic de 44 points. */
function LienDuBillet({ libelle, detail, encre, enCours, onPress }: { libelle: string; detail: string; encre: string; enCours: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${libelle} : ${detail}`}
      disabled={enCours}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.lien, { opacity: pressed || enCours ? 0.6 : 1 }]}>
      <Text variant="footnote" style={{ color: encre, fontWeight: '600', textDecorationLine: 'underline' }}>{libelle}</Text>
    </Pressable>
  );
}

/** Le pointillé du billet, avec une encoche de chaque côté de la couleur du fond. */
function Perforation({ fond, trait }: { fond: string; trait: string }) {
  return (
    <View style={styles.perforation}>
      <View style={[styles.encoche, styles.encocheGauche, { backgroundColor: fond }]} />
      <View style={[styles.pointilles, { borderColor: trait }]} />
      <View style={[styles.encoche, styles.encocheDroite, { backgroundColor: fond }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  billetCompact: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },
  billet: { borderRadius: 20, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4, gap: 2, overflow: 'hidden' },
  perforation: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 2, marginHorizontal: -18 },
  // Une boîte d'un point de haut, bordée en entier : iOS ne dessine pas un pointillé sur un seul côté.
  pointilles: { flex: 1, height: 1, borderWidth: 1, borderStyle: 'dashed', borderRadius: 1, marginHorizontal: 6 },
  encoche: { width: 18, height: 18, borderRadius: 9 },
  encocheGauche: { marginLeft: -9 },
  encocheDroite: { marginRight: -9 },
  pied: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grandit: { flex: 1 },
  lien: { minHeight: 44, justifyContent: 'center' },
  liens: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, justifyContent: 'flex-end' },
});
