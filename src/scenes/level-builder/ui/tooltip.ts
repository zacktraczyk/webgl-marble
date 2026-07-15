import type { BuilderUi } from ".";

const SHOW_DELAY_MS = 350;
const HIDE_DURATION_MS = 120;
const EDGE_PADDING = 8;
const TRIGGER_GAP = 8;
const SHORTCUT_PATTERN = /^(.*?)\s+\(([^()]*)\)$/;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** Presents builder tooltips without relying on native browser titles. */
export class BuilderTooltipController {
  private activeTrigger: HTMLElement | null = null;
  private pendingTrigger: HTMLElement | null = null;
  private previousDescription: string | null = null;
  private showTimer: number | undefined;
  private hideTimer: number | undefined;
  private openFrame: number | undefined;
  private readonly observer: MutationObserver;

  constructor(
    private readonly ui: BuilderUi,
    signal: AbortSignal
  ) {
    ui.root.addEventListener("pointerover", this.handlePointerOver, { signal });
    ui.root.addEventListener("pointerout", this.handlePointerOut, { signal });
    ui.root.addEventListener("focusin", this.handleFocusIn, { signal });
    ui.root.addEventListener("focusout", this.handleFocusOut, { signal });
    document.addEventListener("keydown", this.handleKeyDown, { signal });
    window.addEventListener("resize", this.reposition, { signal });
    window.addEventListener("scroll", this.reposition, {
      capture: true,
      signal,
    });

    this.observer = new MutationObserver(this.handleTooltipChange);
    this.observer.observe(ui.root, {
      attributes: true,
      attributeFilter: ["data-tooltip"],
      subtree: true,
    });
    signal.addEventListener("abort", this.dispose, { once: true });
  }

  private readonly handlePointerOver = (event: PointerEvent) => {
    const trigger = this.findTrigger(event.target);
    if (
      !trigger ||
      (event.relatedTarget instanceof Node &&
        trigger.contains(event.relatedTarget))
    ) {
      return;
    }
    this.scheduleShow(trigger, SHOW_DELAY_MS);
  };

  private readonly handlePointerOut = (event: PointerEvent) => {
    const trigger = this.findTrigger(event.target);
    if (
      !trigger ||
      (event.relatedTarget instanceof Node &&
        trigger.contains(event.relatedTarget))
    ) {
      return;
    }
    this.scheduleDismiss(trigger);
  };

  private readonly handleFocusIn = (event: FocusEvent) => {
    const trigger = this.findTrigger(event.target);
    if (trigger) {
      this.scheduleShow(trigger, 0);
    }
  };

  private readonly handleFocusOut = (event: FocusEvent) => {
    const trigger = this.findTrigger(event.target);
    if (trigger) {
      this.scheduleDismiss(trigger);
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.hide();
    }
  };

  private readonly handleTooltipChange = (records: MutationRecord[]) => {
    if (
      this.activeTrigger &&
      records.some((record) => record.target === this.activeTrigger)
    ) {
      if (!this.activeTrigger.dataset.tooltip?.trim()) {
        this.hide();
        return;
      }
      this.renderContent(this.activeTrigger);
      this.position();
    }
  };

  private readonly reposition = () => {
    if (this.activeTrigger) {
      this.position();
    }
  };

  private readonly dispose = () => {
    this.observer.disconnect();
    this.clearShowTimer();
    this.clearHideTimer();
    if (this.openFrame !== undefined) {
      cancelAnimationFrame(this.openFrame);
    }
    this.restoreDescription();
    this.activeTrigger = null;
    this.ui.tooltip.hidden = true;
  };

