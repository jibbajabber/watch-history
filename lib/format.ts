import { getAppTimezone } from "@/lib/app-config";

export function formatEventDateTime(value: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getAppTimezone()
  });

  return formatter.format(new Date(value));
}

export function formatMinutes(totalMinutes: number | null) {
  if (!totalMinutes || totalMinutes <= 0) {
    return "Unknown";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}
