import { useState, useEffect, useCallback } from "react";
import type { EventType } from "../../types";
import { EVENT_DEFINITIONS } from "../../hooks/useEventSystem";
import useGameStore from "../../state/useGameStore";
import { generateDebugArrival } from "../../services/debugRecords";
import styles from "./DebugEventBar.module.css";

interface DebugEventBarProps {
  onTrigger: (eventType: EventType) => void;
}

const formatCountdown = (ms: number): string => {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

/** Short label for each event type */
const eventLabel = (type: EventType): string => {
  switch (type) {
    case "horn": return "Horn";
    case "asteroid": return "Asteroid";
    case "rescue-transfer": return "Rescue";
    case "solar-flare": return "Flare";
    case "rover": return "Rover";
    case "fake-instruction": return "Fake";
    case "doom": return "☠️ Doom";
  }
};

const DebugEventBar = ({ onTrigger }: DebugEventBarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const nextScheduled = useGameStore((s) => s.nextScheduledEvent);
  const activeEvent = useGameStore((s) => s.activeEvent);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // Countdown timer — update every second
  useEffect(() => {
    if (!nextScheduled) {
      setRemainingMs(null);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, nextScheduled.triggerAt - Date.now());
      setRemainingMs(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextScheduled]);

  const handleTrigger = useCallback(
    (type: EventType) => {
      onTrigger(type);
    },
    [onTrigger],
  );

  // Unique event types for the debug buttons
  const eventTypes: EventType[] = [
    "horn",
    "asteroid",
    "rescue-transfer",
    "solar-flare",
    "rover",
    "fake-instruction",
  ];

  return (
    <div className={`${styles.bar} ${isCollapsed ? styles.collapsed : ""}`}>
      <button
        type="button"
        className={styles.toggleHeader}
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-expanded={!isCollapsed}
      >
        <span className={styles.chevron}>{isCollapsed ? "▶" : "▼"}</span>
        <span className={styles.label}>Debug Events</span>
      </button>

      {!isCollapsed && (
        <>
          {/* Next scheduled event preview */}
          {activeEvent ? (
            <div className={styles.nextEvent}>
              <span className={styles.nextEventLabel}>Active:</span>
              <span className={styles.nextEventType}>{eventLabel(activeEvent.id)}</span>
            </div>
          ) : nextScheduled && remainingMs !== null ? (
            <div className={styles.nextEvent}>
              <span className={styles.nextEventLabel}>Next:</span>
              <span className={styles.nextEventType}>
                {eventLabel(nextScheduled.eventType)}
              </span>
              <span className={styles.nextEventTime}>
                {formatCountdown(remainingMs)}
              </span>
            </div>
          ) : remainingMs === 0 && (
            <div className={styles.nextEvent}>
              <span className={styles.nextEventLabel}>Next:</span>
              <span className={styles.nextEventType}>—</span>
            </div>
          )}

          <div className={styles.buttons}>
            {eventTypes.map((type) => {
              const def = EVENT_DEFINITIONS.find((d) => d.id === type);
              return (
                <button
                  key={type}
                  type="button"
                  className={styles.btn}
                  onClick={() => handleTrigger(type)}
                  title={`Trigger ${type}${def ? ` (${def.penaltyType})` : ""}`}
                >
                  {eventLabel(type)}
                </button>
              );
            })}
            {/* Spacer + success record debug button */}
            <span style={{ width: 4, background: "rgba(251,191,36,0.2)", borderRadius: 2, alignSelf: "stretch" }} />
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={() => generateDebugArrival()}
              title="Create a dummy arrival record on the Wall of Shame"
            >
              🎉 Arrival
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DebugEventBar;
