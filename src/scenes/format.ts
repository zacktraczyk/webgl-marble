/** Shared microcopy formatters for the race scenes. */

/** `"1 leg"` / `"3 legs"` — the pluralized count fragment, no surrounding verb. */
export const legCountLabel = (count: number) =>
  `${count} ${count === 1 ? "leg" : "legs"}`;
