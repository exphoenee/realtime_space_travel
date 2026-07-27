import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import type { EventInstance, EventType } from "../../types";
import styles from "./EventModal.module.css";

interface EventModalProps {
  event: EventInstance;
}

/** String keys whose t() returns the translation. We need a map. */
const I18N_MAP: Record<EventType, string> = {
  horn: "event.horn",
  asteroid: "event.asteroid",
  "rescue-transfer": "event.rescueTransfer",
  "solar-flare": "event.solarFlare",
  rover: "event.rover",
  "fake-instruction": "event.fake",
};

const EventModal = ({ event }: EventModalProps) => {
  const { t } = useTranslation();
  const gamePhase = useGameStore((s) => s.gamePhase);
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const dismissEvent = useGameStore((s) => s.dismissEvent);
  const [timeLeft, setTimeLeft] = useState(event.definition.durationMs / 1000);
  const [actionDone, setActionDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRequiredMs = 3000; // 3 seconds hold for timed horn events

  const i18nPrefix = I18N_MAP[event.id] ?? "event.horn";
  const isFakeInstruction = event.id === "fake-instruction";
  const difficulty = useGameStore.getState().gamePhase; // placeholder — will get from UI store

  // Timer countdown
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timeout — auto-fail
          if (intervalRef.current) clearInterval(intervalRef.current);
          resolveEvent(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [resolveEvent]);

  const handleSuccess = useCallback(() => {
    if (actionDone) return;
    setActionDone(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    resolveEvent(true);
  }, [actionDone, resolveEvent]);

  const handleDismiss = useCallback(() => {
    if (actionDone) return;
    setActionDone(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    dismissEvent();
  }, [actionDone, dismissEvent]);

  // Hold button handlers (for horn timed variant)
  const handleHoldStart = useCallback(() => {
    holdStartRef.current = Date.now();
    const holdInterval = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      setHoldProgress(Math.min(1, elapsed / holdRequiredMs));
      if (elapsed >= holdRequiredMs) {
        clearInterval(holdInterval);
        handleSuccess();
      }
    }, 50);
    return () => clearInterval(holdInterval);
  }, [handleSuccess]);

  const handleHoldEnd = useCallback(() => {
    setHoldProgress(0);
  }, []);

  if (!event) return null;

  return (
    <div className={`${styles.overlay} ${isFakeInstruction ? styles.fake : styles.real}`}>
      <div className={styles.modal}>
        <div className={styles.header}>
          {isFakeInstruction ? (
            <span className={styles.fakeBadge}>⚠️ {t("event.fakeBadge")}</span>
          ) : (
            <span className={styles.warningIcon}>⚠️</span>
          )}
          <h2 className={styles.title}>{t(`${i18nPrefix}.title`)}</h2>
        </div>

        <p className={styles.description}>{t(`${i18nPrefix}.desc`)}</p>

        <div className={styles.timerBar}>
          <div
            className={styles.timerFill}
            style={{
              width: `${(timeLeft / (event.definition.durationMs / 1000)) * 100}%`,
              backgroundColor:
                timeLeft < 5 ? "#ef4444" : timeLeft < 10 ? "#f59e0b" : "#22c55e",
            }}
          />
        </div>
        <p className={styles.timerText}>{t("event.timeLeft", { seconds: timeLeft })}</p>

        <div className={styles.actions}>
          {/* Horn: simple button press */}
          {event.id === "horn" && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.primaryBtn}`}
              onClick={handleSuccess}
              disabled={actionDone}
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
              disabled={actionDone}
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
                disabled={actionDone}
              >
                {t("event.transfer")}
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.secondaryBtn}`}
                onClick={handleDismiss}
                disabled={actionDone}
              >
                {t("event.ignore")}
              </button>
            </div>
          )}

          {/* Solar flare: activate shields */}
          {event.id === "solar-flare" && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.dangerBtn} ${styles.pulseBtn}`}
              onClick={handleSuccess}
              disabled={actionDone}
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
                disabled={actionDone}
              >
                {t("event.deploy")}
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.secondaryBtn}`}
                onClick={handleDismiss}
                disabled={actionDone}
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
                onClick={() => resolveEvent(false)}
                disabled={actionDone}
              >
                {t(`${i18nPrefix}.trapAction`)}
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.primaryBtn}`}
                onClick={handleSuccess}
                disabled={actionDone}
              >
                {t("event.ignore")}
              </button>
            </div>
          )}
        </div>

        {event.id === "horn" && holdProgress > 0 && (
          <div className={styles.holdBar}>
            <div
              className={styles.holdFill}
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EventModal;
