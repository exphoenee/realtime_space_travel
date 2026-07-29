import { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import useUIStore from "../../state/useUIStore";

interface ScreenCheckProps {
  children: React.ReactNode;
  /** Required orientation — shows a warning if the screen doesn't match. */
  orientation?: "landscape" | "portrait";
  /** Minimum size thresholds — shows a warning if below any given value. */
  size?: { height?: number; width?: number };
}

const ScreenCheck = ({ children, orientation, size }: ScreenCheckProps) => {
  const { t } = useTranslation();
  const screenCheckEnabled = useUIStore((s) => s.screenCheckEnabled);
  const [reason, setReason] = useState<"orientation" | "small" | null>(null);

  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (orientation) {
        const isLandscape = width > height;
        const matches =
          orientation === "landscape" ? isLandscape : !isLandscape;
        if (!matches) {
          setReason("orientation");
          return;
        }
      }

      if (size) {
        if (
          (size.width !== undefined && width < size.width) ||
          (size.height !== undefined && height < size.height)
        ) {
          setReason("small");
          return;
        }
      }

      setReason(null);
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);
    window.addEventListener("orientationchange", checkScreen);

    return () => {
      window.removeEventListener("resize", checkScreen);
      window.removeEventListener("orientationchange", checkScreen);
    };
  }, [orientation, size]);

  if (!screenCheckEnabled) {
    return <>{children}</>;
  }

  if (reason) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: '"Space Mono", "Courier New", monospace',
          padding: "2rem",
          textAlign: "center",
          zIndex: 9999,
        }}
      >
        <div style={{ maxWidth: "400px" }}>
          {reason === "orientation" ? (
            <>
              <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>
                {orientation === "landscape" ? "📱↔️" : "📱↕️"}
              </div>
              <h2
                style={{
                  fontSize: "1.5rem",
                  marginBottom: "1rem",
                  color: "#f87171",
                }}
              >
                {t("screenCheck.portraitTitle")}
              </h2>
              <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
                {t("screenCheck.portraitText")}
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🖥️</div>
              <h2
                style={{
                  fontSize: "1.5rem",
                  marginBottom: "1rem",
                  color: "#f87171",
                }}
              >
                {t("screenCheck.tooSmallTitle")}
              </h2>
              <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
                <Trans i18nKey="screenCheck.tooSmallText">
                  At least{" "}
                  <strong style={{ color: "#67e8f9" }}>
                    {size?.width ?? "?"}×{size?.height ?? "?"}
                  </strong>{" "}
                  resolution is required.
                </Trans>
              </p>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  marginTop: "0.5rem",
                }}
              >
                {t("screenCheck.current", {
                  width: window.innerWidth,
                  height: window.innerHeight,
                })}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ScreenCheck;
