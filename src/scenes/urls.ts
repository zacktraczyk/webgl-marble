/** Page-URL builders for cross-scene navigation. */

const withRace = (path: string, raceId: string) =>
  `${path}?race=${encodeURIComponent(raceId)}`;

/** `/race-builder` for a race. */
export const raceBuilderUrl = (raceId: string) =>
  withRace("/race-builder", raceId);

/** `/leg-builder` for a specific leg of a race. */
export const legBuilderUrl = (raceId: string, legId: string) =>
  `${withRace("/leg-builder", raceId)}&leg=${encodeURIComponent(legId)}`;

/** `/race` player for a race. */
export const racePlayerUrl = (raceId: string) => withRace("/race", raceId);
