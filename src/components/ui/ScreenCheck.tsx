import { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";

interface ScreenCheckProps {
  children: React.ReactNode;
}

const MIN_WIDTH = 900;
const MIN_HEIGHT = 530;

const ScreenCheck = ({ children }: ScreenCheckProps) => {
  const { t } = useTranslation();
  const [isBlocked, setIsBlocked] = useState(true);
  const [reason, setReason] = useState<"portrait" | "small" | null>(null);

  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;

      if (!isLandscape) {
        setIsBlocked(true);
        setReason("portrait");
        return;
      }

      if (width < MIN_WIDTH || height < MIN_HEIGHT) {
        setIsBlocked(true);
        setReason("small");
        return;
      }

      setIsBlocked(false);
      setReason(null);
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);
    window.addEventListener("orientationchange", checkScreen);

    return () => {
      window.removeEventListener("resize", checkScreen);
      window.removeEventListener("orientationchange", checkScreen);
    };
  }, []);

  if (isBlocked) {
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
          {reason === "portrait" ? (
            <>
              <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📱↔️</div>
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
                  Legalább <strong style={{ color: "#67e8f9" }}>900×530</strong>{" "}
                  felbontás szükséges.
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
