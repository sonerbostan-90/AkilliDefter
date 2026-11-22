import { useEffect, useRef } from 'react';
import type { NotebookPage } from '../types/notebook';
import { renderFullPage } from '../utils/renderer';

interface PageThumbProps {
  page: NotebookPage;
  width?: number;
}

export function PageThumb({ page, width = 128 }: PageThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ratio = page.height / page.width;
  const height = Math.round(width * ratio);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = (width * dpr) / page.width;
      ctx.scale(scale, scale);
      renderFullPage(ctx, page, draw);
      ctx.restore();
    };
    draw();
  }, [page, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block rounded-md border border-slate-700/80 shadow-sm"
    />
  );
}
