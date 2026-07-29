export const FACE_BALANCE_MIN_RATIO = 0.4;
export const FACE_BALANCE_MAX_RATIO = 1 / FACE_BALANCE_MIN_RATIO;
export const EYE_LEVEL_MAX_OFFSET_RATIO = 0.35;
export const SHIP_SPEED_KM_PER_SECOND = 191;
export const LIGHT_YEAR_TO_KM = 9_460_730_472_580.8;
export const DAYS_PER_YEAR = 365.25;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_HOUR = 60;
export const SECONDS_PER_MINUTE = 60;

export const SECONDS_PER_YEAR =
  DAYS_PER_YEAR * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
export const SHIP_SPEED_LIGHTYEARS_PER_YEAR =
  (SHIP_SPEED_KM_PER_SECOND * SECONDS_PER_YEAR) / LIGHT_YEAR_TO_KM;

export const INACTIVITY_LIMIT_SECONDS = 60;
export const TRAVEL_YEARS_PER_SECOND = 1 / SECONDS_PER_YEAR;

/**
 * Backoff before re-opening the webcam after a NotReadableError/AbortError.
 * Windows keeps the device busy for a moment after the previous handle is
 * released — the consent screen closes its stream seconds before the mission
 * starts, and without a retry the launch dies on that gap. One entry per
 * retry; the list length is the retry count.
 */
export const CAMERA_OPEN_RETRY_DELAYS_MS = [300, 700];

export const INTRO_AUTO_SKIP_TIMEOUT_MS = 600_000;
export const FACE_DETECTION_INTERVAL_MS = 1000;
export const SERVICE_UPDATE_INTERVAL_MS = 50;
export const ATTENTION_INTERVAL_MS = 1_000;
export const MIN_WEATHER_UPDATE_INTERVAL_MS = 30 * 60 * 1000;
export const MAX_WEATHER_UPDATE_INTERVAL_MS = 8 * 60 * 60 * 1000;

export const AUDIO_FADE_STEP = 0.05;
export const AUDIO_FADE_INTERVAL_MS = 50;
export const MUSIC_ACTIVE_VOLUME = 0.6;

export const STAR_COUNT = 400;
export const STAR_SPEED = 0.05;

/**
 * Forbidden words for chat. Comparison is case-insensitive.
 * Message is rejected if it contains any of these words.
 */
export const FORBIDDEN_WORDS: string[] = [
  // ── English ──
  "sex",
  "porn",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cock",
  "dick",
  "nigg",
  "faggot",
  "whore",
  "slut",
  "pussy",
  "cunt",
  // ── Hungarian ──
  "szex",
  "kurva",
  "bazdmeg",
  "faszkivan",
  "geci",
  "kibaszott",
  "anyád",
  "anyad",
  "fasz",
  "szar",
  "picsa",
  "seggfej",
  "balfasz",
  "kúr",
  "fos",
  "hülye",
  // ── French ──
  "merde",
  "putain",
  "connard",
  "salope",
  "enculé",
  "encule",
  "bordel",
  "foutre",
  "bite",
  "chatte",
  "niquer",
  "pute",
  "bâtard",
  "batard",
  "chier",
  "dégage",
  "degage",
  "conne",
  "couille",
  "salaud",
  // ── German ──
  "scheisse",
  "scheiße",
  "fick",
  "arschloch",
  "verdammt",
  "miststück",
  "miststueck",
  "hure",
  "wichser",
  "schwuchtel",
  "schlampe",
  "fotze",
  "arsch",
  "verfickt",
  "kacke",
  "missgeburt",
  "drecksau",
  // ── Spanish ──
  "puta",
  "mierda",
  "cabrón",
  "cabron",
  "joder",
  "coño",
  "gilipollas",
  "hijoputa",
  "maricón",
  "maricon",
  "zorra",
  "polla",
  "culo",
  "carajo",
  "pendejo",
  "verga",
  "puto",
  "concha",
  "chingar",
  "chinga",
];

/** Check if text contains any forbidden word (case-insensitive) */
export const containsForbiddenWords = (text: string): string | null => {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    // Check as whole-word match: word boundary via regex
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|\\s|[^a-zA-Z])${escaped}([^a-zA-Z]|$)`, "i");
    if (pattern.test(lower)) {
      return word;
    }
  }
  return null;
};
