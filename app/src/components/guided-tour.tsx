import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { associationName } from '@/components/association';
import {
  ActusArt,
  AgendaArt,
  AnnuaireArt,
  OffresArt,
  PlusArt,
  type PlusRow,
  SondageArt,
  WelcomeArt,
} from '@/components/tour-illustrations';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { INTRO_HOLD_MS } from '@/lib/launch-state';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';
import { closeTour, markTourDone, openTour, tourDone, useTourOpen } from '@/lib/tour';
import { useTheme } from '@/theme';
import { mix } from '@/theme/colors';

type Step = { key: string; art: (active: boolean) => ReactNode; title: string; text: string; tip?: string };

const SETTLE = Easing.out(Easing.cubic);

/**
 * A few screens that show a member what the app offers, each with a small mock-up of the real
 * screen, on the association's color. Only what every member can do: the bureau and administration
 * tools are not part of it. Shown the first time the app opens on an account (on this phone), and
 * again from "Plus" > "Visite guidée".
 */
export function GuidedTour() {
  const { profile, branding } = useMember();
  const { modules, labels, cotisations } = useTenantConfig();
  const visible = useTourOpen();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
  // The two last screens show the real rows of "Plus", with what each one is for.
  const mySpace: PlusRow[] = [
    ...(modules.annuaire ? [{ icon: 'people' as const, label: 'Ma fiche annuaire', detail: 'Photo, coordonnées, description', highlight: true }] : []),
    ...(modules.offres ? [{ icon: 'tag' as const, label: 'Mes offres', detail: 'Proposer un bon plan aux adhérents' }] : []),
    ...(cotisations.enabled ? [{ icon: 'card' as const, label: 'Ma cotisation', detail: 'Où en est votre adhésion' }] : []),
    { icon: 'person', label: 'Mon compte', detail: 'Notifications, membres bloqués, suppression' },
  ];
  const resources: PlusRow[] = [
    ...(modules.idees ? [{ icon: 'lightbulb' as const, label: 'Boîte à idées', detail: 'Proposer, soutenir, commenter', highlight: true }] : []),
    ...(modules.documents ? [{ icon: 'document' as const, label: 'Documents', detail: 'Statuts, comptes rendus, règlements…' }] : []),
    ...(modules.liens ? [{ icon: 'link' as const, label: 'Liens utiles', detail: 'Les sites de l’association' }] : []),
    { icon: 'info', label: 'Visite guidée', detail: 'Revoir cette présentation' },
  ];
  const spaceText = [
    modules.annuaire && 'tenez votre fiche à jour',
    modules.offres && 'proposez vos offres',
    cotisations.enabled && 'suivez votre cotisation',
  ].filter(Boolean) as string[];
  const resourcesText = [
    modules.idees && 'proposez vos idées et soutenez celles des autres',
    modules.documents && 'consultez les documents de l’association',
    modules.liens && 'retrouvez ses liens utiles',
  ].filter(Boolean) as string[];
  const sentence = (parts: string[]) =>
    parts.length ? `${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' et ' : ''}${parts[parts.length - 1]}`.replace(/^./, (c) => c.toUpperCase()) + '.' : '';

  const steps: Step[] = [
    {
      key: 'welcome',
      art: (active) => <WelcomeArt active={active} name={name} logo={branding?.tenant_logo_url} />,
      title: `Bienvenue dans ${name}`,
      text: 'Toute la vie de votre association, dans votre poche. Faisons le tour en une minute.',
    },
    {
      key: 'actus',
      art: (active) => <ActusArt active={active} />,
      title: 'Les actus',
      text: 'Les nouvelles de l’association arrivent dans le fil, avec une notification. Aimez, commentez, partagez.',
      tip: 'Touchez « Lu » : l’actu se range en bas, ce qui est nouveau reste en haut.',
    },
    ...(modules.agenda
      ? [
          {
            key: 'agenda',
            art: (active: boolean) => <AgendaArt active={active} />,
            title: 'L’agenda',
            text: 'Tous les événements à venir, avec la date, l’heure et le lieu.',
            tip: 'Dites en un geste si vous venez, et ajoutez l’événement à votre calendrier.',
          },
        ]
      : []),
    ...(modules.offres
      ? [
          {
            key: 'offres',
            art: (active: boolean) => <OffresArt active={active} />,
            title: labels.offres,
            text: 'Les bons plans réservés aux adhérents, entre membres de l’association.',
            tip: 'Proposez les vôtres dans « Plus » > « Mes offres » : le bureau les valide.',
          },
        ]
      : []),
    ...(modules.annuaire
      ? [
          {
            key: 'annuaire',
            art: (active: boolean) => <AnnuaireArt active={active} />,
            title: labels.annuaire,
            text: 'Retrouvez les membres de l’association, appelez-les ou écrivez-leur en un geste.',
            tip: 'Complétez votre fiche dans « Plus » > « Ma fiche annuaire ».',
          },
        ]
      : []),
    {
      key: 'sondage',
      art: (active) => <SondageArt active={active} />,
      title: 'Votre avis compte',
      text: 'Quand le bureau lance un sondage, il s’affiche à l’ouverture de l’application. Une réponse suffit.',
      tip: modules.idees ? 'Une idée pour l’association ? Proposez-la dans la boîte à idées.' : undefined,
    },
    {
      key: 'mon-espace',
      art: (active) => <PlusArt active={active} rows={mySpace} />,
      title: 'Votre espace, dans « Plus »',
      text: `${sentence(spaceText)} Dans « Mon compte » : vos notifications, les membres que vous avez bloqués, et la suppression de votre compte si besoin.`.trim(),
    },
    {
      key: 'ressources',
      art: (active) => <PlusArt active={active} rows={resources} />,
      title: 'Les ressources de l’association',
      text: resourcesText.length ? `Toujours dans « Plus » : ${resourcesText.join(', ')}.` : 'Toujours dans « Plus », tout ce que l’association met à votre disposition.',
      tip: 'Vous pourrez revoir cette visite à tout moment : « Plus » > « Visite guidée ».',
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
      <LinearGradient colors={[mix(colors.banner, '#FFFFFF', 0.12), colors.banner, mix(colors.banner, '#000000', 0.25)]} style={styles.screen}>
        <View
          style={[styles.screen, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          accessibilityViewIsModal>
          <View style={styles.top}>
            <View style={styles.progress} accessibilityLabel={`Étape ${page + 1} sur ${steps.length}`}>
              {steps.map((s, i) => (
                <Segment key={s.key} done={i <= page} />
              ))}
            </View>
            {!last && (
              <Pressable accessibilityRole="button" hitSlop={12} onPress={finish}>
                <Text variant="subhead" style={styles.skip}>
                  Passer
                </Text>
              </Pressable>
            )}
          </View>
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={styles.flex}>
            {steps.map((step, i) => {
              const active = i === page;
              return (
                <View key={step.key} style={[styles.page, { width }]}>
                  <View style={styles.art}>{step.art(active)}</View>
                  <Animated.View
                    key={active ? 'on' : 'off'}
                    entering={active && !reduceMotion ? FadeInDown.delay(120).duration(420).easing(SETTLE) : undefined}
                    style={styles.copy}>
                    <Text variant="title" style={styles.title}>
                      {step.title}
                    </Text>
                    <Text style={styles.text}>{step.text}</Text>
                    {!!step.tip && (
                      <View style={styles.tip}>
                        <View style={styles.tipIcon}>
                          <Icon name="lightbulb" size={14} color="#0B5F58" />
                        </View>
                        <Text variant="subhead" style={styles.tipText}>
                          {step.tip}
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            {page > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Précédent"
                onPress={() => goTo(page - 1)}
                style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
                <Icon name="chevronLeft" size={20} color="#FFFFFF" />
              </Pressable>
            )}
            <Button
              variant="light"
              title={last ? 'C’est parti' : 'Suivant'}
              onPress={() => (last ? finish() : goTo(page + 1))}
              style={styles.next}
            />
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

function Segment({ done }: { done: boolean }) {
  const fill = useAnimatedStyle(() => ({ width: withTiming(done ? '100%' : '0%', { duration: 350 }) }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 8, minHeight: 44 },
  progress: { flex: 1, flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  segmentFill: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  skip: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  page: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  art: { flex: 1, justifyContent: 'center' },
  copy: { gap: 10, paddingBottom: 12 },
  title: { color: '#FFFFFF' },
  text: { color: 'rgba(255,255,255,0.9)', fontSize: 17, lineHeight: 25 },
  tip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tipIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, color: '#FFFFFF', lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  back: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: { flex: 1 },
});
