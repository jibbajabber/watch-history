const defaultTimezone = "UTC";

export function getAppTimezone() {
  const timezone = process.env.APP_TIMEZONE?.trim();
  return timezone || defaultTimezone;
}

