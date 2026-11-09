import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

export const toDateKey = (date) => format(date, "yyyy-MM-dd");

export const todayKey = () => toDateKey(new Date());

export const last90Days = () => {
  const dates = [];
  for (let i = 89; i >= 0; i--) {
    dates.push(toDateKey(subDays(new Date(), i)));
  }
  return dates;
};

export const currentWeekDates = () => {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).map(toDateKey);
};

export const lastNDays = (n) => {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    dates.push(toDateKey(subDays(new Date(), i)));
  }
  return dates;
};

export const calcStreak = (dates) => {
  if (!dates || dates.length === 0) {
    return { current: 0, longest: 0 };
  }

  const set = new Set(dates);
  const today = todayKey();
  const yesterday = toDateKey(subDays(new Date(), 1));

  // Calculate current streak
  let current = 0;
  let checkDate = new Date();

  if (!set.has(today)) {
    if (set.has(yesterday)) {
      checkDate = subDays(new Date(), 1);
    } else {
      checkDate = null;
    }
  }

  if (checkDate) {
    while (set.has(toDateKey(checkDate))) {
      current++;
      checkDate = subDays(checkDate, 1);
    }
  }

  // Calculate longest streak
  const sorted = [...set].sort();
  let longest = 0;
  let running = 0;
  let prevDate = null;

  for (const dateStr of sorted) {
    const curDate = new Date(dateStr);
    if (prevDate) {
      const diff = Math.round((curDate - prevDate) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        running++;
      } else {
        running = 1;
      }
    } else {
      running = 1;
    }
    if (running > longest) {
      longest = running;
    }
    prevDate = curDate;
  }

  return { current, longest };
};