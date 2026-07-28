export const MOTION = {
  duration: {
    instant: 100,
    fast: 150,
    base: 220,
    overlay: 280,
    drawer: 320,
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0.75, 0.25, 1)',
    emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

export type MotionKeyframes = Parameters<Element['animate']>[0];
type MotionOptions = Exclude<Parameters<Element['animate']>[1], number | undefined>;

export function motionEnabled(): boolean {
  return typeof Element.prototype.animate === 'function';
}

export function playMotion(
  element: Element,
  keyframes: MotionKeyframes,
  options: MotionOptions,
): Animation {
  return element.animate(keyframes, { fill: 'both', ...options });
}

export async function finishMotion(animation: Animation): Promise<void> {
  try {
    await animation.finished;
  } catch {
    // A newer interaction can legitimately cancel an in-flight animation.
  }
}
