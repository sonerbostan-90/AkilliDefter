import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { QUICK_COLORS, isDarkColor } from '../constants/presets';
import { useNotebookStore } from '../store/useNotebookStore';
import type {
  BBox,
  CanvasElement,
  Point,
  RegionElement,
  ShapeElement,
  StrokeElement,
  TextElement,
} from '../types/notebook';
import {
  distance,
  elementInLasso,
  getElementBBox,
  hitTestElement,
  mergeBBoxes,
  recognizeAutoShape,
  scaleElement,
  snapPointToRuler,
  splitStrokeByEraser,
  translateElement,
  uid,
} from '../utils/geometry';
import { drawCanvasElement, drawPageBackground } from '../utils/renderer';
import { Overlays } from './Overlays';

interface LaserPoint {
  x: number;
  y: number;
  time: number;
}

interface TextEditorState {
  id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  isSticky: boolean;
  backgroundColor?: string;
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
}

export function CanvasStage() {
  const notebooks = useNotebookStore((s) => s.notebooks);
  const activeNotebookId = useNotebookStore((s) => s.activeNotebookId);
  const activePageId = useNotebookStore((s) => s.activePageId);

  const page = useMemo(() => {
    const nb = notebooks.find((n) => n.id === activeNotebookId) ?? notebooks[0];
    return nb?.pages.find((p) => p.id === activePageId) ?? nb?.pages[0];
  }, [notebooks, activeNotebookId, activePageId]);

  const activeTool = useNotebookStore((s) => s.activeTool);
  const penPresets = useNotebookStore((s) => s.penPresets);
  const activePenId = useNotebookStore((s) => s.activePenId);
  const highlighterPresets = useNotebookStore((s) => s.highlighterPresets);
  const activeHighlighterId = useNotebookStore((s) => s.activeHighlighterId);
  const eraserMode = useNotebookStore((s) => s.eraserMode);
  const eraserSize = useNotebookStore((s) => s.eraserSize);
  const shapeSettings = useNotebookStore((s) => s.shapeSettings);
  const regionSettings = useNotebookStore((s) => s.regionSettings);
  const textColor = useNotebookStore((s) => s.textColor);
  const textFontSize = useNotebookStore((s) => s.textFontSize);
  const textBold = useNotebookStore((s) => s.textBold);
  const stickyColor = useNotebookStore((s) => s.stickyColor);
  const laserColor = useNotebookStore((s) => s.laserColor);
  const palmRejection = useNotebookStore((s) => s.palmRejection);
  const autoShape = useNotebookStore((s) => s.autoShape);
  const ruler = useNotebookStore((s) => s.ruler);
  const zoom = useNotebookStore((s) => s.zoom);
  const panX = useNotebookStore((s) => s.panX);
  const panY = useNotebookStore((s) => s.panY);
  const selectedIds = useNotebookStore((s) => s.selectedIds);

  const addElement = useNotebookStore((s) => s.addElement);
  const commitPageElements = useNotebookStore((s) => s.commitPageElements);
  const setZoom = useNotebookStore((s) => s.setZoom);
  const setPan = useNotebookStore((s) => s.setPan);
  const setSelectedIds = useNotebookStore((s) => s.setSelectedIds);
  const deleteSelectedElements = useNotebookStore((s) => s.deleteSelectedElements);
  const duplicateSelectedElements = useNotebookStore((s) => s.duplicateSelectedElements);
  const recolorSelectedElements = useNotebookStore((s) => s.recolorSelectedElements);

  const activePen = useMemo(
    () => penPresets.find((p) => p.id === activePenId) ?? penPresets[0],
    [penPresets, activePenId]
  );
  const activeHighlighter = useMemo(
    () => highlighterPresets.find((h) => h.id === activeHighlighterId) ?? highlighterPresets[0],
    [highlighterPresets, activeHighlighterId]
  );

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canlı çizim referansları (60fps sıfır React re-render)
  const drawingRef = useRef<{
    pointerId: number;
    mode:
      | 'stroke'
      | 'shape'
      | 'region'
      | 'eraser'
      | 'laser'
      | 'lasso'
      | 'move-selection'
      | 'resize-selection'
      | 'pan';
    draftStroke?: StrokeElement;
    draftShape?: ShapeElement;
    draftRegion?: RegionElement;
    lassoPoints?: { x: number; y: number }[];
    eraserChanged?: boolean;
    workingElements?: CanvasElement[];
    startClientX?: number;
    startClientY?: number;
    startPanX?: number;
    startPanY?: number;
    startPageX?: number;
    startPageY?: number;
    origSelectionBox?: BBox;
    resizeHandle?: 'nw' | 'ne' | 'sw' | 'se';
    origElementsSnapshot?: CanvasElement[];
    eraserCursor?: { x: number; y: number };
  } | null>(null);

  // Çoklu parmak pinch-zoom & pan takibi
  const touchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialMidX: number;
    initialMidY: number;
    initialPanX: number;
    initialPanY: number;
  } | null>(null);

  // Lazer işaretçi izi
  const laserTrailRef = useRef<LaserPoint[]>([]);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [renderTick, setRenderTick] = useState(0);

  const forceRedraw = useCallback(() => setRenderTick((t) => t + 1), []);

  // Seçim kutusunu hesapla
  const selectionBox = useMemo(() => {
    if (!page || selectedIds.length === 0) return null;
    const setIds = new Set(selectedIds);
    const boxes = page.elements.filter((e) => setIds.has(e.id)).map(getElementBBox);
    return mergeBBoxes(boxes);
  }, [page, selectedIds]);

  // Ekran koordinatını sayfa koordinatına çevir
  const clientToPage = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const el = pageContainerRef.current;
      if (!el || !page) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * page.width;
      const y = ((clientY - rect.top) / rect.height) * page.height;
      return { x, y };
    },
    [page]
  );

  // Ana statik tuvali çiz
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || !page) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(page.width * dpr);
    canvas.height = Math.round(page.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    drawPageBackground(ctx, page.width, page.height, page.background, forceRedraw);
    for (const el of page.elements) {
      if (textEditor?.id && el.id === textEditor.id) continue;
      drawCanvasElement(ctx, el, page.background.color, forceRedraw);
    }
    ctx.restore();
  }, [page, renderTick, forceRedraw, textEditor?.id]);

  // Canlı katmanı çiz
  const drawLiveLayer = useCallback(() => {
    const canvas = liveCanvasRef.current;
    if (!canvas || !page) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (
      canvas.width !== Math.round(page.width * dpr) ||
      canvas.height !== Math.round(page.height * dpr)
    ) {
      canvas.width = Math.round(page.width * dpr);
      canvas.height = Math.round(page.height * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const d = drawingRef.current;
    if (d?.draftStroke) {
      drawCanvasElement(ctx, d.draftStroke, page.background.color);
    }
    if (d?.draftShape) {
      drawCanvasElement(ctx, d.draftShape, page.background.color);
    }
    if (d?.draftRegion) {
      drawCanvasElement(ctx, d.draftRegion, page.background.color);
    }
    if (d?.lassoPoints && d.lassoPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(d.lassoPoints[0].x, d.lassoPoints[0].y);
      for (let i = 1; i < d.lassoPoints.length; i++) {
        ctx.lineTo(d.lassoPoints[i].x, d.lassoPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (d?.eraserCursor) {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(d.eraserCursor.x, d.eraserCursor.y, eraserSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Lazer izi (son 750ms solarak kaybolur)
    const now = performance.now();
    const trail = laserTrailRef.current.filter((pt) => now - pt.time < 750);
    laserTrailRef.current = trail;
    if (trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const age = (now - trail[i].time) / 750;
        const alpha = Math.max(0, 1 - age);
        ctx.strokeStyle = laserColor;
        ctx.shadowColor = laserColor;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(2, 9 * alpha);
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      const head = trail[trail.length - 1];
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = laserColor;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }, [page, eraserSize, laserColor]);

  // Lazer solma animasyon döngüsü
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      if (laserTrailRef.current.length > 0) {
        drawLiveLayer();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drawLiveLayer]);

  // Metin editörünü kaydet
  const commitTextEditor = useCallback(() => {
    if (!textEditor || !page) {
      setTextEditor(null);
      return;
    }
    const trimmed = textEditor.text.trim();
    if (trimmed) {
      if (textEditor.id) {
        const next = page.elements.map((el) =>
          el.id === textEditor.id && el.type === 'text'
            ? {
                ...el,
                text: textEditor.text,
                width: textEditor.width,
                height: textEditor.height,
                color: textEditor.color,
                fontSize: textEditor.fontSize,
                fontWeight: textEditor.fontWeight,
                backgroundColor: textEditor.backgroundColor,
              }
            : el
        );
        commitPageElements(next, true);
      } else {
        const newEl: TextElement = {
          id: uid('text'),
          type: 'text',
          x: textEditor.x,
          y: textEditor.y,
          width: textEditor.width,
          height: textEditor.height,
          text: textEditor.text,
          color: textEditor.color,
          fontSize: textEditor.fontSize,
          fontWeight: textEditor.fontWeight,
          backgroundColor: textEditor.backgroundColor,
          isSticky: textEditor.isSticky,
        };
        addElement(newEl);
      }
    } else if (textEditor.id) {
      commitPageElements(
        page.elements.filter((e) => e.id !== textEditor.id),
        true
      );
    }
    setTextEditor(null);
  }, [textEditor, page, commitPageElements, addElement]);

  // Fare tekerleği ile yakınlaştırma / kaydırma
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        setZoom(zoom * factor);
      } else {
        setPan(panX - e.deltaX, panY - e.deltaY);
      }
    },
    [zoom, panX, panY, setZoom, setPan]
  );

  // Sayfadaki mevcut bölge sayısına göre otomatik rozet numarası
  const nextRegionBadge = useCallback((): string | undefined => {
    if (!regionSettings.autoNumberBadge || !page) return undefined;
    const count = page.elements.filter((e) => e.type === 'region').length;
    return String(count + 1);
  }, [regionSettings.autoNumberBadge, page]);

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!page) return;
    if (textEditor) {
      commitTextEditor();
    }

    // Dokunmatik çoklu parmak takibi (pinch-to-zoom)
    if (e.pointerType === 'touch') {
      touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPointersRef.current.size === 2) {
        // Aktif çizimi iptal et, iki parmakla zoom/pan başlat
        drawingRef.current = null;
        drawLiveLayer();
        const pts = Array.from(touchPointersRef.current.values());
        pinchRef.current = {
          initialDist: distance(pts[0].x, pts[0].y, pts[1].x, pts[1].y) || 1,
          initialZoom: zoom,
          initialMidX: (pts[0].x + pts[1].x) / 2,
          initialMidY: (pts[0].y + pts[1].y) / 2,
          initialPanX: panX,
          initialPanY: panY,
        };
        return;
      }
    }

    if (e.button === 2) return; // sağ tık yoksay

    const vp = viewportRef.current;
    vp?.setPointerCapture(e.pointerId);

    // Avuç içi reddi açıkken parmak dokunuşu her zaman pan yapar (çizmez!)
    const isMiddleMouse = e.button === 1;
    const isPalmTouchPan = palmRejection && e.pointerType === 'touch';
    if (isMiddleMouse || isPalmTouchPan || activeTool === 'pan') {
      drawingRef.current = {
        pointerId: e.pointerId,
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: panX,
        startPanY: panY,
      };
      return;
    }

    const pos = clientToPage(e.clientX, e.clientY);
    const pressure = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5;

    // Kalem arka silgisi / yan silgi tuşu otomatik algılama
    const isStylusEraser = e.pointerType === 'pen' && (e.buttons === 32 || e.button === 5);
    const effectiveTool = isStylusEraser ? 'eraser' : activeTool;

    if (effectiveTool === 'text' || effectiveTool === 'sticky') {
      // Var olan metin/yapışkan nota tıklandıysa onu düzenle
      const existing = [...page.elements]
        .reverse()
        .find((el): el is TextElement => el.type === 'text' && hitTestElement(el, pos.x, pos.y, 4));
      if (existing) {
        setTextEditor({
          id: existing.id,
          x: existing.x,
          y: existing.y,
          width: existing.width,
          height: existing.height,
          text: existing.text,
          isSticky: Boolean(existing.isSticky),
          backgroundColor: existing.backgroundColor,
          color: existing.color,
          fontSize: existing.fontSize,
          fontWeight: existing.fontWeight,
        });
        return;
      }

      const isSticky = effectiveTool === 'sticky';
      const defaultColor = isSticky
        ? '#1e293b'
        : isDarkColor(page.background.color)
          ? '#f8fafc'
          : textColor;
      setTextEditor({
        id: null,
        x: Math.max(12, Math.min(page.width - 210, pos.x)),
        y: Math.max(12, Math.min(page.height - 120, pos.y)),
        width: isSticky ? 220 : 260,
        height: isSticky ? 160 : 88,
        text: '',
        isSticky,
        backgroundColor: isSticky ? stickyColor : 'transparent',
        color: defaultColor,
        fontSize: isSticky ? 17 : textFontSize,
        fontWeight: textBold ? 'bold' : 'normal',
      });
      return;
    }

    if (effectiveTool === 'pen' || effectiveTool === 'highlighter') {
      const snapped = snapPointToRuler({ x: pos.x, y: pos.y, pressure }, ruler);
      const draftStroke: StrokeElement =
        effectiveTool === 'highlighter'
          ? {
              id: uid('hl'),
              type: 'stroke',
              isHighlighter: true,
              tip: 'ballpoint',
              color: activeHighlighter.color,
              size: activeHighlighter.size,
              opacity: activeHighlighter.opacity,
              points: [snapped],
            }
          : {
              id: uid('stroke'),
              type: 'stroke',
              isHighlighter: false,
              tip: activePen.tip,
              color: activePen.color,
              size: activePen.size,
              opacity: activePen.opacity,
              points: [snapped],
            };

      drawingRef.current = {
        pointerId: e.pointerId,
        mode: 'stroke',
        draftStroke,
      };
      drawLiveLayer();
      return;
    }

    if (effectiveTool === 'shape') {
      const draftShape: ShapeElement = {
        id: uid('shape'),
        type: 'shape',
        shapeKind: shapeSettings.shapeKind,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        strokeColor: shapeSettings.strokeColor,
        strokeWidth: shapeSettings.strokeWidth,
        fillColor: shapeSettings.fillColor,
        fillOpacity: shapeSettings.fillOpacity,
        dash: shapeSettings.dash,
      };
      drawingRef.current = {
        pointerId: e.pointerId,
        mode: 'shape',
        draftShape,
      };
      drawLiveLayer();
      return;
    }

    if (effectiveTool === 'region') {
      const draftRegion: RegionElement = {
        id: uid('region'),
        type: 'region',
        regionKind: regionSettings.regionKind,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        strokeColor: regionSettings.strokeColor,
        fillColor: regionSettings.fillColor,
        fillOpacity: regionSettings.fillOpacity,
        strokeWidth: regionSettings.strokeWidth,
        badge: nextRegionBadge(),
      };
      drawingRef.current = {
        pointerId: e.pointerId,
        mode: 'region',
        draftRegion,
      };
      drawLiveLayer();
      return;
    }

    if (effectiveTool === 'laser') {
      laserTrailRef.current.push({ x: pos.x, y: pos.y, time: performance.now() });
      drawingRef.current = {
        pointerId: e.pointerId,
        mode: 'laser',
      };
      drawLiveLayer();
      return;
    }

    if (effectiveTool === 'eraser') {
      const working = [...page.elements];
      drawingRef.current = {
        pointerId: e.pointerId,
        mode: 'eraser',
        workingElements: working,
        eraserChanged: false,
        eraserCursor: { x: pos.x, y: pos.y },
      };
      applyEraserAt(pos.x, pos.y);
      drawLiveLayer();
      return;
    }

    if (effectiveTool === 'lasso') {
      // Eğer mevcut seçim kutusunun içine tıklandıysa taşıma başlat
      if (
        selectionBox &&
        pos.x >= selectionBox.x &&
        pos.x <= selectionBox.x + selectionBox.width &&
        pos.y >= selectionBox.y &&
        pos.y <= selectionBox.y + selectionBox.height
      ) {
        drawingRef.current = {
          pointerId: e.pointerId,
          mode: 'move-selection',
          startPageX: pos.x,
          startPageY: pos.y,
          origElementsSnapshot: page.elements,
        };
        return;
      }

      // Doğrudan bir öğeye tek tıklandıysa onu hemen seç ve taşımaya hazırla
      const hitEl = [...page.elements]
        .reverse()
        .find((el) => hitTestElement(el, pos.x, pos.y, 8));
      if (hitEl) {
        setSelectedIds([hitEl.id]);
        drawingRef.current = {
          pointerId: e.pointerId,
          mode: 'move-selection',
          startPageX: pos.x,
          startPageY: pos.y,
          origElementsSnapshot: page.elements,
        };
        return;
      }

      setSelectedIds([]);
      drawingRef.current = {
        pointerId: e.pointerId,
        mode: 'lasso',
        lassoPoints: [{ x: pos.x, y: pos.y }],
      };
      drawLiveLayer();
    }
  };

  const applyEraserAt = (x: number, y: number) => {
    const d = drawingRef.current;
    if (!d || d.mode !== 'eraser' || !d.workingElements) return;

    let changed = false;
    const next: CanvasElement[] = [];

    for (const el of d.workingElements) {
      if (eraserMode === 'partial' && el.type === 'stroke') {
        const split = splitStrokeByEraser(el, x, y, eraserSize);
        if (split !== null) {
          changed = true;
          next.push(...split);
        } else {
          next.push(el);
        }
      } else {
        if (hitTestElement(el, x, y, eraserSize)) {
          changed = true;
        } else {
          next.push(el);
        }
      }
    }

    if (changed) {
      d.workingElements = next;
      d.eraserChanged = true;
      commitPageElements(next, false);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!page) return;

    // İki parmak pinch-zoom & pan
    if (e.pointerType === 'touch' && touchPointersRef.current.has(e.pointerId)) {
      touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPointersRef.current.size === 2 && pinchRef.current) {
        const pts = Array.from(touchPointersRef.current.values());
        const dist = distance(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const ratio = dist / pinchRef.current.initialDist;
        setZoom(pinchRef.current.initialZoom * ratio);
        setPan(
          pinchRef.current.initialPanX + (midX - pinchRef.current.initialMidX),
          pinchRef.current.initialPanY + (midY - pinchRef.current.initialMidY)
        );
        return;
      }
    }

    const d = drawingRef.current;
    if (!d || d.pointerId !== e.pointerId) return;

    if (d.mode === 'pan') {
      const dx = e.clientX - (d.startClientX ?? 0);
      const dy = e.clientY - (d.startClientY ?? 0);
      setPan((d.startPanX ?? 0) + dx, (d.startPanY ?? 0) + dy);
      return;
    }

    if (d.mode === 'stroke' && d.draftStroke) {
      const nativeEv = e.nativeEvent as PointerEvent;
      const events =
        typeof nativeEv.getCoalescedEvents === 'function'
          ? nativeEv.getCoalescedEvents()
          : [nativeEv];
      const list = events.length > 0 ? events : [nativeEv];

      const isStraightHl =
        d.draftStroke.isHighlighter && (activeHighlighter.straightLine || e.shiftKey);

      if (isStraightHl) {
        const pos = clientToPage(e.clientX, e.clientY);
        const start = d.draftStroke.points[0];
        const dx = Math.abs(pos.x - start.x);
        const dy = Math.abs(pos.y - start.y);
        const endPt: Point =
          dx >= dy
            ? { x: pos.x, y: start.y, pressure: 0.5 }
            : { x: start.x, y: pos.y, pressure: 0.5 };
        d.draftStroke.points = [start, endPt];
      } else {
        for (const ev of list) {
          const p = clientToPage(ev.clientX, ev.clientY);
          const pressure = ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5;
          const snapped = snapPointToRuler({ x: p.x, y: p.y, pressure }, ruler);
          const prev = d.draftStroke.points[d.draftStroke.points.length - 1];
          if (!prev || distance(prev.x, prev.y, snapped.x, snapped.y) >= 1.2) {
            d.draftStroke.points.push(snapped);
          }
        }
      }
      drawLiveLayer();
      return;
    }

    const pos = clientToPage(e.clientX, e.clientY);

    if (d.mode === 'shape' && d.draftShape) {
      let x2 = pos.x;
      let y2 = pos.y;
      // Shift ile düzgün kare / tam çember / 45° açı kilidi
      if (e.shiftKey) {
        const dx = x2 - d.draftShape.x1;
        const dy = y2 - d.draftShape.y1;
        const maxSide = Math.max(Math.abs(dx), Math.abs(dy));
        x2 = d.draftShape.x1 + Math.sign(dx || 1) * maxSide;
        y2 = d.draftShape.y1 + Math.sign(dy || 1) * maxSide;
      }
      d.draftShape.x2 = x2;
      d.draftShape.y2 = y2;
      drawLiveLayer();
      return;
    }

    if (d.mode === 'region' && d.draftRegion) {
      d.draftRegion.x2 = pos.x;
      d.draftRegion.y2 = pos.y;
      drawLiveLayer();
      return;
    }

    if (d.mode === 'laser') {
      laserTrailRef.current.push({ x: pos.x, y: pos.y, time: performance.now() });
      drawLiveLayer();
      return;
    }

    if (d.mode === 'eraser') {
      d.eraserCursor = { x: pos.x, y: pos.y };
      applyEraserAt(pos.x, pos.y);
      drawLiveLayer();
      return;
    }

    if (d.mode === 'lasso' && d.lassoPoints) {
      d.lassoPoints.push({ x: pos.x, y: pos.y });
      drawLiveLayer();
      return;
    }

    if (d.mode === 'move-selection' && d.origElementsSnapshot) {
      const dx = pos.x - (d.startPageX ?? 0);
      const dy = pos.y - (d.startPageY ?? 0);
      const idSet = new Set(useNotebookStore.getState().selectedIds);
      const moved = d.origElementsSnapshot.map((el) =>
        idSet.has(el.id) ? translateElement(el, dx, dy) : el
      );
      commitPageElements(moved, false);
      return;
    }

    if (d.mode === 'resize-selection' && d.origElementsSnapshot && d.origSelectionBox && d.resizeHandle) {
      const b = d.origSelectionBox;
      let nx = b.x;
      let ny = b.y;
      let nw = b.width;
      let nh = b.height;

      if (d.resizeHandle.includes('e')) nw = Math.max(24, pos.x - b.x);
      if (d.resizeHandle.includes('s')) nh = Math.max(24, pos.y - b.y);
      if (d.resizeHandle.includes('w')) {
        const right = b.x + b.width;
        nx = Math.min(right - 24, pos.x);
        nw = right - nx;
      }
      if (d.resizeHandle.includes('n')) {
        const bottom = b.y + b.height;
        ny = Math.min(bottom - 24, pos.y);
        nh = bottom - ny;
      }

      const newBox: BBox = { x: nx, y: ny, width: nw, height: nh };
      const idSet = new Set(useNotebookStore.getState().selectedIds);
      const scaled = d.origElementsSnapshot.map((el) =>
        idSet.has(el.id) ? scaleElement(el, b, newBox) : el
      );
      commitPageElements(scaled, false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      touchPointersRef.current.delete(e.pointerId);
      if (touchPointersRef.current.size < 2) {
        pinchRef.current = null;
      }
    }

    const d = drawingRef.current;
    if (!d || d.pointerId !== e.pointerId || !page) return;

    if (d.mode === 'stroke' && d.draftStroke) {
      let toAdd: CanvasElement = d.draftStroke;
      // Akıllı şekil düzeltme aktifse ve fosforlu değilse kontrol et
      if (autoShape && !d.draftStroke.isHighlighter && !ruler.visible) {
        const recognized = recognizeAutoShape(d.draftStroke);
        if (recognized) {
          toAdd = recognized;
        }
      }
      addElement(toAdd);
    } else if (d.mode === 'shape' && d.draftShape) {
      if (distance(d.draftShape.x1, d.draftShape.y1, d.draftShape.x2, d.draftShape.y2) > 6) {
        addElement(d.draftShape);
      }
    } else if (d.mode === 'region' && d.draftRegion) {
      if (distance(d.draftRegion.x1, d.draftRegion.y1, d.draftRegion.x2, d.draftRegion.y2) > 10) {
        addElement(d.draftRegion);
      }
    } else if (d.mode === 'eraser' && d.eraserChanged && d.workingElements) {
      // Geçmişe tek adım olarak kaydetmek için mevcut durumu commit et
      commitPageElements(d.workingElements, true);
    } else if (d.mode === 'lasso' && d.lassoPoints && d.lassoPoints.length >= 3) {
      const matched = page.elements
        .filter((el) => elementInLasso(el, d.lassoPoints!))
        .map((el) => el.id);
      setSelectedIds(matched);
    } else if (
      (d.mode === 'move-selection' || d.mode === 'resize-selection') &&
      d.origElementsSnapshot
    ) {
      // Taşıma/ölçekleme bittiyse geçmişe kaydet
      const current = useNotebookStore.getState().getActivePage()?.elements ?? page.elements;
      // Eski snapshot'ı undo yığınına ekle
      const store = useNotebookStore.getState();
      const prevUndo = store.undoStack[page.id] ?? [];
      useNotebookStore.setState({
        undoStack: {
          ...store.undoStack,
          [page.id]: [...prevUndo.slice(-79), d.origElementsSnapshot],
        },
        redoStack: {
          ...store.redoStack,
          [page.id]: [],
        },
      });
      commitPageElements(current, false);
    }

    drawingRef.current = null;
    drawLiveLayer();
  };

  // Seçim boyutlandırma tutamacına basıldığında
  const startResizeSelection = (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => {
    if (!page || !selectionBox) return;
    e.stopPropagation();
    viewportRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = {
      pointerId: e.pointerId,
      mode: 'resize-selection',
      origSelectionBox: selectionBox,
      resizeHandle: handle,
      origElementsSnapshot: page.elements,
    };
  };

  // Çift tıklama ile var olan metni/notu hızlı düzenleme
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!page) return;
    const pos = clientToPage(e.clientX, e.clientY);
    const existing = [...page.elements]
      .reverse()
      .find((el): el is TextElement => el.type === 'text' && hitTestElement(el, pos.x, pos.y, 4));
    if (existing) {
      setTextEditor({
        id: existing.id,
        x: existing.x,
        y: existing.y,
        width: existing.width,
        height: existing.height,
        text: existing.text,
        isSticky: Boolean(existing.isSticky),
        backgroundColor: existing.backgroundColor,
        color: existing.color,
        fontSize: existing.fontSize,
        fontWeight: existing.fontWeight,
      });
    }
  };

  if (!page) return null;

  const cursorClass =
    activeTool === 'pan'
      ? 'cursor-grab active:cursor-grabbing'
      : activeTool === 'text' || activeTool === 'sticky'
        ? 'cursor-text'
        : activeTool === 'eraser'
          ? 'cursor-cell'
          : 'cursor-crosshair';

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      className={`canvas-viewport relative flex flex-1 items-center justify-center overflow-hidden bg-slate-900/95 ${cursorClass}`}
    >
      {/* Arka plan ince dokulu çalışma masası */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Dönüştürülebilir Sayfa Tuvali */}
      <div
        ref={pageContainerRef}
        style={{
          width: page.width,
          height: page.height,
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
        className="relative shrink-0 rounded-sm shadow-[0_24px_70px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
      >
        <canvas
          ref={mainCanvasRef}
          style={{ width: page.width, height: page.height }}
          className="block rounded-sm"
        />
        <canvas
          ref={liveCanvasRef}
          style={{ width: page.width, height: page.height }}
          className="pointer-events-none absolute inset-0 block rounded-sm"
        />

        {/* Kement / Seçim Çerçevesi ve Hızlı Eylem Çubuğu */}
        {selectionBox && (
          <div
            style={{
              left: selectionBox.x - 4,
              top: selectionBox.y - 4,
              width: selectionBox.width + 8,
              height: selectionBox.height + 8,
            }}
            className="pointer-events-none absolute z-20 rounded border-2 border-dashed border-blue-500 bg-blue-500/5"
          >
            {/* Yüzer seçim eylem çubuğu */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 shadow-xl"
            >
              {QUICK_COLORS.slice(0, 6).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => recolorSelectedElements(c)}
                  style={{ backgroundColor: c }}
                  className="h-5 w-5 rounded-full border border-white/40 transition hover:scale-110"
                  title="Seçili rengi değiştir"
                />
              ))}
              <div className="mx-0.5 h-4 w-px bg-slate-700" />
              <button
                type="button"
                onClick={duplicateSelectedElements}
                className="rounded-lg p-1 text-slate-200 hover:bg-slate-700"
                title="Çoğalt"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={deleteSelectedElements}
                className="rounded-lg p-1 text-rose-400 hover:bg-rose-500/20"
                title="Sil (Delete)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* 4 Köşe Boyutlandırma Tutamacı */}
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
              const posClass =
                corner === 'nw'
                  ? '-left-2.5 -top-2.5 cursor-nwse-resize'
                  : corner === 'ne'
                    ? '-right-2.5 -top-2.5 cursor-nesw-resize'
                    : corner === 'sw'
                      ? '-left-2.5 -bottom-2.5 cursor-nesw-resize'
                      : '-right-2.5 -bottom-2.5 cursor-nwse-resize';
              return (
                <div
                  key={corner}
                  onPointerDown={(e) => startResizeSelection(e, corner)}
                  className={`pointer-events-auto absolute h-5 w-5 rounded-full border-2 border-blue-600 bg-white shadow ${posClass}`}
                />
              );
            })}
          </div>
        )}

        {/* Sayfa İçi Canlı Metin / Yapışkan Not Editörü */}
        {textEditor && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              left: textEditor.x,
              top: textEditor.y,
              width: textEditor.width,
              minHeight: textEditor.height,
              backgroundColor: textEditor.isSticky
                ? textEditor.backgroundColor || '#fef08a'
                : 'rgba(255,255,255,0.92)',
            }}
            className="absolute z-40 flex flex-col rounded-lg border-2 border-blue-500 p-2 shadow-2xl"
          >
            <textarea
              autoFocus
              value={textEditor.text}
              onChange={(e) => setTextEditor({ ...textEditor, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape') commitTextEditor();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitTextEditor();
              }}
              placeholder={textEditor.isSticky ? 'Yapışkan notunuzu yazın...' : 'Metin yazın...'}
              style={{
                color: textEditor.color,
                fontSize: textEditor.fontSize,
                fontWeight: textEditor.fontWeight,
              }}
              className="min-h-[72px] w-full flex-1 resize bg-transparent outline-none"
            />
            <div className="mt-1 flex items-center justify-between border-t border-slate-300/60 pt-1 text-[11px] text-slate-600">
              <span>Ctrl+Enter: Kaydet</span>
              <button
                type="button"
                onClick={commitTextEditor}
                className="rounded bg-blue-600 px-2.5 py-0.5 font-semibold text-white hover:bg-blue-700"
              >
                Tamam
              </button>
            </div>
          </div>
        )}

        {/* Cetvel, Açıölçer ve Odak Perdesi */}
        <Overlays pageWidth={page.width} pageHeight={page.height} zoom={zoom} />
      </div>
    </div>
  );
}
