"use client";

import { useEffect, useRef, useState } from "react";

interface MeasuredSize {
  width: number;
  height: number;
}

export function useMeasuredContainer<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<MeasuredSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let frameId = 0;

    const updateSize = () => {
      const { width, height } = element.getBoundingClientRect();
      const nextSize = {
        width: Math.round(width),
        height: Math.round(height),
      };

      setSize((previousSize) => {
        if (
          previousSize.width === nextSize.width &&
          previousSize.height === nextSize.height
        ) {
          return previousSize;
        }

        return nextSize;
      });
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateSize);
    };

    scheduleUpdate();

    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return { ref, size };
}
