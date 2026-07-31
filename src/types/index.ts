export type EventType = "horn" | "asteroid" | "rescue-transfer" | "solar-flare" | "rover" | "fake-instruction" | "doom";

export type EventPenaltyType = "time" | "crewLost";

export interface EventDefinition {
  id: EventType;
  /** Minimum difficulty required for this event to appear */
  minDifficulty: Difficulty;
  /** Minimum interval between this event and any other event (ms) */
  minIntervalMs: number;
  /** Base random interval range [min, max] in ms */
  baseIntervalMs: [number, number];
  /** How long the player has to respond (ms) */
  durationMs: number;
  /** Penalty type on failure */
  penaltyType: EventPenaltyType;
  /** Penalty amount in years (for time penalties) */
  penaltyAmount: number;
  /** i18n key prefix */
  i18nKey: string;
  /** Whether this is a rare event (10-20 min cooldown) */
  isRare: boolean;
}

export interface EventInstance {
  id: EventType;
  definition: EventDefinition;
  triggeredAt: number;
  data?: Record<string, unknown>;
}

export type CrewLostReason = "attention" | "buttons" | "event" | "exit" | null;

export type Difficulty = "easy" | "medium" | "hard";

export type GamePhase =
  | "intro"
  | "cameraConsent"
  | "mainMenu"
  | "missionSelect"
  | "shipSelect"
  | "settings"
  | "loading"
  | "playing"
  | "paused"
  | "countdown"
  | "crewLost"
  | "missionComplete"
  | "shop"
  | "wallOfShame"
  | "friends"
  | "friendWall"
  | "chat";

// --- Multiplayer session types ---

export type SessionStatus = "waiting" | "playing" | "ended";

export interface Participant {
  uid: string;
  nickname: string;
  attention: boolean;
  joinedAt: number;
}

export interface MultiplayerSession {
  /** UID of the host player */
  host: string;
  /** Current session status */
  status: SessionStatus;
  /** Timestamp when the session was created */
  createdAt: number;
  /** Map of participant UIDs to their data */
  participants: Record<string, Participant>;
}

// --- Chat types ---

export interface ChatMessage {
  /** UID of the sender */
  from: string;
  /** Message text */
  text: string;
  /** Timestamp when the message was sent */
  at: number;
}

// --- Social / Friends types ---

export type FriendStatus = "pending" | "accepted" | "rejected";

export type UserOnlineStatus = "offline" | "online" | "in-game";

export interface FriendRequest {
  /** UID of the user who sent the request */
  from: string;
  /** Display name / nickname of the sender */
  fromNickname: string;
  /** Timestamp when the request was sent */
  at: number;
  /** Current status of the request */
  status: FriendStatus;
}

// --- Notification types ---

/** Kind of system event a notification represents. */
export type NotificationType =
  | "friendRequest"
  | "friendRequestAccepted"
  | "friendRequestRejected"
  | "chatMessage";

/**
 * A single entry under `notifications/{uid}`.
 *
 * Written by the OTHER party (the sender of the friend request, or the peer who
 * accepted/rejected it), read only by the owner — see the `notifications` rules
 * in `security.rules.json`.
 */
export interface NotificationRecord {
  /** Push ID (normalized from the RTDB key when the record has no own `id`). */
  id: string;
  /** What happened. */
  type: NotificationType;
  /** UID of the user who triggered the event. */
  fromUid: string;
  /** Nickname / display name of the triggering user, for the toast message. */
  fromName: string;
  /** Timestamp when the notification was created. */
  at: number;
  /** Whether the owner has already seen it. */
  read: boolean;
}

export interface UserPublicProfile {
  /** UID of the user */
  uid: string;
  /** User's display name from Google Auth */
  displayName: string | null;
  /** User's custom nickname */
  nickname: string;
  /** Online status */
  onlineStatus: UserOnlineStatus;
}

export interface Star {
  x: number;
  y: number;
  z: number;
}

/**
 * A star as the canvas render loop needs it: position plus the appearance data
 * drawn once at creation and re-drawn on reset.
 *
 * Kept separate from {@link Star} rather than widening it with optional fields,
 * so the public `Star` stays backward-compatible while the draw loop works with
 * required fields and no `??` fallbacks in the hot path.
 */
export interface RenderStar extends Star {
  /** Red channel, 0…255. */
  r: number;
  /** Green channel, 0…255. */
  g: number;
  /** Blue channel, 0…255. */
  b: number;
  /**
   * Pre-built opaque `rgb(...)` string, **shared per spectral class** — one of
   * only six instances in the app. Never rebuilt; alpha comes from
   * `ctx.globalAlpha`, so the draw loop allocates nothing.
   */
  color: string;
  /** Relative brightness, 0…1. Scales both radius and opacity. */
  mag: number;
}

/** The nine text blocks of the intro crawl, in scroll order. */
export type IntroBlockId =
  | "headline"
  | "motto"
  | "paragraph1"
  | "paragraph2"
  | "sectionTitle"
  | "rule1"
  | "rule2"
  | "rule3"
  | "rule4";

/**
 * A fixed-height slot for one intro block.
 *
 * `heightVh` is a multiplier on `window.innerHeight` (0.42 = 42% of the
 * viewport), not a CSS `vh` string. Slots are the reason the layout is
 * deterministic: block positions come from this table, never from how long the
 * translated text happens to be.
 */
