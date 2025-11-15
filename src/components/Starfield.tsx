
import React, { useRef, useEffect } from "react";
import { Star } from "../types";
import {
  STAR_COUNT,
  STAR_SPEED,
  TARGET_ASPECT_RATIO,
} from "../constants/constants";

interface StarfieldProps {
  onCanvasBoundsChange?: (bounds: DOMRectReadOnly) => void;
  isPaused?: boolean;
}

const Starfield: React.FC<StarfieldProps> = ({
  onCanvasBoundsChange,
  isPaused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    const cockpitImage = new Image();
    let cockpitLoaded = false;
    const cockpitSrc = `${import.meta.env.BASE_URL}cockpit.png`;

    cockpitImage.src = cockpitSrc;
    cockpitImage.onload = () => {
      cockpitLoaded = true;
      if (onCanvasBoundsChange) {
        const rect = canvas.getBoundingClientRect();
        onCanvasBoundsChange(rect);
      }
    };

    const resizeCanvas = () => {
      const { innerWidth, innerHeight } = window;
      let width = innerWidth;
      let height = innerHeight;

      if (width / height > TARGET_ASPECT_RATIO) {
        width = height * TARGET_ASPECT_RATIO;
      } else {
        height = width / TARGET_ASPECT_RATIO;
      }

      canvas.width = width;
      canvas.height = height;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.left = `${(innerWidth - width) / 2}px`;
      canvas.style.top = `${(innerHeight - height) / 2}px`;

      queueMicrotask(() => {
        if (onCanvasBoundsChange) {
          const rect = canvas.getBoundingClientRect();
          onCanvasBoundsChange(rect);
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
        ctx.drawImage(cockpitImage, 0, 0, canvas.width, canvas.height);
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

  return <canvas ref={canvasRef} className="absolute z-0" />;
};

export default Starfield;
