import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useToastStore, { type Toast } from "../../state/useToastStore";
import styles from "./ToastContainer.module.css";

/** Fade-out duration — must match the `.leaving` animation in the CSS. */
const EXIT_ANIMATION_MS = 250;

const TYPE_ICON: Record<Toast["type"], string> = {
  info: "ℹ",
  success: "✓",
  warning: "!",
  error: "✕",
};

interface ToastItemProps {
  toast: Toast;
}

/**
 * A single toast. Owns its auto-dismiss timer (the store stays timer-free) and
 * plays a short fade-out before actually removing itself from the store.
 */
const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
  const { t } = useTranslation();
  const dismissToast = useToastStore((s) => s.dismissToast);
  const [isLeaving, setIsLeaving] = useState(false);

  // Auto-dismiss: start the exit animation once the duration elapses.
  useEffect(() => {
    const timer = window.setTimeout(() => setIsLeaving(true), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration]);

  // Once the exit animation has played, drop the toast from the store.
  useEffect(() => {
    if (!isLeaving) return;
    const timer = window.setTimeout(() => dismissToast(toast.id), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isLeaving, toast.id, dismissToast]);

  const handleDismiss = () => setIsLeaving(true);

  return (
    <div
      className={`${styles.toast} ${styles[toast.type]}${isLeaving ? ` ${styles.leaving}` : ""}`}
      role="status"
      aria-live="polite"
      onClick={handleDismiss}
      title={t("toast.dismiss")}
    >
      <span className={styles.icon} aria-hidden="true">
        {TYPE_ICON[toast.type]}
      </span>
      <span className={styles.message}>{toast.message}</span>
      <button
        type="button"
        className={styles.closeBtn}
        aria-label={t("toast.dismiss")}
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
      >
        ×
      </button>
    </div>
  );
};

/**
 * Fixed stack of system toasts in the TOP-LEFT corner.
 *
 * Rendered above every phase (including the in-game overlays, which sit at
 * z-index 50), so it must live outside the phase-specific branches in App.
 */
const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default ToastContainer;
