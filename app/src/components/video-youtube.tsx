import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { openLink } from '@/lib/links';
import { identifiantYoutube, vignetteYoutube } from '@/lib/youtube';
import { useTheme } from '@/theme';

type Props = {
  lien: string;
  rayon?: number;
  /** Dans le fil, la vignette n'est qu'une image : c'est la carte entière qui ouvre l'actu. */
  estInerte?: boolean;
};

/**
 * La vidéo YouTube d'une actu : son image avec un bouton lecture. Un toucher ouvre YouTube
 * (l'appli YouTube si elle est installée, sinon le navigateur) : on ne lit pas la vidéo dans
 * l'application, ce qui évite d'y ajouter un lecteur et de repasser par les magasins.
 */
export function VideoYoutube({ lien, rayon = 16, estInerte }: Props) {
  const { colors } = useTheme();
  const identifiant = identifiantYoutube(lien);
  if (!identifiant) return null;
  const vignette = (
    <View style={[styles.cadre, { borderRadius: rayon, backgroundColor: colors.fill }]}>
      <Image
        source={{ uri: vignetteYoutube(identifiant) }}
        contentFit="cover"
        transition={200}
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.bouton}>
        <Icon name="play" size={30} color="#FFFFFF" />
      </View>
    </View>
  );
  if (estInerte) return vignette;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Regarder la vidéo sur YouTube"
      onPress={() => openLink(lien, { inApp: false })}
      style={({ pressed }) => pressed && styles.appuye}>
      {vignette}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 16:9 : l'image fournie par YouTube a des bandes noires en haut et en bas, le cadrage les coupe.
  cadre: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bouton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  appuye: { opacity: 0.85 },
});
