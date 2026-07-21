import type { RaceRepository, RaceDocument } from "../../../raceLibrary";
import type { RaceBuilderUi } from "./elements";

export type RaceBuilderEvent =
  | {
      type: "leg_created";
      race: RaceDocument;
      legNumber: number;
      creationSource: "add_leg" | "complete_setup" | "duplicate_leg";
    }
  | {
      type: "race_updated";
      race: RaceDocument;
    };

/** Shared mutable state + wiring passed into every race-builder UI module. */
export type RaceBuilderContext = {
  readonly ui: RaceBuilderUi;
  readonly repository: RaceRepository;
  readonly raceId: string;
  readonly signal: AbortSignal;
  race: RaceDocument | null;
  draggedItem: HTMLElement | null;
  pendingFocusLegId: string | null;
  onEvent: (event: RaceBuilderEvent) => void;
  render: () => void;
  saveRace: (next: RaceDocument) => void;
  editLegUrl: (legId: string) => string;
};
