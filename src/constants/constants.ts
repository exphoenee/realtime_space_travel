import type { IntroSlot } from "../types";

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

/**
 * Fixed-height slots for the nine intro blocks — **the main tuning surface of
 * the deterministic intro layout.**
 *
 * `heightVh` multiplies `window.innerHeight`. Because the slots are viewport
 * proportions rather than text-derived heights, every block sits at the same
 * relative position on every screen and in every language. Text is top-aligned
 * inside its slot, so a shorter translation leaves its slack at the bottom
 * rather than shifting the first line down.
 *
 * Total: 3.02 viewports.
 *
 * The per-block font ranges carry the typographic hierarchy. They are
 * deliberately generous — this is a cinematic crawl, not a document, so the
 * body text is meant to be large. The ranges bias the order rather than prove
 * it: the ceilings descend from headline to body, so with any realistic
 * translation the headline comes out largest.
 *
 * Two things make that reliable in practice. The headline text — "Realtime
 * Space Travel" — is byte-identical in all five languages, so language variance
 * cannot shrink it at all; its size follows only from its slot and the column
 * width. And the block that *is* most variable, the section title, has the
 * shortest text of the three heading-like blocks.
 *
 * If a future translation ever does invert the order, the fix is the ranges
 * here, not the fitting logic.
 */
export const INTRO_SLOTS: readonly IntroSlot[] = Object.freeze([
  { id: "headline", heightVh: 0.3, minFontPx: 34, maxFontPx: 120 },
  { id: "motto", heightVh: 0.2, minFontPx: 24, maxFontPx: 72 },
  { id: "paragraph1", heightVh: 0.42, minFontPx: 18, maxFontPx: 56 },
  { id: "paragraph2", heightVh: 0.42, minFontPx: 18, maxFontPx: 56 },
  { id: "sectionTitle", heightVh: 0.24, minFontPx: 22, maxFontPx: 68 },
  { id: "rule1", heightVh: 0.36, minFontPx: 18, maxFontPx: 56 },
  { id: "rule2", heightVh: 0.36, minFontPx: 18, maxFontPx: 56 },
  { id: "rule3", heightVh: 0.36, minFontPx: 18, maxFontPx: 56 },
  { id: "rule4", heightVh: 0.36, minFontPx: 18, maxFontPx: 56 },
] as const);

/**
 * Where the content starts, in viewports below the top of the screen.
 *
 * Must stay **above 1.0**, otherwise the first block begins already on screen
 * instead of flying in from below. The 0.02 margin is what gives the headline
 * its ~2.6 s glide before it reaches the reveal line.
 */
export const INTRO_START_PAD_VH = 1.02;

/**
 * Where the content ends, in viewports above the top of the screen.
 *
 * Must stay **above 0** — this is the single most important invariant here. It
 * is what guarantees the last block's bottom edge clears the top of the screen,
 * and therefore that the closing caption appears at all. The old layout had no
 * such guarantee: it only worked when the content happened to be no taller than
 * `viewport + 200px`, which nine blocks of text never are.
 */
export const INTRO_END_PAD_VH = 0.1;

/**
 * Total scroll duration in seconds (9 minutes).
 *
 * **The duration is fixed, not the speed** — that is what makes the intro run
 * for the same length of time on every screen. 540 s keeps the old glacial feel
 * while fitting inside the 600 s auto-skip: the old code asked for ~674 s at
 * 1080p and was always cut short, which is why the closing caption was never
 * reachable in time either.
 */
export const INTRO_TOTAL_DURATION_SEC = 540;

/** The pre-existing `animation-delay: 4s`, lifted into a name. */
export const INTRO_SCROLL_DELAY_SEC = 4;

/**
 * Extra beat between the last block leaving the screen and the closing caption
 * appearing, so the caption does not arrive on top of the final line still
 * fading out. Scales with the debug multiplier like the rest of the timeline.
 */
export const INTRO_FINAL_INSTRUCTION_DELAY_SEC = 2;

/**
 * The screen line at which a block is revealed, as a fraction of the viewport
 * height. `1.0` is the bottom edge.
 *
 * **This is not the old value** (the old code used 2/3). At a constant scroll
 * speed the headline can only travel ~25 px in the few seconds allowed before
 * it must appear, while the 2/3 line sits ~360 px above the bottom edge — so
 * "flies in from below" and "appears within 5–10 s" cannot both hold unless the
 * reveal line is the bottom edge itself. Side benefit: the old permanently
 * blank bottom third of the screen goes away.
 *
 * Documented fallback if the edge reveal reads badly: `2/3` with
 * `INTRO_START_PAD_VH = 0.688`, at the cost of the first block no longer
 * flying in.
 */
export const INTRO_REVEAL_TRIGGER_RATIO = 1.0;

/**
 * Font-size bounds for the fitting pass. Hitting the floor means the text
 * overflows its slot and the slot table needs tuning.
 */
export const INTRO_MIN_FONT_SIZE_PX = 12;
export const INTRO_MAX_FONT_SIZE_PX = 140;

