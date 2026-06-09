"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Горизонтальный скролл доски с ДУБЛИРУЮЩИМ ползунком сверху (синхронизирован с нижним),
// чтобы листать колонки в сторону, не прокручивая страницу вниз.
export function PipelineBoard({ children }: { children: ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => setWidth(board.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const onTop = () => {
    const t = topRef.current;
    const b = boardRef.current;
    if (t && b && b.scrollLeft !== t.scrollLeft) b.scrollLeft = t.scrollLeft;
  };
  const onBoard = () => {
    const t = topRef.current;
    const b = boardRef.current;
    if (t && b && t.scrollLeft !== b.scrollLeft) t.scrollLeft = b.scrollLeft;
  };

  return (
    <div>
      <div
        ref={topRef}
        onScroll={onTop}
        className="mb-1 overflow-x-auto overflow-y-hidden"
        style={{ height: 16 }}
        aria-hidden
      >
        <div style={{ width, height: 1 }} />
      </div>
      <div ref={boardRef} onScroll={onBoard} className="flex gap-4 overflow-x-auto pb-4">
        {children}
      </div>
    </div>
  );
}