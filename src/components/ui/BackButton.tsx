import type { ReactNode } from "react";
import styles from "./BackButton.module.css";

interface BackButtonProps {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * Egységes vissza gomb komponens.
 *
 * Alapértelmezetten inline flex — header sorba illeszthető.
 * Abszolút pozícionáláshoz (pl. MissionSelector, ShipSelect) adj át
 * egy className-t a megfelelő `position: absolute; top: …; right: …` CSS-sel.
 *
 * @example
 * ```tsx
 * // Inline headerben:
 * <BackButton onClick={() => transitionTo("mainMenu")}>
 *   ← {t("settings.back")}
 * </BackButton>
 *
 * // Abszolút pozícionálva:
 * <BackButton onClick={handleBack} className={styles.backButton}>
 *   ← {t("settings.back")}
 * </BackButton>
 * ```
 */
const BackButton = ({
  onClick,
  children,
  className,
  ariaLabel,
}: BackButtonProps) => {
  return (
    <button
      type="button"
      className={`${styles.backButton}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
};

export default BackButton;
