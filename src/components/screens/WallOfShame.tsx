import { useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useUIStore from "../../state/useUIStore";
import { getRtdbKey } from "../../state/useAuthStore";
import { subscribeFailures, subscribeSuccesses, saveSuccessRecord, saveFailureRecord, incrementUserWallet, migrateWallData } from "../../firebase/userData";
import useShopStore from "../../state/useShopStore";
import Collapse from "../ui/Collapse";
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
  const [friendFailures, setFriendFailures] = useState<FailureRecord[]>([]);
  const [friendSuccesses, setFriendSuccesses] = useState<SuccessRecord[]>([]);

  // Sync failure records from RTDB on mount (self mode)
  useEffect(() => {
    if (friendUid) return; // Skip in friend mode

    const rtdbKey = getRtdbKey();
    if (!rtdbKey) return;

    // One-time migration: copy old data from users/{uid}/ to walls/{uid}/
    migrateWallData(rtdbKey).catch(console.error);

    const unsub = subscribeFailures(rtdbKey, (rtdbRecords) => {
      if (rtdbRecords.length > 0) {
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
      }
    });

    return () => unsub();
  }, [friendUid]);

  // In friend mode: subscribe to friend's failures + successes
  // NOTE: migration is NOT called here — it would need to read the OLD path
  // users/{friendUid}/failures which is blocked by users/$key/.read.
  // The migration runs automatically when the owner opens their OWN wall.
  useEffect(() => {
    if (!friendUid) return;

    const unsub1 = subscribeFailures(friendUid, (records) => {
      setFriendFailures(records);
    });
    const unsub2 = subscribeSuccesses(friendUid, (records) => {
      setFriendSuccesses(records);
    });

    return () => {
      unsub1();
      unsub2();
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

    const totalFailures = failureRecords.length;
    const totalSuccesses = successRecords.length;

    // Most common death reason (failures only)
    const reasonCounts: Record<string, number> = {};
    failureRecords.forEach((r) => {
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
  }, [allRecords, failureRecords, successRecords]);

  // Map reason key to a human-readable label
  const reasonLabel = (reason: string) =>
    t(REASON_I18N_KEYS[reason] ?? "wallOfShame.reason.unknown");

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
          <button type="button" className={styles.backButton} onClick={onBack}>
            ← {friendUid ? t("friendWall.back") : t("settings.back")}
          </button>
        </div>

        {/* Summary statistics banner */}
        {stats && (
          <div className={styles.statsBanner}>
            <div className={styles.statsGrid}>
              {/* Row 1 — compact numeric stats */}
              <div className={styles.statsRow}>
                <div className={styles.statCard}>
                  <span className={styles.statCardValue}>
                    {stats.totalMissions}
                  </span>
                  <span className={styles.statCardLabel}>
                    {t("wallOfShame.stats.totalMissions")}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statCardValue}>
                    {stats.totalFailures}
                  </span>
                  <span className={styles.statCardLabel}>
                    {t("wallOfShame.stats.totalFailures")}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statCardValue}>
                    {stats.totalSuccesses}
                  </span>
                  <span className={styles.statCardLabel}>
                    {t("wallOfShame.stats.totalSuccesses")}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statCardValue}>
                    {stats.successRate}%
                  </span>
                  <span className={styles.statCardLabel}>
                    {t("wallOfShame.stats.successRate")}
                  </span>
                </div>
              </div>
              {/* Row 2 — text-heavy stats */}
              <div className={styles.statsRow}>
                <div className={styles.statCard}>
                  <span className={styles.statCardValue}>
                    {stats.mostCommonReason
                      ? reasonLabel(stats.mostCommonReason)
                      : "—"}
                  </span>
                  <span className={styles.statCardLabel}>
                    {t("wallOfShame.stats.mostCommonDeath")}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statCardValue}>
                    {stats.mostUsedShip}
                  </span>
                  <span className={styles.statCardLabel}>
                    {t("wallOfShame.stats.mostUsedShip")}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statCardValue}>
                    {formatYears(stats.totalTravelYears)}
                  </span>
                  <span className={styles.statCardLabel}>
                    {t("wallOfShame.stats.totalTravelTime")}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statCardValue}>
                    {formatDuration(stats.longestService)}
                  </span>
                  <span className={styles.statCardLabel}>
                    {t("wallOfShame.stats.longestService")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug: generate random records + save to Firebase (self only) */}
        {debugMode && !friendUid && (
          <div className={styles.debugActions}>
            <button
              type="button"
              className={styles.debugBtn}
              onClick={() => {
                const gs = useGameStore.getState();
                gs.addDummySuccessRecord();

                const rtdbKey = getRtdbKey();
                const updated = useGameStore.getState();
                const latest = updated.successRecords[updated.successRecords.length - 1];
                if (latest) {
                  // Save to Firebase
                  if (rtdbKey) {
                    saveSuccessRecord(rtdbKey, latest).catch(console.error);
                  }

                  // Add reward credits to the user's wallet
                  const reward = latest.rewardCredits ?? 0;
                  if (reward > 0) {
                    const shopState = useShopStore.getState();
                    const newCredits = shopState.credits + reward;
                    useShopStore.setState({ credits: newCredits });
                    if (rtdbKey) {
                      incrementUserWallet(rtdbKey, reward).catch(console.error);
                    }
                  }
                }
              }}
            >
              🎲 Generate Arrival
            </button>
            <button
              type="button"
              className={`${styles.debugBtn} ${styles.debugBtnFail}`}
              onClick={() => {
                const gs = useGameStore.getState();
                gs.addDummyFailureRecord();

                const rtdbKey = getRtdbKey();
                if (rtdbKey) {
                  const updated = useGameStore.getState();
                  const latest = updated.failureRecords[updated.failureRecords.length - 1];
                  if (latest) {
                    saveFailureRecord(rtdbKey, latest).catch(console.error);
                  }
                }
              }}
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

  const totalEvents = record.events.length;
  const successCount = record.events.filter((e) => e.result === "success").length;
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
            {record.events.map((evt, idx) => (
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

  const totalEvents = record.events.length;
  const successCount = record.events.filter((e) => e.result === "success").length;
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
            {record.events.map((evt, idx) => (
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
