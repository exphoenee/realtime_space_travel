import { useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useUIStore from "../../state/useUIStore";
import { getRtdbKey } from "../../state/useAuthStore";
import { subscribeFailures, subscribeSuccesses, subscribeLegacyFailures, subscribeLegacySuccesses, migrateWallData } from "../../firebase/userData";
import { generateDebugArrival, generateDebugFailure } from "../../services/debugRecords";
import Collapse from "../ui/Collapse";
import Modal from "../ui/Modal";
import BackButton from "../ui/BackButton";
import type { FailureRecord, SuccessRecord } from "../../types";
import styles from "./WallOfShame.module.css";

/** Map EventType to a descriptive emoji icon */
const EVENT_ICONS: Record<string, string> = {
  horn: "📯",
  asteroid: "☄️",
  "rescue-transfer": "🚁",
  "solar-flare": "🌞",
  rover: "🛸",
  "fake-instruction": "🎭",
  doom: "💀",
};

/** Map crewLostReason to i18n key */
const REASON_I18N_KEYS: Record<string, string> = {
  attention: "wallOfShame.reason.attention",
  buttons: "wallOfShame.reason.buttons",
  event: "wallOfShame.reason.event",
  exit: "wallOfShame.reason.exit",
};

const REASON_CSS_CLASSES: Record<string, string> = {
  attention: styles.reasonAttention,
  buttons: styles.reasonButtons,
  event: styles.reasonEvent,
  exit: styles.reasonExit,
};

/** Format a timestamp to a readable date string */
const formatDate = (ts: number): string => {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Format seconds to a readable duration (e.g., "5 min 23 sec") */
const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return "—";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  if (min > 0) return `${min} min ${sec} sec`;
  return `${sec} sec`;
};

/** Format years with thousand separators (e.g., "45,000 years") */
const formatYears = (years: number): string => {
  if (years == null || years <= 0) return "—";
  return years.toLocaleString() + " years";
};

/**
 * Merge the canonical `walls/{uid}` records with the legacy `users/{uid}`
 * records, deduplicating by `id`. The wall migration copies records verbatim
 * (same `id`), so a partially-migrated user never yields duplicates.
 */
const mergeById = <T extends { id: string }>(primary: T[], legacy: T[]): T[] => {
  if (legacy.length === 0) return primary;
  const seen = new Set(primary.map((r) => r.id));
  return [...primary, ...legacy.filter((r) => !seen.has(r.id))];
};

// ─── Union type for display ───
type DisplayRecord =
  | { kind: "failure"; data: FailureRecord }
  | { kind: "success"; data: SuccessRecord };

interface WallOfShameProps {
  onBack: () => void;
  /** When set, shows the friend's Wall of Shame in read-only mode */
  friendUid?: string;
  friendName?: string;
}

const WallOfShame = ({ onBack, friendUid, friendName }: WallOfShameProps) => {
  const { t } = useTranslation();
  const failureRecords = useGameStore((s) => s.failureRecords);
  const successRecords = useGameStore((s) => s.successRecords);

  const debugMode = useUIStore((s) => s.debugMode);

  // In friend mode, we subscribe to the friend's RTDB records (local state)
  const [wallFailures, setWallFailures] = useState<FailureRecord[]>([]);
  const [wallSuccesses, setWallSuccesses] = useState<SuccessRecord[]>([]);
  // Legacy `users/{uid}` records — friends whose data was never migrated
  const [legacyFailures, setLegacyFailures] = useState<FailureRecord[]>([]);
  const [legacySuccesses, setLegacySuccesses] = useState<SuccessRecord[]>([]);

  const friendFailures = useMemo(
    () => mergeById(wallFailures, legacyFailures),
    [wallFailures, legacyFailures],
  );
  const friendSuccesses = useMemo(
    () => mergeById(wallSuccesses, legacySuccesses),
    [wallSuccesses, legacySuccesses],
  );

  // Sync own records from RTDB on mount (self mode).
  //
  // BOTH failures and successes are pulled: the local store is persisted per
  // browser, so on a new device/browser the RTDB copy is the only source of
  // the player's own history.
  useEffect(() => {
    if (friendUid) return; // Skip in friend mode

    const rtdbKey = getRtdbKey();
    if (!rtdbKey) return;

    // One-time migration: copy old data from users/{uid}/ to walls/{uid}/
    migrateWallData(rtdbKey).catch(console.error);

    const unsubFailures = subscribeFailures(rtdbKey, (rtdbRecords) => {
      if (rtdbRecords.length === 0) return;
      useGameStore.setState((state) => {
        const existingIds = new Set(state.failureRecords.map((r) => r.id));
        const newRecords = rtdbRecords.filter((r) => !existingIds.has(r.id));
        if (newRecords.length === 0) return {};
        return {
          failureRecords: [...state.failureRecords, ...newRecords].sort(
            (a, b) => b.failedAt - a.failedAt,
          ),
        };
      });
    });

    const unsubSuccesses = subscribeSuccesses(rtdbKey, (rtdbRecords) => {
      if (rtdbRecords.length === 0) return;
      useGameStore.setState((state) => {
        const existingIds = new Set(state.successRecords.map((r) => r.id));
        const newRecords = rtdbRecords.filter((r) => !existingIds.has(r.id));
        if (newRecords.length === 0) return {};
        return {
          successRecords: [...state.successRecords, ...newRecords].sort(
            (a, b) => b.completedAt - a.completedAt,
          ),
        };
      });
    });

    return () => {
      unsubFailures();
      unsubSuccesses();
    };
  }, [friendUid]);

  // In friend mode: subscribe to the friend's failures + successes.
  //
  // We read BOTH the canonical `walls/{uid}` path and the legacy
  // `users/{uid}` path, because `migrateWallData` only runs when the OWNER
  // opens their own wall — a friend who has not done so since the migration
  // landed still has all their records under the old path.
  //
  // We cannot migrate on their behalf: `walls/$uid` is writable only by
  // `$uid == auth.uid`. Reading the legacy path IS permitted for friends via
  // the `users/$key/failures|successes` .read rules (read rules cascade down,
  // so the parent's `.read` being false does not revoke the child grant).
  useEffect(() => {
    if (!friendUid) return;

    const unsubs = [
      subscribeFailures(friendUid, setWallFailures),
      subscribeSuccesses(friendUid, setWallSuccesses),
      subscribeLegacyFailures(friendUid, setLegacyFailures),
      subscribeLegacySuccesses(friendUid, setLegacySuccesses),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [friendUid]);

  // Merge & sort all records by timestamp (descending)
  const allRecords = useMemo(() => {
    const records = friendUid
      ? [
          ...friendFailures.map((r) => ({ kind: "failure" as const, data: r })),
          ...friendSuccesses.map((r) => ({ kind: "success" as const, data: r })),
        ]
      : [
          ...failureRecords.map((r) => ({ kind: "failure" as const, data: r })),
          ...successRecords.map((r) => ({ kind: "success" as const, data: r })),
        ];
    return records.sort((a, b) => {
      const tsA = a.kind === "failure" ? a.data.failedAt : a.data.completedAt;
      const tsB = b.kind === "failure" ? b.data.failedAt : b.data.completedAt;
      return tsB - tsA;
    });
  }, [failureRecords, successRecords, friendFailures, friendSuccesses, friendUid]);

  // ─── Summary statistics ───
  const stats = useMemo(() => {
    if (allRecords.length === 0) return null;

    // Use friend's records in friend mode, own records otherwise
    const failures = friendUid ? friendFailures : failureRecords;
    const successes = friendUid ? friendSuccesses : successRecords;

    const totalFailures = failures.length;
    const totalSuccesses = successes.length;

    // Most common death reason (failures only)
    const reasonCounts: Record<string, number> = {};
    failures.forEach((r) => {
      const reason = r.crewLostReason ?? "attention";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const mostCommonReason =
      totalFailures > 0
        ? Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    // Most used ship (all records)
    const shipCounts: Record<string, number> = {};
    allRecords.forEach((r) => {
      const ship = r.data.shipName || "Unknown";
      shipCounts[ship] = (shipCounts[ship] || 0) + 1;
    });
    const mostUsedShip = Object.entries(shipCounts).sort(
      (a, b) => b[1] - a[1],
    )[0][0];

    // Total travel years across all missions
    const totalTravelYears = allRecords.reduce((sum, r) => sum + (r.data.travelYears || 0), 0);

    // Longest service seconds (all records)
    let longest = 0;
    allRecords.forEach((r) => {
      const seconds = r.data.serviceSeconds;
      if (seconds > longest) longest = seconds;
    });

    return {
      totalMissions: allRecords.length,
      totalFailures,
      totalSuccesses,
      successRate:
        allRecords.length > 0
          ? Math.round((totalSuccesses / allRecords.length) * 100)
          : 0,
      mostCommonReason,
      mostUsedShip,
      totalTravelYears,
      longestService: longest,
    };
  }, [allRecords, failureRecords, successRecords, friendFailures, friendSuccesses, friendUid]);

  // Map reason key to a human-readable label
  const reasonLabel = (reason: string) =>
    t(REASON_I18N_KEYS[reason] ?? "wallOfShame.reason.unknown");

  // ─── Reszponzív statisztika: modal < 760px magasságnál ───
  const [statsModalOpen, setStatsModalOpen] = useState(false);

  // A statisztika grid kirajzolása (újrafelhasználható — inline + modal)
  const renderStatsGrid = (compact = false) => (
    <div className={compact ? styles.statsGridCompact : styles.statsGrid}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{stats!.totalMissions}</span>
          <span className={styles.statCardLabel}>
            {t("wallOfShame.stats.totalMissions")}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{stats!.totalFailures}</span>
          <span className={styles.statCardLabel}>
            {t("wallOfShame.stats.totalFailures")}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{stats!.totalSuccesses}</span>
          <span className={styles.statCardLabel}>
            {t("wallOfShame.stats.totalSuccesses")}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{stats!.successRate}%</span>
          <span className={styles.statCardLabel}>
            {t("wallOfShame.stats.successRate")}
          </span>
        </div>
      </div>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>
            {stats!.mostCommonReason
              ? reasonLabel(stats!.mostCommonReason)
              : "—"}
          </span>
          <span className={styles.statCardLabel}>
            {t("wallOfShame.stats.mostCommonDeath")}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{stats!.mostUsedShip}</span>
          <span className={styles.statCardLabel}>
            {t("wallOfShame.stats.mostUsedShip")}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>
            {formatYears(stats!.totalTravelYears)}
          </span>
          <span className={styles.statCardLabel}>
            {t("wallOfShame.stats.totalTravelTime")}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>
            {formatDuration(stats!.longestService)}
          </span>
          <span className={styles.statCardLabel}>
            {t("wallOfShame.stats.longestService")}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {friendUid && friendName
                ? t("friendWall.title", { name: friendName })
                : t("wallOfShame.title")}
            </h1>
            <p className={styles.subtitle}>
              {t("wallOfShame.subtitle", { count: allRecords.length })}
            </p>
          </div>
          <div className={styles.headerActions}>
            {stats && (
              <button
                type="button"
                className={styles.statsToggleBtn}
                onClick={() => setStatsModalOpen(true)}
                title={t("wallOfShame.stats.title", "Statistics")}
              >
                📊
              </button>
            )}
            <BackButton onClick={onBack}>
              ← {friendUid ? t("friendWall.back") : t("settings.back")}
            </BackButton>
          </div>
        </div>

        {/* Summary statistics banner (inline — elrejtve < 760px magasságnál) */}
        {stats && (
          <div className={styles.statsBanner}>
            {renderStatsGrid()}
          </div>
        )}

        {/* Statistics modal (alacsony viewportokon) */}
        <Modal
          isOpen={statsModalOpen}
          onClose={() => setStatsModalOpen(false)}
          title={t("wallOfShame.stats.title", "Statistics")}
          closeAriaLabel={t("settings.back")}
        >
          <div className={styles.statsModalBody}>
            {stats && renderStatsGrid(true)}
          </div>
        </Modal>

        {/* Debug: generate random records + save to Firebase (self only) */}
        {debugMode && !friendUid && (
          <div className={styles.debugActions}>
            <button
              type="button"
              className={styles.debugBtn}
              onClick={() => generateDebugArrival()}
            >
              🎲 Generate Arrival
            </button>
            <button
              type="button"
              className={`${styles.debugBtn} ${styles.debugBtnFail}`}
              onClick={() => generateDebugFailure()}
            >
              💀 Generate Failure
            </button>
          </div>
        )}

        {/* Wall — scrollable card list */}
        <div className={styles.wall}>
          {allRecords.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🚀</span>
              <p className={styles.emptyText}>
                {t("wallOfShame.emptyMissions")}
              </p>
            </div>
          ) : (
            allRecords.map((record) =>
              record.kind === "failure" ? (
                <FailureEntry key={record.data.id} record={record.data} />
              ) : (
                <SuccessEntry key={record.data.id} record={record.data} />
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
};

/** Single failure entry — a "tombstone" card */
const FailureEntry = ({ record }: { record: FailureRecord }) => {
  const { t } = useTranslation();

  // RTDB drops empty arrays, so `events` can be missing on records that had
  // none. Normalized in subscribeWallRecords too — this guards direct callers.
  const events = record.events ?? [];
  const totalEvents = events.length;
  const successCount = events.filter((e) => e.result === "success").length;
  const failCount = totalEvents - successCount;

  const reasonKey =
    REASON_I18N_KEYS[record.crewLostReason ?? "attention"] ??
    "wallOfShame.reason.unknown";
  const reasonClass =
    REASON_CSS_CLASSES[record.crewLostReason ?? "attention"] ??
    styles.reasonAttention;
  const reasonLabelText = t(reasonKey);

  return (
    <div className={`${styles.entry} ${styles.entryFailure}`}>
      {/* Header row */}
      <div className={styles.entryHeader}>
        <span className={styles.entryIcon}>💀</span>
        <div className={styles.entryInfo}>
          <div className={styles.entryShip}>{record.shipName}</div>
          <div className={styles.entryDestination}>
            🪐 {record.destinationName}
          </div>
          <span className={`${styles.reasonBadge} ${reasonClass}`}>
            {reasonLabelText}
          </span>
        </div>
        <div className={styles.entryMeta}>
          <div className={styles.entryDate}>{formatDate(record.failedAt)}</div>
          <div className={styles.entryDuration}>
            {formatDuration(record.serviceSeconds)}
          </div>
          <div className={styles.entryTravel}>
            🚀 {formatYears(record.travelYears)}
          </div>
        </div>
      </div>

      {/* Collapsible details */}
      {totalEvents > 0 && (
        <div className={styles.details}>
          <Collapse
            title={t("wallOfShame.events", { count: totalEvents })}
            badge={`${successCount}✓ ${failCount}✗`}
            defaultOpen={false}
          >
            {events.map((evt, idx) => (
              <div key={idx} className={styles.eventRow}>
                <span className={styles.eventIcon}>
                  {EVENT_ICONS[evt.type] ?? "❓"}
                </span>
                <span className={styles.eventName}>
                  {t(`event.${evt.type}.title`, "—")}
                </span>
                <span
                  className={`${styles.eventResult} ${
                    evt.result === "success"
                      ? styles.eventSuccess
                      : styles.eventFail
                  }`}
                >
                  {evt.result === "success"
                    ? t("wallOfShame.success")
                    : t("wallOfShame.fail")}
                </span>
              </div>
            ))}

            <div className={styles.detailsStats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{totalEvents}</span>
                <span className={styles.statLabel}>
                  {t("wallOfShame.stat.total")}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{successCount}</span>
                <span className={styles.statLabel}>
                  {t("wallOfShame.stat.solved")}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{failCount}</span>
                <span className={styles.statLabel}>
                  {t("wallOfShame.stat.failed")}
                </span>
              </div>
            </div>
          </Collapse>
        </div>
      )}
    </div>
  );
};

/** Single success entry — a trophy card for successful arrivals */
const SuccessEntry = ({ record }: { record: SuccessRecord }) => {
  const { t } = useTranslation();

  // See FailureEntry — RTDB omits empty arrays entirely.
  const events = record.events ?? [];
  const totalEvents = events.length;
  const successCount = events.filter((e) => e.result === "success").length;
  const failCount = totalEvents - successCount;

  return (
    <div className={`${styles.entry} ${styles.entrySuccess}`}>
      {/* Header row */}
      <div className={styles.entryHeader}>
        <span className={styles.entryIcon}>🏆</span>
        <div className={styles.entryInfo}>
          <div className={styles.entryShip}>{record.shipName}</div>
          <div className={styles.entryDestination}>
            🪐 {record.destinationName}
          </div>
          <span className={`${styles.reasonBadge} ${styles.reasonSuccess}`}>
            {t("wallOfShame.reason.success")}
          </span>
        </div>
        <div className={styles.entryMeta}>
          <div className={styles.entryDate}>
            {formatDate(record.completedAt)}
          </div>
          <div className={styles.entryDuration}>
            {formatDuration(record.serviceSeconds)}
          </div>
          <div className={styles.entryTravel}>
            🚀 {formatYears(record.travelYears)}
          </div>
          {(record.rewardCredits ?? 0) > 0 && (
            <div className={styles.entryReward}>
              ⭐ +{record.rewardCredits}
            </div>
          )}
        </div>
      </div>

      {/* Collapsible details */}
      {totalEvents > 0 && (
        <div className={styles.details}>
          <Collapse
            title={t("wallOfShame.events", { count: totalEvents })}
            badge={`${successCount}✓ ${failCount}✗`}
            defaultOpen={false}
          >
            {events.map((evt, idx) => (
              <div key={idx} className={styles.eventRow}>
                <span className={styles.eventIcon}>
                  {EVENT_ICONS[evt.type] ?? "❓"}
                </span>
                <span className={styles.eventName}>
                  {t(`event.${evt.type}.title`, "—")}
                </span>
                <span
                  className={`${styles.eventResult} ${
                    evt.result === "success"
                      ? styles.eventSuccess
                      : styles.eventFail
                  }`}
                >
                  {evt.result === "success"
                    ? t("wallOfShame.success")
                    : t("wallOfShame.fail")}
                </span>
              </div>
            ))}

            <div className={styles.detailsStats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{totalEvents}</span>
                <span className={styles.statLabel}>
                  {t("wallOfShame.stat.total")}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{successCount}</span>
                <span className={styles.statLabel}>
                  {t("wallOfShame.stat.solved")}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{failCount}</span>
                <span className={styles.statLabel}>
                  {t("wallOfShame.stat.failed")}
                </span>
              </div>
            </div>
          </Collapse>
        </div>
      )}
    </div>
  );
};

export default WallOfShame;
