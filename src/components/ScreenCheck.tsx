import React, { useState, useEffect } from "react";

interface ScreenCheckProps {
  children: React.ReactNode;
}

const MIN_WIDTH = 900;
const MIN_HEIGHT = 530;

const ScreenCheck: React.FC<ScreenCheckProps> = ({ children }) => {
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
                Fekvő nézet szükséges
              </h2>
              <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
                Kérjük, fordítsd el a készülékedet vízszintes helyzetbe a játék
                elindításához.
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
                Túl kicsi képernyő
              </h2>
              <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
                Legalább <strong style={{ color: "#67e8f9" }}>900×530</strong>{" "}
                felbontás szükséges.
              </p>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  marginTop: "0.5rem",
                }}
              >
                Jelenlegi: {window.innerWidth}×{window.innerHeight}
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
