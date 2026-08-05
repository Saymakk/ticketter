/** localStorage key for Healthy Life "remember me" preference */
export const HL_REMEMBER_ME_KEY = "hl-remember-me";

/** Cookie lifetime when "remember me" is on (Chrome max ≈ 400 days). */
export const HL_REMEMBER_MAX_AGE = 400 * 24 * 60 * 60;

/** Cookie lifetime when "remember me" is off — roughly one workday session. */
export const HL_SESSION_MAX_AGE = 12 * 60 * 60;

export function readRememberMePreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(HL_REMEMBER_ME_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeRememberMePreference(remember: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HL_REMEMBER_ME_KEY, remember ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
