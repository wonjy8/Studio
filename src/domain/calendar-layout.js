// Widths include date labels and usable event text; measure the calendar's own grid.
export const calendarViewMinimumWidth={day:0,week:560,month:770};
export function calendarViewAllowed(mode,width){return Object.hasOwn(calendarViewMinimumWidth,mode)&&Number.isFinite(width)&&width>=calendarViewMinimumWidth[mode];}
export function fittingCalendarView(mode,width){if(calendarViewAllowed(mode,width))return mode;return calendarViewAllowed('week',width)?'week':'day';}
