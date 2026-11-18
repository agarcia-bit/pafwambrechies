import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { PhotoChoisie } from '@/lib/photos';
import { echelleDAffichage, limiterReglage, ZOOM_MAX, zoneDeRecadrage, type Cadre, type Zone } from '@/lib/recadrage';

const RATIO = 4 / 3;

/**
 * Plein écran pour cadrer la photo d'une fiche de l'annuaire : on la fait glisser et on pince
 * pour zoomer, le cadre montre exactement ce que verront les adhérents (format 4:3).
 */
export function RecadragePhoto({ photo, onValider, onAnnuler }: { photo: PhotoChoisie | null; onValider: (zone: Zone) => void; onAnnuler: () => void }) {
  return (
    <Modal visible={!!photo} animationType="slide" presentationStyle="fullScreen" onRequestClose={onAnnuler}>
      {/* Une fenêtre modale a besoin de sa propre racine pour recevoir les gestes. */}
      <GestureHandlerRootView style={styles.ecran}>
        {photo && <CadreDeRecadrage key={photo.uri} photo={photo} onValider={onValider} onAnnuler={onAnnuler} />}
      </GestureHandlerRootView>
    </Modal>
  );
}

function CadreDeRecadrage({ photo, onValider, onAnnuler }: { photo: PhotoChoisie; onValider: (zone: Zone) => void; onAnnuler: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const largeurCadre = Math.min(width - 32, 520);
  const [cadre] = useState<Cadre>(() => ({ largeurImage: photo.largeur, hauteurImage: photo.hauteur, largeurCadre, hauteurCadre: largeurCadre / RATIO }));
  const { gestes, style, lireReglage } = useGestesDeRecadrage(cadre);
  const echelle = echelleDAffichage(cadre, 1);

  return (
    <View style={[styles.ecran, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text variant="headline" style={styles.texteClair}>Cadrer la photo</Text>
      <Text variant="footnote" style={styles.aide}>Faites glisser la photo et pincez pour zoomer.</Text>
      <View style={styles.centre}>
        <GestureDetector gesture={gestes}>
          <View style={[styles.cadre, { width: cadre.largeurCadre, height: cadre.hauteurCadre }]}>
            <Animated.View style={[{ width: cadre.largeurImage * echelle, height: cadre.hauteurImage * echelle }, style]}>
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
            </Animated.View>
          </View>
        </GestureDetector>
      </View>
      <View style={styles.boutons}>
        <Button title="Annuler" variant="lightPlain" onPress={onAnnuler} style={styles.flex} />
        <Button title="Valider" onPress={() => onValider(zoneDeRecadrage(cadre, lireReglage()))} style={styles.flex} />
      </View>
    </View>
  );
}

/** Le déplacement et le zoom au doigt, toujours ramenés dans le cadre. */
function useGestesDeRecadrage(cadre: Cadre) {
  const zoom = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const appliquer = (reglage: { zoom: number; x: number; y: number }) => {
    'worklet';
    const borne = limiterReglage(cadre, reglage);
    zoom.value = borne.zoom;
    x.value = borne.x;
    y.value = borne.y;
  };

  // Les deux gestes avancent par petits pas (changeX, scaleChange) : ils se combinent sans se contredire.
  const glisser = usePanGesture({
    onUpdate: (e) => appliquer({ zoom: zoom.value, x: x.value + e.changeX, y: y.value + e.changeY }),
  });
  const pincer = usePinchGesture({
    // Le décalage suit le zoom : le point au centre du cadre y reste.
    onUpdate: (e) => {
      const nouveau = Math.min(ZOOM_MAX, Math.max(1, zoom.value * e.scaleChange));
      const rapport = nouveau / zoom.value;
      appliquer({ zoom: nouveau, x: x.value * rapport, y: y.value * rapport });
    },
  });
  const gestes = useSimultaneousGestures(glisser, pincer);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: zoom.value }] }));
  const lireReglage = () => ({ zoom: zoom.value, x: x.value, y: y.value });
  return { gestes, style, lireReglage };
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: '#000' },
  texteClair: { color: '#fff', textAlign: 'center' },
  aide: { color: 'rgba(255,255,255,.7)', textAlign: 'center', marginTop: 4 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cadre: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  boutons: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  flex: { flex: 1 },
});
