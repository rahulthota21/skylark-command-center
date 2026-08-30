import { format, isValid, parseISO } from "date-fns";

export interface CalendarRange {
  start: string;
  end: string;
  label: string;
}

/** Returns the calendar day in Asia/Kolkata, independent of server location. */
export function indiaDateParts(now = new Date()): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function indiaToday(now = new Date()): string {
  const { year, month, day } = indiaDateParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function currentCalendarQuarter(now = new Date()): CalendarRange {
  const { year, month } = indiaDateParts(now);
  const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return {
    start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    end: `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
    label: `Q${quarter} ${year}`,
  };
}

export function previousCalendarQuarter(now = new Date()): CalendarRange {
  const current = currentCalendarQuarter(now);
  const start = parseISO(current.start);
  const previousEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
  const previousStart = new Date(Date.UTC(previousEnd.getUTCFullYear(), previousEnd.getUTCMonth() - 2, 1));
  const quarter = Math.floor(previousStart.getUTCMonth() / 3) + 1;
  return {
    start: format(previousStart, "yyyy-MM-dd"),
    end: format(previousEnd, "yyyy-MM-dd"),
    label: `Q${quarter} ${previousStart.getUTCFullYear()}`,
  };
}

export function quarterForDate(isoDate: string): CalendarRange | null {
  const date = parseISO(isoDate);
  if (!isValid(date)) return null;
  const year = date.getUTCFullYear();
  const startMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  const endMonth = startMonth + 3;
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return {
    start: `${year}-${String(startMonth + 1).padStart(2, "0")}-01`,
    end: `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
    label: `Q${quarter} ${year}`,
  };
}

export function dateInRange(date: string | undefined, range?: Pick<CalendarRange, "start" | "end">): boolean {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

export function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "Not available";
  const parsed = parseISO(isoDate);
  if (!isValid(parsed)) return "Not available";
  return format(parsed, "dd MMM yyyy");
}
