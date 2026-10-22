// The opening animation (components/launch-reveal.tsx) plays once per launch of the app. The
// feed appearing behind it waits for the end of the "hold" before animating itself in.

export const INTRO_HOLD_MS = 1250;

let shown = false;

/** True until the opening animation has started for this launch. */
export const introPending = () => !shown;
export const markIntroShown = () => {
  shown = true;
};

/** Delay to add to an entrance animation so that it starts when the opening iris starts. */
export const introDelay = (reduceMotion: boolean) => (!shown && !reduceMotion ? INTRO_HOLD_MS - 100 : 0);
