export type RaceBuilderUi = {
  missing: HTMLElement | null;
  builder: HTMLElement | null;
  nameInput: HTMLTextAreaElement | null;
  playLink: HTMLAnchorElement | null;
  marbleCount: HTMLOutputElement | null;
  marblesMinus: HTMLButtonElement | null;
  marblesPlus: HTMLButtonElement | null;
  setupToggle: HTMLButtonElement | null;
  setupPopover: HTMLElement | null;
  setupSummaryPill: HTMLElement | null;
  setupWarning: HTMLElement | null;
  setupWarningText: HTMLElement | null;
  marblesPerTeamSlider: HTMLInputElement | null;
  marblesPerTeamOutput: HTMLOutputElement | null;
  legCount: HTMLElement | null;
  legList: HTMLOListElement | null;
  legTemplate: HTMLTemplateElement | null;
  addLegButton: HTMLButtonElement | null;
  completeRaceButton: HTMLButtonElement | null;
  legMoveStatus: HTMLElement | null;
  legsHeader: HTMLElement | null;
  legsDivider: HTMLElement | null;
};

/** Resolves every race-builder DOM node once; callers optional-chain the nullable fields. */
export const resolveRaceBuilderUi = (): RaceBuilderUi => ({
  missing: document.querySelector<HTMLElement>("#missing-race"),
  builder: document.querySelector<HTMLElement>("#race-builder"),
  nameInput: document.querySelector<HTMLTextAreaElement>("#race-name"),
  playLink: document.querySelector<HTMLAnchorElement>("#play-race"),
  marbleCount: document.querySelector<HTMLOutputElement>("#marble-count"),
  marblesMinus: document.querySelector<HTMLButtonElement>("#marbles-minus"),
  marblesPlus: document.querySelector<HTMLButtonElement>("#marbles-plus"),
  setupToggle: document.querySelector<HTMLButtonElement>("#setup-toggle"),
  setupPopover: document.querySelector<HTMLElement>("#setup-popover"),
  setupSummaryPill: document.querySelector<HTMLElement>("#setup-summary-pill"),
  setupWarning: document.querySelector<HTMLElement>("#setup-warning"),
  setupWarningText: document.querySelector<HTMLElement>("#setup-warning-text"),
  marblesPerTeamSlider:
    document.querySelector<HTMLInputElement>("#marbles-per-team"),
  marblesPerTeamOutput: document.querySelector<HTMLOutputElement>(
    "#marbles-per-team-output"
  ),
  legCount: document.querySelector<HTMLElement>("#leg-count"),
  legList: document.querySelector<HTMLOListElement>("#leg-list"),
  legTemplate: document.querySelector<HTMLTemplateElement>("#leg-template"),
  addLegButton: document.querySelector<HTMLButtonElement>("#add-leg"),
  completeRaceButton:
    document.querySelector<HTMLButtonElement>("#complete-race"),
  legMoveStatus: document.querySelector<HTMLElement>("#leg-move-status"),
  legsHeader: document.querySelector<HTMLElement>("#legs-header"),
  legsDivider: document.querySelector<HTMLElement>("#legs-divider"),
});
