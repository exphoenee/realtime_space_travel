import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import type { EventInstance, EventType } from "../../types";
import styles from "./EventModal.module.css";

interface EventModalProps {
  event: EventInstance;
}

/**
 * Maps EventType to its i18n prefix.
 *
 * Partial on purpose: `doom` has no entry because it never reaches this modal.
 * It is only a marker written to `nextScheduledEvent.eventType` by
 * `scheduleDestruction()` (driving the debug bar countdown and the Wall of
 * Shame icon) — `triggerEvent` is only ever called with an EVENT_DEFINITIONS
 * entry, and `doom` is not one. The lookup below falls back accordingly.
 */
const I18N_MAP: Partial<Record<EventType, string>> = {
  horn: "event.horn",
  asteroid: "event.asteroid",
  "rescue-transfer": "event.rescueTransfer",
  "solar-flare": "event.solarFlare",
  rover: "event.rover",
  "fake-instruction": "event.fake",
};

const RESULT_DISPLAY_MS = 2000;

const EventModal = ({ event }: EventModalProps) => {
  const { t } = useTranslation();
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const dismissEvent = useGameStore((s) => s.dismissEvent);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionDoneRef = useRef(false);
  const [result, setResult] = useState<"success" | "fail" | null>(null);
  const [dodgePenalty, setDodgePenalty] = useState(0);

  const i18nPrefix = I18N_MAP[event.id] ?? "event.horn";
  const isFakeInstruction = event.id === "fake-instruction";
  const totalMs = event.definition.durationMs;
  const startTime = event.triggeredAt;
  const [progress, setProgress] = useState(1); // 1 = full bar, 0 = empty

  // Update the timer bar every 50ms based on elapsed time since event start.
  // This is more reliable than a CSS animation which can glitch on re-renders.
  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1 - elapsed / totalMs);
      setProgress(remaining);
    };
    update();
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [startTime, totalMs]);

  // Auto-fail after duration expires + cleanup on unmount
  useEffect(() => {
    actionDoneRef.current = false;
    setResult(null);
    setDodgePenalty(0);

    timeoutRef.current = setTimeout(() => {
      if (!actionDoneRef.current) {
        actionDoneRef.current = true;
        setResult("fail");
        closeTimerRef.current = setTimeout(() => {
          resolveEvent(false, true); // isAutoFail = true → random severe consequence
        }, RESULT_DISPLAY_MS);
      }
    }, event.definition.durationMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [event.definition.durationMs, resolveEvent]);

  const handleSuccess = useCallback(() => {
    if (actionDoneRef.current) return;
    actionDoneRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // For asteroid success: generate random 5-10 year detour penalty
    const currentEvent = useGameStore.getState().activeEvent;
    const penalty =
      currentEvent?.id === "asteroid"
        ? Math.floor(Math.random() * 6) + 5
        : 0;
    if (penalty > 0) setDodgePenalty(penalty);

    setResult("success");
    closeTimerRef.current = setTimeout(() => {
      if (penalty > 0) {
        resolveEvent(true, undefined, penalty);
      } else {
        resolveEvent(true);
      }
    }, RESULT_DISPLAY_MS);
  }, [resolveEvent]);

  const handleDismiss = useCallback(() => {
    if (actionDoneRef.current) return;
    actionDoneRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const currentEvent = useGameStore.getState().activeEvent;
    setResult("success");
    closeTimerRef.current = setTimeout(() => {
      if (currentEvent?.id === "rescue-transfer") {
        // Ignoring the rescue ship = delayed destruction (random 2-5 minutes)
        const delayMs = Math.floor(Math.random() * 180_000) + 120_000;
        // Log the ignore to missionEventLog so the Wall of Shame records it
        useGameStore.setState((state) => ({
          missionEventLog: [
            ...state.missionEventLog,
            {
              type: "rescue-transfer",
              result: "fail",
              timestamp: Date.now(),
            },
          ],
        }));
        useGameStore.getState().scheduleDestruction(delayMs);
      }
      dismissEvent();
    }, RESULT_DISPLAY_MS);
  }, [dismissEvent]);

  const handleFail = useCallback(() => {
    if (actionDoneRef.current) return;
    actionDoneRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setResult("fail");
    closeTimerRef.current = setTimeout(() => {
      resolveEvent(false);
    }, RESULT_DISPLAY_MS);
  }, [resolveEvent]);

  if (!event) return null;

  return (
    <div className={`${styles.overlay} ${isFakeInstruction ? styles.fake : styles.real}`}>
      <div className={styles.modal}>
        {result ? (
          /* --- Result display (2s before closing) --- */
          <div className={styles.resultOverlay}>
            <div
              className={`${styles.resultIcon} ${result === "success" ? styles.resultSuccess : styles.resultFail}`}
            >
              {result === "success" ? "✓" : "✗"}
            </div>
            <p className={styles.resultText}>
              {t(`${i18nPrefix}.${result}`, { years: dodgePenalty > 0 ? dodgePenalty : event.definition.penaltyAmount })}
            </p>
          </div>
        ) : (
          <>
            {/* --- Event header --- */}
            <div className={styles.header}>
              {isFakeInstruction ? (
                <span className={styles.fakeBadge}>⚠️ {t("event.fakeBadge")}</span>
              ) : (
                <span className={styles.warningIcon}>⚠️</span>
              )}
              <h2 className={styles.title}>{t(`${i18nPrefix}.title`)}</h2>
            </div>

            <p className={styles.description}>{t(`${i18nPrefix}.desc`)}</p>

            {/* Timer bar — JavaScript-driven progress bar */}
            <div className={styles.timerBar}>
              <div
                className={styles.timerFill}
                style={{
                  width: `${progress * 100}%`,
                  backgroundColor:
                    progress > 0.66 ? "#22c55e" : progress > 0.33 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>

            <div className={styles.actions}>
              {/* Horn: simple button press */}
              {event.id === "horn" && (
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.primaryBtn}`}
                  onClick={handleSuccess}
                  disabled={actionDoneRef.current}
                >
                  {t(`${i18nPrefix}.action`)}
                </button>
              )}

              {/* Asteroid: trigger evasive maneuver */}
              {event.id === "asteroid" && (
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.primaryBtn}`}
                  onClick={handleSuccess}
                  disabled={actionDoneRef.current}
                >
                  {t("event.evasiveManeuver")}
                </button>
              )}

              {/* Rescue transfer: choose to transfer or stay */}
              {event.id === "rescue-transfer" && (
                <div className={styles.choiceGroup}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.primaryBtn}`}
                    onClick={handleSuccess}
                    disabled={actionDoneRef.current}
                  >
                    {t("event.transfer")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.secondaryBtn}`}
                    onClick={handleDismiss}
                    disabled={actionDoneRef.current}
                  >
                    {t("event.ignore")}
                  </button>
                </div>
              )}

              {/* Solar flare: activate shields — urgent */}
              {event.id === "solar-flare" && (
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.dangerBtn} ${styles.pulseBtn}`}
                  onClick={handleSuccess}
                  disabled={actionDoneRef.current}
                >
                  {t("event.activate.shields")}
                </button>
              )}

              {/* Rover: deploy or ignore */}
              {event.id === "rover" && (
                <div className={styles.choiceGroup}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.primaryBtn}`}
                    onClick={handleSuccess}
                    disabled={actionDoneRef.current}
                  >
                    {t("event.deploy")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.secondaryBtn}`}
                    onClick={handleDismiss}
                    disabled={actionDoneRef.current}
                  >
                    {t("event.ignore")}
                  </button>
                </div>
              )}

              {/* Fake instruction: player must figure out the correct action */}
              {isFakeInstruction && (
                <div className={styles.choiceGroup}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.trapBtn}`}
                    onClick={handleFail}
                    disabled={actionDoneRef.current}
                  >
                    {t(`${i18nPrefix}.trapAction`)}
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.primaryBtn}`}
                    onClick={handleSuccess}
                    disabled={actionDoneRef.current}
                  >
                    {t("event.ignore")}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EventModal;
