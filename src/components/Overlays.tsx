import React, { useRef } from 'react';
import { Circle, RotateCw, Square, X } from 'lucide-react';
import { useNotebookStore } from '../store/useNotebookStore';

interface OverlaysProps {
  pageWidth: number;
  pageHeight: number;
  zoom: number;
}

export function Overlays({ pageWidth, pageHeight, zoom }: OverlaysProps) {
  const ruler = useNotebookStore((s) => s.ruler);
  const updateRuler = useNotebookStore((s) => s.updateRuler);
  const toggleRuler = useNotebookStore((s) => s.toggleRuler);

  const protractor = useNotebookStore((s) => s.protractor);
  const updateProtractor = useNotebookStore((s) => s.updateProtractor);
  const toggleProtractor = useNotebookStore((s) => s.toggleProtractor);

  const spotlight = useNotebookStore((s) => s.spotlight);
  const updateSpotlight = useNotebookStore((s) => s.updateSpotlight);
  const toggleSpotlight = useNotebookStore((s) => s.toggleSpotlight);

  const dragRef = useRef<{
    kind: 'ruler-move' | 'ruler-rotate' | 'prot-move' | 'prot-rotate' | 'spot-move' | 'spot-resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origAngle: number;
    origW: number;
    origH: number;
  } | null>(null);

  const startDrag = (
    e: React.PointerEvent,
    kind: NonNullable<typeof dragRef.current>['kind'],
    orig: { x: number; y: number; angle?: number; w?: number; h?: number }
  ) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      origX: orig.x,
      origY: orig.y,
      origAngle: orig.angle ?? 0,
      origW: orig.w ?? 0,
      origH: orig.h ?? 0,
    };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;

    if (d.kind === 'ruler-move') {
      updateRuler({ x: d.origX + dx, y: d.origY + dy });
    } else if (d.kind === 'ruler-rotate') {
      let nextAngle = d.origAngle + dy * 0.45 + dx * 0.25;
      // 15 dereceye yakınsa hafif mıknatıslanma
      const snapped = Math.round(nextAngle / 15) * 15;
      if (Math.abs(nextAngle - snapped) < 2.2) nextAngle = snapped;
      updateRuler({ angle: ((nextAngle % 360) + 360) % 360 });
    } else if (d.kind === 'prot-move') {
      updateProtractor({ x: d.origX + dx, y: d.origY + dy });
    } else if (d.kind === 'prot-rotate') {
      const nextAngle = d.origAngle + dx * 0.5;
      updateProtractor({ angle: ((nextAngle % 360) + 360) % 360 });
    } else if (d.kind === 'spot-move') {
      updateSpotlight({ x: d.origX + dx, y: d.origY + dy });
    } else if (d.kind === 'spot-resize') {
      updateSpotlight({
        width: Math.max(90, d.origW + dx),
        height: Math.max(70, d.origH + dy),
      });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* SPOTLIGHT (ODAK PERDESİ) */}
      {spotlight.active && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <svg width={pageWidth} height={pageHeight} className="block h-full w-full">
            <defs>
              <mask id="spotlight-mask">
                <rect width={pageWidth} height={pageHeight} fill="white" />
                {spotlight.shape === 'ellipse' ? (
                  <ellipse
                    cx={spotlight.x + spotlight.width / 2}
                    cy={spotlight.y + spotlight.height / 2}
                    rx={spotlight.width / 2}
                    ry={spotlight.height / 2}
                    fill="black"
                  />
                ) : (
                  <rect
                    x={spotlight.x}
                    y={spotlight.y}
                    width={spotlight.width}
                    height={spotlight.height}
                    rx={14}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              width={pageWidth}
              height={pageHeight}
              fill={`rgba(2, 6, 23, ${spotlight.dimOpacity})`}
              mask="url(#spotlight-mask)"
            />
          </svg>

          {/* Odak penceresi sürükleme çerçevesi */}
          <div
            style={{
              left: spotlight.x,
              top: spotlight.y,
              width: spotlight.width,
              height: spotlight.height,
              borderRadius: spotlight.shape === 'ellipse' ? '9999px' : '14px',
            }}
            className="pointer-events-none absolute border-2 border-amber-400/90 shadow-[0_0_24px_rgba(251,191,36,0.35)]"
          >
            {/* Üst kontrol çubuğu */}
            <div
              onPointerDown={(e) =>
                startDrag(e, 'spot-move', { x: spotlight.x, y: spotlight.y })
              }
              onPointerMove={onMove}
              onPointerUp={endDrag}
              className="pointer-events-auto absolute -top-9 left-1/2 flex -translate-x-1/2 cursor-grab items-center gap-1 rounded-full bg-slate-900/95 px-2.5 py-1 text-xs font-medium text-amber-300 shadow-lg ring-1 ring-amber-400/40 active:cursor-grabbing"
            >
              <span>Odak</span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() =>
                  updateSpotlight({ shape: spotlight.shape === 'rect' ? 'ellipse' : 'rect' })
                }
                className="rounded p-1 hover:bg-slate-700"
                title="Şekil Değiştir"
              >
                {spotlight.shape === 'rect' ? <Circle className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggleSpotlight}
                className="rounded p-1 text-rose-400 hover:bg-slate-700"
                title="Odak Perdesini Kapat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Sağ alt boyutlandırma tutamacı */}
            <div
              onPointerDown={(e) =>
                startDrag(e, 'spot-resize', {
                  x: spotlight.x,
                  y: spotlight.y,
                  w: spotlight.width,
                  h: spotlight.height,
                })
              }
              onPointerMove={onMove}
              onPointerUp={endDrag}
              className="pointer-events-auto absolute -right-3 -bottom-3 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-slate-900 bg-amber-400 shadow-md"
              title="Boyutlandır"
            />
          </div>
        </div>
      )}

      {/* CETVEL (RULER) */}
      {ruler.visible && (
        <div
          style={{
            left: ruler.x,
            top: ruler.y,
            width: ruler.length,
            height: 64,
            transform: `translate(-50%, -50%) rotate(${ruler.angle}deg)`,
          }}
          onPointerDown={(e) => startDrag(e, 'ruler-move', { x: ruler.x, y: ruler.y })}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          className="pointer-events-auto absolute z-30 flex cursor-grab select-none items-center justify-between rounded-md border border-amber-500/80 bg-amber-100/85 text-slate-900 shadow-xl backdrop-blur-xs active:cursor-grabbing"
        >
          {/* Üst cm/mm çizgileri */}
          <svg
            width={ruler.length}
            height={64}
            className="pointer-events-none absolute inset-0"
          >
            {Array.from({ length: Math.floor(ruler.length / 8) }).map((_, i) => {
              const x = i * 8 + 8;
              const isMajor = i % 5 === 0;
              return (
                <g key={i}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={isMajor ? 18 : 10}
                    stroke="#78350f"
                    strokeWidth={isMajor ? 1.5 : 1}
                  />
                  {isMajor && i > 0 && (
                    <text
                      x={x}
                      y={30}
                      fontSize="10"
                      fontWeight="700"
                      textAnchor="middle"
                      fill="#78350f"
                    >
                      {i / 5}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="relative z-10 ml-3 mt-4 rounded bg-amber-900/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-950">
            {Math.round(ruler.angle)}°
          </div>

          <div className="relative z-10 mr-2 mt-4 flex items-center gap-1">
            <button
              type="button"
              onPointerDown={(e) =>
                startDrag(e, 'ruler-rotate', {
                  x: ruler.x,
                  y: ruler.y,
                  angle: ruler.angle,
                })
              }
              onPointerMove={onMove}
              onPointerUp={endDrag}
              className="flex h-7 w-7 cursor-ew-resize items-center justify-center rounded-full bg-amber-600 text-white shadow hover:bg-amber-700"
              title="Sürükleyerek Döndür"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleRuler}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-rose-600"
              title="Cetveli Kapat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* AÇIÖLÇER (PROTRACTOR) */}
      {protractor.visible && (
        <div
          style={{
            left: protractor.x,
            top: protractor.y,
            width: protractor.radius * 2,
            height: protractor.radius + 20,
            transform: `translate(-50%, -85%) rotate(${protractor.angle}deg)`,
          }}
          onPointerDown={(e) =>
            startDrag(e, 'prot-move', { x: protractor.x, y: protractor.y })
          }
          onPointerMove={onMove}
          onPointerUp={endDrag}
          className="pointer-events-auto absolute z-30 cursor-grab select-none active:cursor-grabbing"
        >
          <svg
            width={protractor.radius * 2}
            height={protractor.radius + 20}
            viewBox={`0 0 ${protractor.radius * 2} ${protractor.radius + 20}`}
            className="overflow-visible drop-shadow-lg"
          >
            <path
              d={`M 0 ${protractor.radius} A ${protractor.radius} ${protractor.radius} 0 0 1 ${protractor.radius * 2} ${protractor.radius} L ${protractor.radius * 2} ${protractor.radius + 14} L 0 ${protractor.radius + 14} Z`}
              fill="rgba(224, 242, 254, 0.78)"
              stroke="#0284c7"
              strokeWidth="2"
            />
            <circle cx={protractor.radius} cy={protractor.radius} r="4" fill="#0369a1" />
            <line
              x1={0}
              y1={protractor.radius}
              x2={protractor.radius * 2}
              y2={protractor.radius}
              stroke="#0369a1"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
            {Array.from({ length: 37 }).map((_, idx) => {
              const deg = idx * 5;
              const rad = (deg * Math.PI) / 180;
              const rOuter = protractor.radius;
              const isMajor = deg % 30 === 0;
              const isMed = deg % 10 === 0;
              const rInner = rOuter - (isMajor ? 18 : isMed ? 12 : 7);
              const cx = protractor.radius;
              const cy = protractor.radius;
              const x1 = cx - Math.cos(rad) * rOuter;
              const y1 = cy - Math.sin(rad) * rOuter;
              const x2 = cx - Math.cos(rad) * rInner;
              const y2 = cy - Math.sin(rad) * rInner;
              const tx = cx - Math.cos(rad) * (rOuter - 28);
              const ty = cy - Math.sin(rad) * (rOuter - 28);
              return (
                <g key={deg}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#0c4a6e"
                    strokeWidth={isMajor ? 1.5 : 0.9}
                  />
                  {isMajor && (
                    <text
                      x={tx}
                      y={ty + 3}
                      fontSize="10"
                      fontWeight="700"
                      textAnchor="middle"
                      fill="#0c4a6e"
                    >
                      {deg}°
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(e) =>
                startDrag(e, 'prot-rotate', {
                  x: protractor.x,
                  y: protractor.y,
                  angle: protractor.angle,
                })
              }
              onPointerMove={onMove}
              onPointerUp={endDrag}
              className="flex h-7 w-7 cursor-ew-resize items-center justify-center rounded-full bg-sky-600 text-white shadow hover:bg-sky-700"
              title="Sürükleyerek Döndür"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleProtractor}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-rose-600"
              title="Açıölçeri Kapat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