export interface IntroSlot {
  id: IntroBlockId;
  heightVh: number;
  /**
   * Font-size range for this block, in px.
   *
   * These carry the typographic hierarchy — a headline must outrank a body
   * paragraph no matter how long the translation is. Fitting only ever shrinks
   * *within* this range, so it can absorb language variance without ever
   * inverting the visual order.
   */
  minFontPx: number;
  maxFontPx: number;
}

/** A slot resolved to its cumulative position. Still in viewport multiples. */
export interface IntroSlotBox {
  id: IntroBlockId;
  /** Distance from the top of the content to the top of this slot. */
  topVh: number;
  heightVh: number;
}

/** Pixel geometry of the scroll animation for one viewport size. */
export interface IntroScrollGeometry {
  startOffsetPx: number;
  endOffsetPx: number;
  distancePx: number;
  durationSec: number;
}

/**
 * When each block is revealed, in milliseconds from animation start.
 *
 * Deliberately contains no viewport term: because the slots are proportional to
 * the viewport *and* the total duration is fixed, the viewport height cancels
 * out of the timing formula. The schedule is the same on every screen.
 */
export interface IntroRevealSchedule {
  reveals: { id: IntroBlockId; atMs: number }[];
  finalInstructionAtMs: number;
  totalMs: number;
}

/** The fitted font size per block, in px — shared by all five languages. */
export type IntroFitResult = Record<IntroBlockId, number>;

export interface Destination {
  name: string;
  travelYears: number;
}

// --- Shop types ---

export type ShopCategory = "exoplanet" | "ship" | "music" | "credits";

export interface ShopProductBase {
  id: string;
  category: ShopCategory;
  name: string;
  priceCredits: number;
  priceEur: number;
}

export interface CreditPack {
  id: string;
  nameKey: string;
  priceEur: number;
  credits: number;
  /** Stripe Payment Link URL for production — redirects back to Firebase Hosting. */
  stripePaymentLink: string;
  /**
   * Stripe Payment Link URL for local development — redirects back to localhost.
   * A Payment Link's return URL is fixed on the Stripe object itself, so dev and
   * prod need separate links. Falls back to `stripePaymentLink` when unset.
   */
  stripePaymentLinkDev?: string;
}

export interface ShipProduct extends ShopProductBase {
  category: "ship";
  speedKmPerSecond: number;
  manufacturer: string;
  capacity: number;
  rangeLy: number;
  descriptionKey: string;
  /** Relative path to the cockpit dashboard image in public/spaceships/ */
  image?: string;
}

export interface MusicProduct extends ShopProductBase {
  category: "music";
  file: string;
  title: string;
}

export interface ExoplanetProduct extends ShopProductBase {
  category: "exoplanet";
  distanceLy: number;
  wage: number;
  starName: string;
  temperatureK: number | null;
  massEarth: number | null;
}

export interface CartItem {
  id: string;
  category: "exoplanet" | "ship" | "music";
  priceCredits: number;
}

export interface OwnedItems {
  ships: string[];
  music: string[];
  exoplanets: string[];
}

/** A single entry in the player's purchase history */
export interface PurchaseRecord {
  /** Unique ID for this purchase */
  id: string;
  /** Name of the purchased item */
  itemName: string;
  /** Category (ship/music/exoplanet/credits) */
  category: string;
  /** How many credits were spent */
  credits: number;
  /** Timestamp of the purchase */
  purchasedAt: number;
  /** For credit packs: the pack ID (e.g. "credits-starter") */
  packId?: string;
}

// --- Wall of Shame types ---

export interface EventLogEntry {
  type: EventType;
  result: "success" | "fail";
  timestamp: number;
}

export interface FailureRecord {
  /** Firebase push ID or generated UUID */
  id: string;
  /** Selected ship name at launch */
  shipName: string;
  /** Selected ship id at launch (null = default ship) */
  shipId: string | null;
  /** Destination planet name */
  destinationName: string;
  /** Timestamp when the mission started */
  launchedAt: number;
  /** Timestamp when the crew was lost */
  failedAt: number;
  /** How long the player lasted (seconds) */
  serviceSeconds: number;
  /** Planned travel time in years (from destination distance & ship speed) */
  travelYears: number;
  /** Why the crew was lost */
  crewLostReason: CrewLostReason;
  /** Events encountered during the mission */
  events: EventLogEntry[];
}

/** A successful mission — ship arrived safely at destination */
export interface SuccessRecord {
  /** Generated UUID */
  id: string;
  /** Selected ship name at launch */
  shipName: string;
  /** Selected ship id at launch (null = default ship) */
  shipId: string | null;
  /** Destination planet name */
  destinationName: string;
  /** Timestamp when the mission started */
  launchedAt: number;
  /** Timestamp when the ship arrived */
  completedAt: number;
  /** How long the journey took (seconds) */
  serviceSeconds: number;
  /** Planned travel time in years (from destination distance & ship speed) */
  travelYears: number;
  /** Events encountered during the mission */
  events: EventLogEntry[];
  /** Credits rewarded for completing the mission */
  rewardCredits?: number;
}