/** Starting font size for the measurement probe. */
export const INTRO_FIT_PROBE_FONT_SIZE_PX = 24;

/**
 * Bisection refinement steps after the linear first guess.
 *
 * Rendered height is a *step* function of font size — line breaking is discrete
 * — so a purely linear estimate can land on either side of the target.
 */
export const INTRO_FIT_BISECTION_STEPS = 5;

/** Period of the self-correcting reveal scheduler. */
export const INTRO_SCHEDULE_TICK_MS = 250;

/** Debounce before re-measuring after a resize. */
export const INTRO_RESIZE_DEBOUNCE_MS = 250;

/**
 * Height-only viewport changes below this are ignored for re-measurement.
 * Mobile browsers fire resize as the URL bar slides in and out; re-fitting the
 * whole crawl for that would be both wasteful and visibly jumpy.
 */
export const INTRO_RESIZE_HEIGHT_THRESHOLD_PX = 120;

/** In debug mode the whole timeline is divided by this — every reveal too. */
export const INTRO_DEBUG_SPEED_MULTIPLIER = 8;

/**
 * Mandatory reading margin between the closing caption and the auto-skip.
 * A unit test asserts the schedule respects it, so raising the slot heights or
 * the duration past the auto-skip fails the build rather than silently making
 * the caption unreachable again.
 */
export const INTRO_FINAL_READ_MARGIN_MS = 30_000;
export const FACE_DETECTION_INTERVAL_MS = 1000;

/**
 * Master switch for the mobile/tablet camera orientation compensation.
 *
 * When `true`, on a touch-primary device held in a rotated orientation the
 * sensor image is drawn onto an offscreen canvas rotated back to upright before
 * being handed to the face detector (see `useFaceDetection` +
 * `src/services/cameraOrientation.ts`). Set to `false` as an emergency kill
 * switch to restore the pre-022 behaviour globally: the raw `<video>` is fed to
 * `estimateFaces` on every device and orientation.
 */
export const CAMERA_ORIENTATION_COMPENSATION = true;

/**
 * Sign of the back-rotation applied to the sensor image.
 *
 * The rotation direction that brings the image upright is device- and
 * sensor-orientation dependent (front-camera mirroring complicates it further),
 * so it is a tunable constant rather than a fixed value. Starting point: rotate
 * the image opposite to the screen angle (`-1`).
 *
 * **Tune live:** if the face arrives upside-down on the debug canvas, flip this
 * to `+1`.
 */
export const CAMERA_ROTATION_SIGN = -1;
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
 * Forbidden words for chat and nicknames. Comparison is case-insensitive.
 * Message/nickname is rejected if it contains any of these words.
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
  "motherfucker",
  "douchebag",
  "twat",
  "wanker",
  "wank",
  "tosser",
  "bellend",
  "knobhead",
  "shithead",
  "dickhead",
  "arsehole",
  "bollocks",
  "bugger",
  "nonce",
  "retard",
  "tranny",
  "sod",
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
  "kúrva",
  "fos",
  "hülye",
  "barom",
  "fattyú",
  "fatty",
  "rohadt",
  "picsába",
  "genyó",
  "pöcs",
  "faszszopó",
  "kurvanyátok",
  "rohadék",
  "tahó",
  "bunkó",
  "tróger",
  "taknyos",
  // ── French ──
  "merde",
  "putain",
  "connard",
  "connasse",
  "salope",
  "enculé",
  "encule",
  "enculée",
  "bordel",
  "foutre",
  "bite",
  "chatte",
  "niquer",
  "nique",
  "pute",
  "bâtard",
  "batard",
  "chier",
  "dégage",
  "degage",
  "conne",
  "couille",
  "salaud",
  "fils de pute",
  "ta gueule",
  "emmerde",
  "emmerdeur",
  "salopard",
  "branleur",
  "fumier",
  "ordure",
  "crétin",
  "débile",
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
  "vollidiot",
  "mistkerl",
  "dreckskerl",
  "saupreuss",
  "sauhund",
  "dummkopf",
  "hirnlos",
  "idiot",
  "spasti",
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
  "capullo",
  "imbécil",
  "imbecil",
  "estúpido",
  "estupido",
  "idiota",
  "subnormal",
  "desgraciado",
  // ── Italian ──
  "cazzo",
  "merda",
  "troia",
  "stronzo",
  "frocio",
  "culattone",
  "bastardo",
  "testa di cazzo",
  "vaffanculo",
  "porco",
  "minchia",
  "puttana",
  "figlio di puttana",
  "coglione",
  "deficiente",
  "stupido",
  // ── Portuguese ──
  "porra",
  "caralho",
  "puta",
  "merda",
  "fodasse",
  "foda-se",
  "cabrão",
  "cabanão",
  "filho da puta",
  "otário",
  "otario",
  "arrombado",
  "piranha",
  "bicha",
  "corno",
  "desgraçado",
  // ── Japanese (romanized) ──
  "kuso",
  "shimatta",
  "temee",
  "kisama",
  "orya",
  "chikusho",
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
