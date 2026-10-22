# Calendar container sizing

The shared controller measures its own available grid width (subtracting the visible desktop source panel), not browser width. Month needs770px and week560px; day remains available. Disabled controls explain that widening enables them. If the active view no longer fits, choose week or day while preserving the anchor date. Widening does not unexpectedly switch the user's current view. A ResizeObserver is disposed with the controller. Resize/view redraws wait for a pending target save/sync instead of replacing its disabled controls; queued timers are disposed on unmount.

The time grid uses the actual column width rather than an840px minimum. A container query hides the duplicate day agenda under700px, leaving the time grid usable even on a wide browser with open sidebars. Existing event source controls and date navigation are unchanged.

Desktop delivered Ctrl-wheel/trackpad and keyboard density gestures affect only week/day vertical time-slot height, with existing clamps/reset/scroll anchoring. Month stays density1; no gesture changes month cell height or horizontal width. Browser menu/OS zoom remains outside app control. Ordinary scroll and editable controls are not intercepted by the density controller.

Today uses one32px circle with app accent across month/week/day, including holidays. Week/day timed surfaces mix88% pastel fill with transparency, leaving text fully opaque; their text group is vertically centered. Month event text is14.5px and dates16px. Native event types/ordering, all-day exclusive ends and remote data are unchanged.

Creation target selection, month-cell add and mouse range creation remain separate follow-ups; this change does not claim those features complete. Automatic public holiday data still requires a verified supplier.
