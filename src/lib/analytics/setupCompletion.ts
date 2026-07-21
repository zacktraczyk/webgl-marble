export type AnalyticsMarkerStorage = Pick<Storage, "getItem" | "setItem">;

const SETUP_COMPLETION_KEY_PREFIX = "marble:analytics:race-setup-completed:v1:";

const browserStorage = (): AnalyticsMarkerStorage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const markerKey = (raceId: string) => `${SETUP_COMPLETION_KEY_PREFIX}${raceId}`;

export const wasRaceSetupCompleted = (
  raceId: string,
  storage: AnalyticsMarkerStorage | null = browserStorage()
) => {
  if (!storage || !raceId) return false;
  try {
    return storage.getItem(markerKey(raceId)) === "true";
  } catch {
    return false;
  }
};

export const markRaceSetupCompleted = (
  raceId: string,
  storage: AnalyticsMarkerStorage | null = browserStorage()
) => {
  if (!storage || !raceId) return;
  try {
    storage.setItem(markerKey(raceId), "true");
  } catch {
    // Analytics markers must not interrupt the race builder.
  }
};
