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

export const STAR_COUNT = 1200;
/**
 * Star approach speed, in **z-units per 60 FPS frame**. The draw loop scales it
 * by a delta-time factor, so the perceived speed is the same on a 60 Hz and a
 * 144 Hz display.
 */
export const STAR_SPEED = 0.05;

/**
 * How far each star's blackbody colour is pushed toward white.
 *
 * Not 1.0 on purpose: raw blackbody colours across a full field read as
 * "disco", and on the real sky the eye sees faint stars as near-white — colour
 * only shows on the brightest ones. `0` = every star white (the pre-019 look).
 *
 * Subjective; tuned live against 0.4 / 0.65 / 1.0.
 */
export const STAR_COLOR_SATURATION = 0.85;

/**
 * Power-law exponent for the per-star brightness draw (`random ** exponent`).
 * A higher exponent means fewer bright stars and more faint ones.
 */
export const STAR_MAG_EXPONENT = 2.5;

/** Radius multiplier range driven by a star's magnitude. */
export const STAR_MAG_SIZE_MIN = 0.45;
export const STAR_MAG_SIZE_MAX = 1.35;

/**
 * Opacity multiplier range driven by a star's magnitude.
 *
 * Deliberately a different range from the size multipliers: applying one shared
 * factor to both would make faint stars simultaneously tiny *and* transparent,
 * and their product would be invisible.
 */
export const STAR_MAG_ALPHA_MIN = 0.25;
export const STAR_MAG_ALPHA_MAX = 1.0;

/** Base radius scale before the magnitude multiplier is applied. */
export const STAR_BASE_RADIUS_SCALE = 2.5;

/**
 * Radius floor in CSS pixels. Circles smaller than about a pixel do not
 * disappear — antialiasing renders them as a faint blob whose intensity jitters
 * against the pixel grid, which shows up as crawling/sparkle while moving. The
 * light lost to the clamp is taken off the alpha instead, area-proportionally.
 */
export const STAR_MIN_RADIUS_PX = 0.7;

/**
 * Upper bound on `devicePixelRatio`. At dpr 3–4 the fill rate would grow 9–16×
 * for a full-screen clear plus one arc per star (plus a stroke each in warp);
 * the sharpness gain from 2× to 3× is marginal compared to that cost.
 */
export const STAR_MAX_DEVICE_PIXEL_RATIO = 2;

/** Reference frame duration used to normalise delta time to 60 FPS. */
export const TARGET_FRAME_MS = 1000 / 60;

/**
 * Delta-time ceiling, in frames. After a tab switch the browser resumes
 * `requestAnimationFrame` with a multi-second gap; without this clamp the whole
 * field would jump forward in a single frame.
 */
export const STAR_MAX_DELTA_FRAMES = 3;

/**
 * Length multiplier for warp streaks.
 *
 * `3` reproduces the pre-019 behaviour exactly, so lifting it out of the formula
 * is behaviour-neutral. This is the tuning knob if the field feels like it has
 * "less warp" after magnitudes were introduced (streak length derives from the
 * radius, which magnitude now scales) — raise it toward 4…4.5 rather than
 * removing the magnitude effect.
 */
export const STAR_STREAK_LENGTH_FACTOR = 3;

/**
 * Per-frame easing factor for the evasive manoeuvre.
 *
 * One constant covers all three uses — approach (`+= difference * 0.08`), decay
 * (`*= 0.92`) and the roll — because `0.92` is exactly `1 - 0.08`: they are all
 * "8% per frame". `frameRateAdjustedLerp` normalises it for delta time.
 */
export const STAR_DRIFT_SMOOTHING = 0.08;

/**
 * Maximum random roll during an evasive manoeuvre, in degrees (±).
 *
 * Subjective, tuned live. Deliberately restrained: this is an AFK game where the
 * player stares at the screen for hours, and a large-amplitude spin is tiring
 * and can cause motion sickness. Tuning range: 4…12.
 */
export const STAR_ROLL_MAX_DEGREES = 12;

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
