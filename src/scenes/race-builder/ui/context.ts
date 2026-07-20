import type { RaceRepository, RaceDocument } from "../../../raceLibrary";
import type { RaceBuilderUi } from "./elements";

/** Shared mutable state + wiring passed into every race-builder UI module. */
export type RaceBuilderContext = {
  readonly ui: RaceBuilderUi;
  readonly repository: RaceRepository;
  readonly raceId: string;
  readonly signal: AbortSignal;
  race: RaceDocument | null;
  draggedItem: HTMLElement | null;
  pendingFocusLegId: string | null;
  render: () => void;
  saveRace: (next: RaceDocument) => void;
  editLegUrl: (legId: string) => string;
};
