/**
 * Coordinates an element's exit animation with actually hiding it. `close`
 * adds the `is-closing` class (whose CSS plays the exit keyframes), waits for
 * every resulting animation to settle, then runs `done` — immediately when
 * there are none, e.g. under prefers-reduced-motion. `cancel` aborts a
 * pending close so a quick reopen never hides the element afterwards.
 */
export const createExitAnimator = (element: HTMLElement) => {
  let token = 0;
  return {
    cancel: () => {
      token += 1;
      element.classList.remove("is-closing");
    },
    close: (done: () => void) => {
      token += 1;
      const current = token;
      element.classList.add("is-closing");
      const finish = () => {
        if (current !== token) return;
        element.classList.remove("is-closing");
        done();
      };
      const animations = element.getAnimations({ subtree: true });
      if (animations.length === 0) finish();
      else Promise.allSettled(animations.map((a) => a.finished)).then(finish);
    },
  };
};
