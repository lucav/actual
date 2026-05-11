import * as monthUtils from '@actual-app/core/shared/months';
import { type TimeFrame } from '@actual-app/core/types/models';
import { type SyncedPrefs } from '@actual-app/core/types/prefs';

export function validateStartCustom(
  earliest: string,
  start: string,
  end: string,
  interval?: string,
  firstDayOfWeekIdx?: SyncedPrefs['firstDayOfWeekIdx'],
): [string, string, TimeFrame['mode']] {
  let addDays: number;
  let dateStart: string;
  switch (interval) {
    case 'Monthly':
      dateStart = start + '-01';
      addDays = 180;
      break;
    case 'Yearly':
      dateStart = start + '-01-01';
      addDays = 1095;
      break;
    case 'Daily':
      dateStart = start;
      addDays = 6;
      break;
    default:
      dateStart = start;
      addDays = 180;
      break;
  }

  if (end < start) {
    end = monthUtils.addDays(dateStart, addDays);
  }
  return boundedRangeCustom(
    earliest,
    dateStart,
    interval ? end : monthUtils.monthFromDate(end),
    interval,
    firstDayOfWeekIdx,
  );
}

export function validateEndCustom(
  earliest: string,
  start: string,
  end: string,
  interval?: string,
  firstDayOfWeekIdx?: SyncedPrefs['firstDayOfWeekIdx'],
): [string, string, TimeFrame['mode']] {
  let subDays: number;
  let dateEnd: string;
  switch (interval) {
    case 'Monthly':
      dateEnd = monthUtils.getMonthEnd(end + '-01');
      subDays = 180;
      break;
    case 'Yearly':
      dateEnd = end + '-12-31';
      subDays = 1095;
      break;
    case 'Daily':
      dateEnd = end;
      subDays = 6;
      break;
    default:
      dateEnd = end;
      subDays = 180;
      break;
  }

  if (start > end) {
    start = monthUtils.subDays(dateEnd, subDays);
  }
  return boundedRangeCustom(
    earliest,
    interval ? start : monthUtils.monthFromDate(start),
    dateEnd,
    interval,
    firstDayOfWeekIdx,
  );
}

export function validateRangeCustom(
  earliest: string,
  start: string,
  end: string,
) {
  const latest = monthUtils.currentDay();
  /*if (end > latest) {
    end = latest;
  }*/
  if (start < earliest) {
    start = earliest;
  }
  return [start, end];
}

function boundedRangeCustom(
  earliest: string,
  start: string,
  end: string,
  interval?: string,
  firstDayOfWeekIdx?: SyncedPrefs['firstDayOfWeekIdx'],
): [string, string, 'static'] {
  let latest: string;
  switch (interval) {
    case 'Daily':
      latest = monthUtils.currentDay();
      break;
    case 'Weekly':
      latest = monthUtils.currentWeek(firstDayOfWeekIdx);
      break;
    case 'Monthly':
      latest = monthUtils.getMonthEnd(monthUtils.currentDay());
      break;
    case 'Yearly':
      latest = monthUtils.currentDay();
      break;
    default:
      latest = monthUtils.currentMonth();
      break;
  }

  /*if (end > latest) {
    end = latest;
  }*/
  if (start < earliest) {
    start = earliest;
  }
  return [start, end, 'static'];
}

export function getFullRangeCustom(start: string) {
  const end = monthUtils.currentMonth();
  return [start, end, 'full'] as const;
}

export function getLatestRangeCustom(
  offset: number,
  timeFrame?: Partial<TimeFrame>,
) {
  const end = monthUtils.addMonths(
    monthUtils.currentMonth(),
    timeFrame?.forecastOffsetMonths ?? 0,
  );
  const start = monthUtils.subMonths(end, offset);

  return [start, end, 'sliding-window'] as const;
}

export function calculateTimeRangeCustom(
  timeFrame?: Partial<TimeFrame>,
  defaultTimeFrame?: TimeFrame,
) {
  const start =
    timeFrame?.start ??
    defaultTimeFrame?.start ??
    monthUtils.subMonths(monthUtils.currentMonth(), 5);
  const end =
    timeFrame?.end ?? defaultTimeFrame?.end ?? monthUtils.currentMonth();
  const mode = timeFrame?.mode ?? defaultTimeFrame?.mode ?? 'sliding-window';

  if (mode === 'full') {
    return getFullRangeCustom(start);
  }
  if (mode === 'sliding-window') {
    const offset = monthUtils.differenceInCalendarMonths(end, start);

    if (start > end) {
      return [
        end,
        monthUtils.subMonths(end, -offset),
        'sliding-window',
        offset,
      ] as const;
    }

    return getLatestRangeCustom(offset, timeFrame);
  }
  if (mode === 'lastYear') {
    return [
      monthUtils.getYearStart(monthUtils.prevYear(monthUtils.currentMonth())),
      monthUtils.getYearEnd(monthUtils.prevYear(monthUtils.currentDate())),
      'lastYear',
    ] as const;
  }
  if (mode === 'yearToDate') {
    return [
      monthUtils.currentYear() + '-01',
      monthUtils.currentMonth(),
      'yearToDate',
    ] as const;
  }
  if (mode === 'priorYearToDate') {
    return [
      monthUtils.getYearStart(monthUtils.prevYear(monthUtils.currentMonth())),
      monthUtils.prevYear(monthUtils.currentDate(), 'yyyy-MM-dd'),
      'priorYearToDate',
    ] as const;
  }

  if (monthUtils.isAfter(end, monthUtils.currentMonth())) {
    return [start, end, 'sliding-window'] as const;
  } else {
    return [start, end, 'static', 0] as const;
  }
}
