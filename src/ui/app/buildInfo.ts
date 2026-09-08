/**
 * Build identity of the running app.
 *
 * Not semver on purpose: the number says nothing about scope or compatibility, it only names one
 * build. Everything is derived from a single UTC instant that vite.config.ts stamps in at build
 * time, so every deploy of the GitHub Pages workflow automatically gets a new one without anything
 * to maintain in the workflow itself.
 */

/** Seconds since UTC midnight in base36, always exactly 4 characters: 00:00:00 -> "0000",
 * 23:59:59 -> "1unz". Unique within a day and sorts chronologically. */
function secondsOfDayStamp(date: Date): string {
  const secondsOfDay = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
  return secondsOfDay.toString(36).padStart(4, '0');
}

/**
 * "DDMMYY.<stamp>" for a real build, e.g. "080926.1c3r". Local builds and the dev server say
 * "dev.<stamp>" instead, so a screenshot of a work in progress can never be mistaken for a deployed
 * version while two local builds stay distinguishable.
 */
export function formatBuildVersion(isoBuildTime: string, isCI: boolean): string {
  const date = new Date(isoBuildTime);
  const stamp = secondsOfDayStamp(date);
  if (!isCI) {
    return `dev.${stamp}`;
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}${month}${year}.${stamp}`;
}

/** The only place the injected constants are read. */
export const APP_BUILD_TIME = __APP_BUILD_TIME__;
export const APP_COMMIT = __APP_COMMIT__;
export const APP_VERSION = formatBuildVersion(__APP_BUILD_TIME__, __APP_IS_CI__);