  private findTrigger(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return null;
    }
    const trigger = target.closest("[data-tooltip]");
    return trigger instanceof HTMLElement && this.ui.root.contains(trigger)
      ? trigger
      : null;
  }

  private scheduleShow(trigger: HTMLElement, delay: number) {
    if (this.activeTrigger === trigger) {
      return;
    }
    this.clearShowTimer();
    this.pendingTrigger = trigger;
    this.showTimer = window.setTimeout(() => {
      this.pendingTrigger = null;
      this.show(trigger);
    }, delay);
  }

  private scheduleDismiss(trigger: HTMLElement) {
    window.setTimeout(() => {
      if (
        trigger.matches(":hover") ||
        trigger.contains(document.activeElement)
      ) {
        return;
      }
      if (this.pendingTrigger === trigger) {
        this.clearShowTimer();
      }
      if (this.activeTrigger === trigger) {
        this.hide();
      }
    });
  }

  private show(trigger: HTMLElement) {
    const content = trigger.dataset.tooltip?.trim();
    if (!content || !trigger.isConnected) {
      return;
    }

    this.clearHideTimer();
    this.restoreDescription();
    this.activeTrigger = trigger;
    this.previousDescription = trigger.getAttribute("aria-describedby");
    trigger.setAttribute(
      "aria-describedby",
      [this.previousDescription, this.ui.tooltip.id].filter(Boolean).join(" ")
    );

    this.renderContent(trigger);
    this.ui.tooltip.dataset.open = "false";
    this.ui.tooltip.hidden = false;
    this.position();

    if (this.openFrame !== undefined) {
      cancelAnimationFrame(this.openFrame);
    }
    this.openFrame = requestAnimationFrame(() => {
      if (this.activeTrigger === trigger) {
        this.ui.tooltip.dataset.open = "true";
      }
    });
  }

  private hide() {
    this.clearShowTimer();
    if (!this.activeTrigger) {
      return;
    }
    this.restoreDescription();
    this.activeTrigger = null;
    this.ui.tooltip.dataset.open = "false";
    this.clearHideTimer();
    this.hideTimer = window.setTimeout(() => {
      if (!this.activeTrigger) {
        this.ui.tooltip.hidden = true;
      }
    }, HIDE_DURATION_MS);
  }

  private renderContent(trigger: HTMLElement) {
    const content = trigger.dataset.tooltip?.trim() ?? "";
    const shortcutMatch = content.match(SHORTCUT_PATTERN);
    this.ui.tooltipLabel.textContent = shortcutMatch?.[1] ?? content;
    this.ui.tooltipShortcut.textContent = shortcutMatch?.[2] ?? "";
    this.ui.tooltipShortcut.hidden = !shortcutMatch;
    this.ui.tooltip.setAttribute("aria-label", content);
  }

  private position() {
    const trigger = this.activeTrigger;
    if (!trigger || this.ui.tooltip.hidden) {
      return;
    }

    const triggerBounds = trigger.getBoundingClientRect();
    const tooltipWidth = this.ui.tooltip.offsetWidth;
    const tooltipHeight = this.ui.tooltip.offsetHeight;
    const roomAbove = triggerBounds.top - EDGE_PADDING;
    const roomBelow = window.innerHeight - triggerBounds.bottom - EDGE_PADDING;
    const side =
      roomAbove >= tooltipHeight + TRIGGER_GAP || roomAbove >= roomBelow
        ? "top"
        : "bottom";
    const triggerCenter = triggerBounds.left + triggerBounds.width / 2;
    const maximumLeft = Math.max(
      EDGE_PADDING,
      window.innerWidth - tooltipWidth - EDGE_PADDING
    );
    const left = clamp(
      triggerCenter - tooltipWidth / 2,
      EDGE_PADDING,
      maximumLeft
    );
    const desiredTop =
      side === "top"
        ? triggerBounds.top - tooltipHeight - TRIGGER_GAP
        : triggerBounds.bottom + TRIGGER_GAP;
    const maximumTop = Math.max(
      EDGE_PADDING,
      window.innerHeight - tooltipHeight - EDGE_PADDING
    );
    const top = clamp(desiredTop, EDGE_PADDING, maximumTop);
    const arrowSize = this.ui.tooltipArrow.offsetWidth;
    const arrowLeft = clamp(
      triggerCenter - left - arrowSize / 2,
      EDGE_PADDING,
      tooltipWidth - arrowSize - EDGE_PADDING
    );

    this.ui.tooltip.dataset.side = side;
    this.ui.tooltip.style.left = `${Math.round(left)}px`;
    this.ui.tooltip.style.top = `${Math.round(top)}px`;
    this.ui.tooltipArrow.style.left = `${Math.round(arrowLeft)}px`;
  }

  private restoreDescription() {
    if (!this.activeTrigger) {
      return;
    }
    if (this.previousDescription === null) {
      this.activeTrigger.removeAttribute("aria-describedby");
    } else {
      this.activeTrigger.setAttribute(
        "aria-describedby",
        this.previousDescription
      );
    }
    this.previousDescription = null;
  }

  private clearShowTimer() {
    if (this.showTimer !== undefined) {
      window.clearTimeout(this.showTimer);
      this.showTimer = undefined;
    }
    this.pendingTrigger = null;
  }

  private clearHideTimer() {
    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }
}
