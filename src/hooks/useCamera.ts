import { useRef, useState, useEffect } from "react";
import { Destination } from "../types";
import useUIStore from "../state/useUIStore";
import i18n from "../i18n/index";
import { CAMERA_OPEN_RETRY_DELAYS_MS } from "../constants/constants";

/** Device-busy errors: the camera exists and is allowed, it just is not free yet. */
const isDeviceBusyError = (err: unknown) =>
  err instanceof DOMException &&
  (err.name === "NotReadableError" || err.name === "AbortError");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    /**
     * Open the camera, retrying only while the device is busy. A denied
     * permission or a missing device is final and fails on the first attempt.
     */
    const openStream = async (): Promise<MediaStream> => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err) {
          if (
            !isDeviceBusyError(err) ||
            attempt >= CAMERA_OPEN_RETRY_DELAYS_MS.length
          ) {
            throw err;
          }
          await wait(CAMERA_OPEN_RETRY_DELAYS_MS[attempt]);
          if (isCancelled) throw err;
        }
      }
    };

    const setup = async () => {
      try {
        const stream = await openStream();
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
          // This message is now shown to the player (the loading screen renders
          // it), so it goes through i18n. The hook is not a component — same
          // `i18n.t()` pattern as ErrorBoundary.
          let errorMessage = i18n.t("app.camera.needAccess");

          if (err instanceof DOMException) {
            switch (err.name) {
              case "NotAllowedError":
                errorMessage = i18n.t("app.camera.denied");
                break;
              case "NotFoundError":
                errorMessage = i18n.t("app.camera.notFound");
                break;
              case "NotReadableError":
              case "AbortError":
                errorMessage = i18n.t("app.camera.notReadable");
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
