import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { associationName } from '@/components/association';
import { measureTarget, revealTarget, type Rect } from '@/components/coach-target';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { INTRO_HOLD_MS } from '@/lib/launch-state';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';
import { closeTour, markTourDone, openTour, tourDone, useTourOpen } from '@/lib/tour';
import { useTheme } from '@/theme';

type Step = { route: Href; target?: string; title: string; text: string };

const DIM = 'rgba(0,0,0,0.62)';
const PAD = 6; // space around the element lit up
const SETTLE_MS = 550; // time for the screen to show and its cards to finish their entrance
const RETRY_MS = 150;
const GIVE_UP_MS = 2000; // element still missing (empty list...): the step is skipped
const SCROLL_MS = 450; // time for a screen to scroll its element into view

/**
 * The guided tour, on the real app: each step opens the right tab, dims the screen and lights up
 * the element it explains, with a bubble beside it. Only what every member can do: the bureau and
 * administration tools are not part of it. The elements are marked with <CoachTarget>; a step whose
 * element is not on screen (no offer yet, module turned off) is skipped. Shown the first time the
 * app opens on an account (on this phone), and again from "Plus" > "Visite guidée".
 */
export function GuidedTour() {
  const { profile, branding } = useMember();
  const { modules, labels } = useTenantConfig();
  const visible = useTourOpen();

  // First launch on this account: wait for the opening animation, then start.
  useEffect(() => {
    if (tourDone(profile.id)) return;
    const timer = setTimeout(openTour, INTRO_HOLD_MS + 900);
    return () => clearTimeout(timer);
  }, [profile.id]);

  const name = associationName(branding) || 'votre association';
  const steps: Step[] = [
    {
      route: '/',
      title: `Bienvenue dans ${name}`,
      text: 'Suivez le guide : en quelques étapes, on vous montre où trouver chaque chose dans l’application.',
    },
    {
      route: '/',
      target: 'actu-card',
      title: 'Le fil d’actus',
      text: 'Onglet « Actus », en bas de l’écran. Touchez une actu pour la lire en entier, l’aimer ou la commenter.',
    },
    {
      route: '/',
      target: 'actu-lu',
      title: 'Rangez ce que vous avez lu',
      text: 'Touchez « Lu » : l’actu se range en bas du fil, sous « Déjà lues ». Ce qui est nouveau reste en haut.',
    },
    ...(modules.agenda
      ? [
          {
            route: '/agenda' as Href,
            target: 'agenda-first',
            title: 'L’agenda',
            text: 'Onglet « Agenda ». Touchez un événement pour dire si vous venez et l’ajouter à l’agenda de votre téléphone.',
          },
        ]
      : []),
    ...(modules.offres
      ? [
          {
            route: '/offres' as Href,
            target: 'offre-first',
            title: labels.offres,
            text: `Onglet « ${labels.offres} ». Les bons plans réservés aux adhérents : touchez-en un pour le détail.`,
          },
        ]
      : []),
    ...(modules.annuaire
      ? [
          {
            route: '/annuaire' as Href,
            target: 'annuaire-search',
            title: labels.annuaire,
            text: `Onglet « ${labels.annuaire} ». Cherchez un membre par son nom ou son activité, puis appelez-le ou écrivez-lui.`,
          },
          {
            route: '/plus' as Href,
            target: 'plus-fiche',
            title: 'Votre fiche',
            text: 'Dans l’onglet « Plus », complétez votre propre fiche : photo, coordonnées, description.',
          },
        ]
      : []),
    ...(modules.idees
      ? [
          {
            route: '/plus' as Href,
            target: 'plus-idees',
            title: 'Une idée ?',
            text: 'Proposez-la dans la boîte à idées : les autres membres peuvent la soutenir et la commenter.',
          },
        ]
      : []),
    {
      route: '/plus',
      target: 'plus-tour',
      title: 'C’est à vous',
      text: 'Vous pourrez revoir cette visite ici à tout moment. Quand le bureau lance un sondage, il s’affiche à l’ouverture de l’application.',
    },
  ];

  if (!visible) return null;
  return <Tour steps={steps} onDone={() => markTourDone(profile.id)} />;
}

