import { CAREER_START, CAREER_START_IST } from "./constants";

export function uptime(now: number) {
  const days = Math.floor((now - new Date(CAREER_START).getTime()) / 86400000);
  const y = Math.floor(days / 365);
  const d = days % 365;
  return `${y} year${y === 1 ? "" : "s"}, ${d} days`;
}

export function industry(now: number) {
  const el = Math.max(0, now - new Date(CAREER_START_IST).getTime());
  const days = Math.floor(el / 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    el,
    years: Math.floor(days / 365),
    days: days % 365,
    clock: `${pad(Math.floor(el / 3600000) % 24)}:${pad(Math.floor(el / 60000) % 60)}:${pad(Math.floor(el / 1000) % 60)}`,
    seconds: Math.floor(el / 1000),
  };
}

export const clockLabel = (now: number) =>
  new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
