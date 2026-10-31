import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { associationName } from '@/components/association';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { INTRO_HOLD_MS } from '@/lib/launch-state';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';
import { closeTour, markTourDone, openTour, tourDone, useTourOpen } from '@/lib/tour';
import { useTheme } from '@/theme';

type Step = { icon: IconName | 'logo'; title: string; text: string; tip?: string };

/**
 * A few screens that show a member what the app offers, on the association's color. Only what
 * every member can do: the bureau and administration tools are not part of it. Shown the first
 * time the app opens on an account (on this phone), and again from "Plus" > "Visite guidée".
 */
export function GuidedTour() {
  const { profile, branding } = useMember();
  const { modules, labels } = useTenantConfig();
  const visible = useTourOpen();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);

  // First launch on this account: wait for the opening animation, then show the tour.
  useEffect(() => {
    if (tourDone(profile.id)) return;
    const timer = setTimeout(openTour, INTRO_HOLD_MS + 900);
    return () => clearTimeout(timer);
  }, [profile.id]);

  // Each opening starts again from the first screen.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPage(0);
  }

  const name = associationName(branding) || 'votre association';
  const steps: Step[] = [
    {
      icon: 'logo',
      title: `Bienvenue dans ${name}`,
      text: 'Voici en quelques écrans tout ce que vous trouverez dans l’application de votre association.',
    },
    {
      icon: 'newspaper',
      title: 'Les actus',
      text: 'Les nouvelles de l’association arrivent dans le fil, avec une notification. Aimez-les, commentez-les, partagez-les.',
      tip: 'Touchez « Lu » : l’actu se range en bas du fil, et vous voyez d’un coup d’œil ce qui est nouveau.',
    },
    ...(modules.agenda
      ? [
          {
            icon: 'calendar' as const,
            title: 'L’agenda',
            text: 'Tous les événements à venir, avec la date, l’heure et le lieu.',
            tip: 'Dites en un geste si vous venez, et ajoutez l’événement à l’agenda de votre téléphone.',
          },
        ]
      : []),
    ...(modules.offres
      ? [
          {
            icon: 'tag' as const,
            title: labels.offres,
            text: 'Les bons plans réservés aux adhérents.',
            tip: 'Vous pouvez proposer les vôtres depuis « Plus » > « Mes offres » : le bureau les valide avant publication.',
          },
        ]
      : []),
    ...(modules.annuaire
      ? [
          {
            icon: 'people' as const,
            title: labels.annuaire,
            text: 'Retrouvez les membres de l’association et leurs coordonnées.',
            tip: 'Complétez votre propre fiche depuis « Plus » > « Ma fiche annuaire » : photo, coordonnées, description.',
          },
        ]
      : []),
    {
      icon: 'poll',
      title: 'Votre avis compte',
      text: 'Quand le bureau lance un sondage, il s’affiche à l’ouverture de l’application : une réponse suffit.',
      tip: modules.idees ? 'Une idée pour l’association ? Proposez-la dans « Plus » > « Boîte à idées ».' : undefined,
    },
    {
      icon: 'more',
      title: 'Et dans « Plus »',
      text: [
        modules.liens && 'les liens utiles',
        modules.documents && 'les documents',
        'votre compte et vos notifications',
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/^./, (c) => `Retrouvez ${c}`)
        .concat('.'),
      tip: 'Vous pourrez revoir cette visite à tout moment depuis « Plus ».',
    },
  ];
  const last = page === steps.length - 1;

  function finish() {
    markTourDone(profile.id);
    closeTour();
  }

  function goTo(next: number) {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={finish}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.banner }]} accessibilityViewIsModal>
        <View style={styles.top}>
          <Text variant="subhead" style={styles.counter}>
            {page + 1} / {steps.length}
          </Text>
          {!last && <Button compact variant="lightPlain" title="Passer" onPress={finish} />}
        </View>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={styles.flex}>
          {steps.map((step, i) => (
            <View key={step.title} style={[styles.page, { width }]}>
              <Animated.View
                key={i === page ? `on-${i}` : `off-${i}`}
                entering={reduceMotion || i !== page ? undefined : FadeInDown.duration(380)}
                style={styles.pageInner}>
                <View style={styles.badge}>
                  {step.icon === 'logo' ? (
                    <Avatar name={name} uri={branding?.tenant_logo_url} size={72} />
                  ) : (
                    <Icon name={step.icon} size={44} color="#FFFFFF" />
                  )}
                </View>
                <Text variant="largeTitle" style={styles.title}>
                  {step.title}
                </Text>
                <Text style={styles.text}>{step.text}</Text>
                {!!step.tip && (
                  <View style={styles.tip}>
                    <Icon name="info" size={18} color="#FFFFFF" />
                    <Text variant="subhead" style={styles.tipText}>
                      {step.tip}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {steps.map((step, i) => (
            <View key={step.title} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <View style={styles.footer}>
          <Button variant="light" title={last ? 'C’est parti' : 'Suivant'} onPress={() => (last ? finish() : goTo(page + 1))} />
          {page > 0 && <Button variant="lightPlain" title="Précédent" onPress={() => goTo(page - 1)} />}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 44 },
  counter: { color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  page: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  pageInner: { gap: 18 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { color: '#FFFFFF' },
  text: { color: 'rgba(255,255,255,0.92)', fontSize: 18, lineHeight: 26 },
  tip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tipText: { flex: 1, color: '#FFFFFF', lineHeight: 21 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { width: 22, backgroundColor: '#FFFFFF' },
  footer: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
});