function Tour({ steps, onDone }: { steps: Step[]; onDone: () => void }) {
  const { colors } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  // Measured element of the current step: null = no element (centered bubble), undefined = measuring.
  const [measured, setMeasured] = useState<{ index: number; rect: Rect | null } | null>(null);
  const rect: Rect | null | 'measuring' = measured?.index === index ? measured.rect : 'measuring';
  const direction = useRef(1);
  const step = steps[index];
  const last = index === steps.length - 1;

  const finish = useCallback(() => {
    onDone();
    closeTour();
    router.navigate('/');
  }, [onDone]);

  // Each step: open its tab, wait for the element to show, measure it; skip the step if it never shows.
  useEffect(() => {
    let cancelled = false;
    router.navigate(steps[index].route);
    const current = index;
    if (!steps[index].target) {
      const timer = setTimeout(() => !cancelled && setMeasured({ index: current, rect: null }), 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    const started = Date.now();
    const target = steps[index].target!;
    let previous: Rect | null = null;
    const attempt = async () => {
      if (cancelled) return;
      const found = await measureTarget(target);
      if (cancelled) return;
      // Lit up once it stands still: the screen may still be scrolling or animating its cards in.
      const still = found && previous && Math.abs(found.x - previous.x) < 1 && Math.abs(found.y - previous.y) < 1;
      previous = found;
      if (found && still) setMeasured({ index: current, rect: found });
      else if (Date.now() - started < GIVE_UP_MS + SCROLL_MS) setTimeout(attempt, RETRY_MS);
      else {
        const next = index + direction.current;
        if (next >= 0 && next < steps.length) setIndex(next);
        else finish();
      }
    };
    // Once the screen is there, it scrolls the element into view (if it can), then the tour measures.
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (revealTarget(target)) setTimeout(attempt, SCROLL_MS);
      else attempt();
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function go(delta: number) {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    direction.current = delta;
    const next = index + delta;
    if (next >= steps.length) finish();
    else if (next >= 0) setIndex(next);
  }

  const hole = rect && rect !== 'measuring'
    ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 }
    : null;
  // Bubble under the element when it sits in the top half of the screen, above it otherwise.
  const below = hole ? hole.y + hole.h / 2 < H / 2 : false;
  const bubblePosition = !hole
    ? { top: H * 0.3 }
    : below
      ? { top: hole.y + hole.h + 14 }
      : { bottom: H - hole.y + 14 };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={finish}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {hole ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, hole.y) }]} />
            <View style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dim, { top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h }]} />
            <View style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
            <Animated.View
              key={`ring-${index}`}
              entering={reduceMotion ? undefined : FadeIn.duration(250)}
              pointerEvents="none"
              style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />
        )}
        {rect !== 'measuring' && (
          <Animated.View
            key={`bubble-${index}`}
            entering={reduceMotion ? undefined : FadeIn.duration(250)}
            style={[styles.bubble, { backgroundColor: colors.card, width: Math.min(W - 32, 440), left: Math.max(16, (W - Math.min(W - 32, 440)) / 2) }, bubblePosition]}>
            <Text variant="headline">{step.title}</Text>
            <Text tone="secondary">{step.text}</Text>
            <View style={styles.actions}>
              <Text variant="footnote" tone="secondary" style={styles.counter}>
                {index + 1} / {steps.length}
              </Text>
              {!last && <Button compact variant="plain" title="Passer" onPress={finish} />}
              {index > 0 && <Button compact variant="secondary" title="Retour" onPress={() => go(-1)} />}
              <Button compact title={last ? 'C’est parti' : 'Suivant'} onPress={() => go(1)} />
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: DIM },
  ring: { position: 'absolute', borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF' },
  bubble: {
    position: 'absolute',
    borderRadius: 18,
    padding: 18,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  counter: { flex: 1 },
});
