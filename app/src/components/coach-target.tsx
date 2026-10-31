import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native';

// Elements of the real screens that the guided tour lights up (components/guided-tour.tsx).
// Each one registers under a name while it is on screen; the tour measures it when its step comes.

export type Rect = { x: number; y: number; width: number; height: number };

const targets = new Map<string, ViewInstance>();
const reveals = new Map<string, () => void>();

/** Lets a screen scroll one of its elements into view when the tour reaches it. */
export function useCoachReveal(ids: string[], reveal: () => void) {
  const key = ids.join(',');
  const latest = useRef(reveal);
  useEffect(() => {
    latest.current = reveal;
  });
  useEffect(() => {
    const run = () => latest.current();
    key.split(',').forEach((id) => reveals.set(id, run));
    return () => key.split(',').forEach((id) => reveals.get(id) === run && reveals.delete(id));
  }, [key]);
}

/** Scrolls the element named `id` into view; false when its screen has nothing to scroll. */
export function revealTarget(id: string): boolean {
  const reveal = reveals.get(id);
  reveal?.();
  return !!reveal;
}

/** Where the element named `id` is on the screen now, or null when it is not displayed. */
export function measureTarget(id: string): Promise<Rect | null> {
  const view = targets.get(id);
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    view.measureInWindow((x: number, y: number, width: number, height: number) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}

/** Marks its child as a stop of the guided tour. `enabled` false: not registered (e.g. not the first card). */
export function CoachTarget({
  id,
  enabled = true,
  style,
  children,
}: {
  id: string;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useRef<ViewInstance>(null);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const view = ref.current;
    targets.set(id, view);
    return () => {
      if (targets.get(id) === view) targets.delete(id);
    };
  }, [id, enabled]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
