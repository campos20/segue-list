export interface MenuPlacementInput {
  /** Trigger's top edge and height, in window coordinates (View.measureInWindow). */
  triggerTop: number;
  triggerHeight: number;
  /** The menu's natural (uncapped) height, or null before it has been measured. */
  menuHeight: number | null;
  windowHeight: number;
  /** Status bar / notch and home-indicator insets the menu must stay clear of. */
  insetTop: number;
  insetBottom: number;
  /** Space between the trigger and the menu. */
  gap?: number;
  /** Minimum margin kept between the menu and the screen edge. */
  edge?: number;
}

export interface MenuPlacement {
  top: number;
  /** Set only when the menu can't fit on either side at full height - it should scroll inside this. */
  maxHeight?: number;
}

/**
 * Decides where an OverflowMenu goes relative to its trigger: below it when
 * it fits, otherwise above it, otherwise on whichever side has more room
 * with its height capped (the caller makes it scroll). A menu that always
 * opened downward ran off the bottom of the screen for any trigger near it -
 * most visibly the setlist menu, which has eight entries.
 */
export function placeMenu({
  triggerTop,
  triggerHeight,
  menuHeight,
  windowHeight,
  insetTop,
  insetBottom,
  gap = 6,
  edge = 8,
}: MenuPlacementInput): MenuPlacement {
  const belowTop = triggerTop + triggerHeight + gap;
  if (menuHeight === null) return { top: belowTop };

  const spaceBelow = windowHeight - insetBottom - edge - belowTop;
  if (menuHeight <= spaceBelow) return { top: belowTop };

  const spaceAbove = triggerTop - gap - (insetTop + edge);
  if (menuHeight <= spaceAbove) return { top: triggerTop - gap - menuHeight };

  if (spaceAbove > spaceBelow) {
    const maxHeight = Math.max(spaceAbove, 0);
    return { top: triggerTop - gap - maxHeight, maxHeight };
  }
  return { top: belowTop, maxHeight: Math.max(spaceBelow, 0) };
}
