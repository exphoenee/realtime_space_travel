import { useRef, useState, useEffect } from "react";
import { Destination } from "../types";
import useUIStore from "../state/useUIStore";

export const useCamera = (destination: Destination | null) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const { setCameraError } = useUIStore();

  useEffect(() => {
    if (!destination) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsStreamReady(false);
      return;
    }

    let isCancelled = false;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        if (!isCancelled) {
          setIsStreamReady(true);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error accessing camera:", err);
          let errorMessage =
            "Kamera hozzáférés szükséges a játékhoz. Engedélyezd a kamerát és frissítsd az oldalt.";

          if (err instanceof DOMException) {
            switch (err.name) {
              case "NotAllowedError":
                errorMessage =
                  "Kamera hozzáférés megtagadva. Kérjük, engedélyezd a kamerát a böngésző beállításaiban.";
                break;
              case "NotFoundError":
                errorMessage =
                  "Nem található kamera. Csatlakoztass egy webkamerát és próbáld újra.";
                break;
              case "NotReadableError":
                errorMessage =
                  "A kamera nem olvasható. Lehet, hogy egy másik alkalmazás használja.";
                break;
              case "OverconstrainedError":
                errorMessage =
                  "A kamera nem teljesítheti a kérést. Próbáld meg más beállításokkal.";
                break;
            }
          }

          setCameraError(errorMessage);
          setIsStreamReady(false);
        }
      }
    };

    setup();

    return () => {
      isCancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [destination, setCameraError]);

  return { videoRef, isStreamReady };
};
