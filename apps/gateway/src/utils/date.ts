import { config } from "../config.js";

function datePartsInTimezone(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfDayInTimezone(date = new Date()): Date {
  return new Date(`${datePartsInTimezone(date)}T00:00:00+09:00`);
}

export function endOfDayInTimezone(date = new Date()): Date {
  const start = startOfDayInTimezone(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function atHourOnDate(date: Date, hour: number): Date {
  const h = String(hour).padStart(2, "0");
  return new Date(`${datePartsInTimezone(date)}T${h}:00:00+09:00`);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function daysUntil(dueAt: Date): number {
  const todayStart = startOfDayInTimezone();
  const dueStart = startOfDayInTimezone(dueAt);
  return Math.round((dueStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
}
