/**
 * Debounces a function
 * @param func a function to be debounced
 * @param timeout the time to wait before calling the function
 * @returns a debounced function
 */
export const debounce = <F extends (...args: Parameters<F>) => ReturnType<F>>(
  func: F,
  waitFor: number = 300
) => {
  let timeout: NodeJS.Timeout;

  const debounced = (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
};

/**
 * Throttles a function
 * @param fn a function to be throttled
 * @param delay the time to wait before calling the function
 * @returns a tuple containing the throttled function, a function to cancel the
 * throttled function, and a function to reset the throttled function
 */
export const throttle = <R, A extends unknown[]>(
  fn: (...args: A) => R,
  delay: number = 500
): [(...args: A) => R | undefined, () => void, () => void] => {
  let wait = false;
  let timeout: undefined | number;
  let cancelled = false;

  function resetWait() {
    wait = false;
  }

  return [
    (...args: A) => {
      if (cancelled) return undefined;
      if (wait) return undefined;

      const val = fn(...args);

      wait = true;

      timeout = window.setTimeout(resetWait, delay);

      return val;
    },
    () => {
      cancelled = true;
      clearTimeout(timeout);
    },
    () => {
      clearTimeout(timeout);
      resetWait();
    },
  ];
};
