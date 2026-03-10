import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type VirtualRowsOptions = {
  rowCount: number;
  rowHeight: number;
  overscan: number;
  enabled: boolean;
};

export function useVirtualRows(containerRef: React.RefObject<HTMLElement>, options: VirtualRowsOptions) {
  const { rowCount, rowHeight, overscan, enabled } = options;
  const [viewportHeight, setViewportHeight] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
      });
    };

    const ro = new ResizeObserver(() => {
      setViewportHeight(el.clientHeight || 600);
    });

    setViewportHeight(el.clientHeight || 600);
    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!enabled && el.scrollTop !== 0) {
      el.scrollTop = 0;
      setScrollTop(0);
    }
  }, [containerRef, enabled, rowCount]);

  const { start, end, top, bottom } = useMemo(() => {
    if (rowCount <= 0) return { start: 0, end: -1, top: 0, bottom: 0 };
    if (!enabled) return { start: 0, end: rowCount - 1, top: 0, bottom: 0 };

    const visibleCount = Math.ceil(viewportHeight / rowHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(rowCount - 1, startIndex + visibleCount + overscan * 2);
    const topPx = startIndex * rowHeight;
    const bottomPx = Math.max(0, (rowCount - endIndex - 1) * rowHeight);
    return { start: startIndex, end: endIndex, top: topPx, bottom: bottomPx };
  }, [enabled, overscan, rowCount, rowHeight, scrollTop, viewportHeight]);

  return { start, end, top, bottom, scrollTop };
}
