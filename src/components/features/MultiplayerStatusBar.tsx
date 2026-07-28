import React from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import styles from "./MultiplayerStatusBar.module.css";

const MultiplayerStatusBar: React.FC = () => {
  const { t } = useTranslation();
  const multiplayerSession = useGameStore((s) => s.multiplayerSession);

  if (!multiplayerSession) return null;

  const participants = Object.entries(multiplayerSession.participants || {});

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          {t("multiplayer.participants", { count: participants.length })}
        </span>
        <span className={styles.hostLabel}>{t("multiplayer.host")}</span>
      </div>
      <div className={styles.participantList}>
        {participants.map(([uid, participant]) => (
          <div
            key={uid}
            className={`${styles.participant} ${
              participant.attention ? styles.attentive : styles.inattentive
            }`}
            title={
              participant.attention
                ? t("friends.watching")
                : t("friends.notWatching")
            }
          >
            <span
              className={`${styles.statusDot} ${
                participant.attention ? styles.dotOn : styles.dotOff
              }`}
            />
            <span className={styles.name}>
              {participant.nickname || uid.slice(0, 6)}
            </span>
            {uid === multiplayerSession.host && (
              <span className={styles.hostBadge}>👑</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiplayerStatusBar;
