import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../state/useGameStore";
import styles from "./LoadingScreen.module.css";

const STEPS = [
  { icon: "📡", labelKey: "loading.step.camera" },
  { icon: "🧠", labelKey: "loading.step.model" },
  { icon: "👁️", labelKey: "loading.step.calibration" },
  { icon: "✅", labelKey: "loading.step.ready" },
];

const STEP_DELAYS = [1000, 2000, 3000]; // ms delays to advance step 0→1, 1→2, 2→3
const READY_HOLD_MS = 1200; // how long to show the ready screen before transition

interface LoadingScreenProps {
  onComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const isInitializing = useGameStore((s) => s.isInitializing);
  const [activeStep, setActiveStep] = useState(0);
  const [ready, setReady] = useState(false);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Advance through steps on a timer
  useEffect(() => {
    if (activeStep >= STEPS.length - 1) return;
    const delay = STEP_DELAYS[activeStep] ?? 3000;
    const timer = setTimeout(() => setActiveStep((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [activeStep]);

  // When initializing finishes, jump to final step and show ready state
  useEffect(() => {
    if (!isInitializing && activeStep < STEPS.length - 1) {
      setActiveStep(STEPS.length - 1);
    }
  }, [isInitializing, activeStep]);

  // Show ready overlay once initializing is done + last step has appeared
  useEffect(() => {
    if (activeStep === STEPS.length - 1 && !isInitializing) {
      readyTimerRef.current = setTimeout(() => {
        setReady(true);
        // Transition to playing after the ready card animation
        transitionTimerRef.current = setTimeout(onComplete, 800);
      }, READY_HOLD_MS);
      return () => {
        if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      };
    }
  }, [activeStep, isInitializing, onComplete]);

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {/* Radar spinner */}
        <div className={styles.spinner}>
          <div className={styles.spinnerRing} />
          <div className={styles.spinnerRing} />
          <div className={styles.spinnerRing} />
          <div className={styles.spinnerCenter} />
          <div className={styles.spinnerDot} />
        </div>

        {/* Title */}
        <div>
          <h2 className={styles.title}>{t("loading.title")}</h2>
          <p className={styles.subtitle}>{t("loading.subtitle")}</p>
        </div>

        {/* Steps */}
        <ul className={styles.steps}>
          {STEPS.map((step, i) => {
            let stateClass = "";
            if (i < activeStep) stateClass = styles.stepDone;
            else if (i === activeStep) stateClass = styles.stepActive;

            const statusText =
              i < activeStep
                ? t("loading.status.done")
                : i === activeStep && i === STEPS.length - 1 && !isInitializing
                  ? t("loading.status.done")
                  : i === activeStep
                    ? t("loading.status.inProgress")
                    : "";

            return (
              <li key={i} className={`${styles.step} ${stateClass}`}>
                <span className={styles.stepIcon}>{step.icon}</span>
                <span className={styles.stepLabel}>{t(step.labelKey)}</span>
                {statusText && <span className={styles.stepStatus}>{statusText}</span>}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Ready flash overlay */}
      {ready && (
        <div className={styles.readyOverlay}>
          <div className={styles.readyCard}>
            <div className={styles.readyIcon}>🚀</div>
            <h2 className={styles.readyText}>{t("loading.readyTitle")}</h2>
            <p className={styles.readySubtext}>{t("loading.readySubtitle")}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
