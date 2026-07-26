
import React, { useRef, useEffect } from "react";
import { Star } from "../../types";
import {
  STAR_COUNT,
  STAR_SPEED,
} from "../../constants/constants";

interface StarfieldProps {
  onCanvasBoundsChange?: (bounds: DOMRectReadOnly) => void;
  isPaused?: boolean;
  /** Custom cockpit image URL — overrides the default cockpit.png */
  cockpitImageUrl?: string;
}

const Starfield: React.FC<StarfieldProps> = ({
  onCanvasBoundsChange,
  isPaused = false,
  cockpitImageUrl,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  const onBoundsChangeRef = useRef(onCanvasBoundsChange);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    onBoundsChangeRef.current = onCanvasBoundsChange;
  }, [onCanvasBoundsChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    const cockpitImage = new Image();
    let cockpitLoaded = false;
    const cockpitSrc = cockpitImageUrl ?? `${import.meta.env.BASE_URL}spaceships/cockpit.png`;

    cockpitImage.src = cockpitSrc;
    cockpitImage.onload = () => {
      cockpitLoaded = true;
      if (onBoundsChangeRef.current) {
        const rect = canvas.getBoundingClientRect();
        onBoundsChangeRef.current(rect);
      }
    };

    const resizeCanvas = () => {
      const { innerWidth, innerHeight } = window;

      canvas.width = innerWidth;
      canvas.height = innerHeight;

      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      canvas.style.left = "0px";
      canvas.style.top = "0px";

      queueMicrotask(() => {
        if (onBoundsChangeRef.current) {
          const rect = canvas.getBoundingClientRect();
          onBoundsChangeRef.current(rect);
        }
      });
    };

    const setup = () => {
      resizeCanvas();
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: (Math.random() - 0.5) * canvas.width,
          y: (Math.random() - 0.5) * canvas.height,
          z: Math.random() * canvas.width,
        });
      }
    };

    const resetStar = (star: Star) => {
      star.x = (Math.random() - 0.5) * canvas.width;
      star.y = (Math.random() - 0.5) * canvas.height;
      star.z = canvas.width;
    };

    let animationFrameId: number;
    const draw = () => {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);

      for (const star of stars) {
        if (!isPausedRef.current) {
          star.z -= STAR_SPEED;
          if (star.z <= 0) {
            resetStar(star);
          }
        }

        const sx = (star.x / star.z) * canvas.width;
        const sy = (star.y / star.z) * canvas.height;
        const r = Math.max(0.1, (canvas.width - star.z) / canvas.width * 2.5);

        const opacity = (canvas.width - star.z) / canvas.width;

        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fill();
      }

      ctx.restore();

      if (cockpitLoaded) {
        const scale = Math.max(
          canvas.width / cockpitImage.width,
          canvas.height / cockpitImage.height,
        );
        const drawWidth = cockpitImage.width * scale;
        const drawHeight = cockpitImage.height * scale;
        const offsetX = (canvas.width - drawWidth) / 2;
        const offsetY = (canvas.height - drawHeight) / 2;
        ctx.drawImage(cockpitImage, offsetX, offsetY, drawWidth, drawHeight);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    setup();
    draw();

    const handleResize = () => {
      setup();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    />
  );
};

export default Starfield;
