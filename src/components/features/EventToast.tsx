import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./EventToast.module.css";

export interface ToastEvent {
  id: string;
  /** The player who is experiencing the event */
  playerName: string;
  /** Event type (e.g., "horn", "asteroid", "rescue-transfer") */
  eventType: string;
  /** Whether the event was a success or failure */
  result?: "success" | "fail";
  /** Duration in ms before auto-dismiss */
  durationMs?: number;
}

interface EventToastProps {
  event: ToastEvent | null;
  onDismiss?: () => void;
}

const EventToast: React.FC<EventToastProps> = ({ event, onDismiss }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<ToastEvent | null>(null);

  useEffect(() => {
    if (!event) {
      setVisible(false);
      setCurrentEvent(null);
      return;
    }

    setCurrentEvent(event);
    // Small delay for enter animation
    const showTimer = setTimeout(() => setVisible(true), 50);

    // Auto dismiss after duration (default 4s)
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentEvent(null);
        onDismiss?.();
      }, 300);
    }, event.durationMs ?? 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [event, onDismiss]);

  if (!currentEvent) return null;

  // Get event toast key
  const eventKey = currentEvent.eventType.replace(/-/g, "");
  const eventMessage = t(`multiplayer.eventToast.${eventKey}`, {
    name: currentEvent.playerName,
    defaultValue: `${currentEvent.playerName} is dealing with ${currentEvent.eventType}!`,
  });

  return (
    <div className={`${styles.toast} ${visible ? styles.visible : styles.hidden}`}>
      <div className={styles.content}>
        <span className={styles.icon}>
          {currentEvent.result === "fail" ? "⚠️" : "📡"}
        </span>
        <span className={styles.message}>{eventMessage}</span>
      </div>
      <button
        className={styles.dismiss}
        onClick={() => {
          setVisible(false);
          setTimeout(() => {
            setCurrentEvent(null);
            onDismiss?.();
          }, 300);
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};

export default EventToast;
