import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Compass,
  Eraser,
  Hand,
  Highlighter,
  ImagePlus,
  Lasso,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
  PanelTop,
  PenTool,
  Plus,
  Redo2,
  Ruler,
  Shapes,
  Sparkles,
  SquareDashedMousePointer,
  StickyNote,
  Sun,
  Trash2,
  Type,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  PEN_TIP_LABELS,
  QUICK_COLORS,
  SHAPE_CATALOG,
  STICKY_COLORS,
} from '../constants/presets';
import { useNotebookStore } from '../store/useNotebookStore';
import type { DashStyle, RegionKind } from '../types/notebook';
import { readImageFile } from '../utils/importers';
import { uid } from '../utils/geometry';

type PopoverKey =
  | null
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'shape'
  | 'region'
  | 'text'
  | 'sticky';

export function Toolbar() {
  const activeTool = useNotebookStore((s) => s.activeTool);
  const setActiveTool = useNotebookStore((s) => s.setActiveTool);

  const penPresets = useNotebookStore((s) => s.penPresets);
  const activePenId = useNotebookStore((s) => s.activePenId);
  const selectPenPreset = useNotebookStore((s) => s.selectPenPreset);
  const updatePenPreset = useNotebookStore((s) => s.updatePenPreset);
  const addPenPreset = useNotebookStore((s) => s.addPenPreset);
  const deletePenPreset = useNotebookStore((s) => s.deletePenPreset);

  const highlighterPresets = useNotebookStore((s) => s.highlighterPresets);
  const activeHighlighterId = useNotebookStore((s) => s.activeHighlighterId);
  const selectHighlighterPreset = useNotebookStore((s) => s.selectHighlighterPreset);
  const updateHighlighterPreset = useNotebookStore((s) => s.updateHighlighterPreset);

  const eraserMode = useNotebookStore((s) => s.eraserMode);
  const eraserSize = useNotebookStore((s) => s.eraserSize);
  const setEraserMode = useNotebookStore((s) => s.setEraserMode);
  const setEraserSize = useNotebookStore((s) => s.setEraserSize);
  const clearPageElements = useNotebookStore((s) => s.clearPageElements);

  const shapeSettings = useNotebookStore((s) => s.shapeSettings);
  const updateShapeSettings = useNotebookStore((s) => s.updateShapeSettings);
  const regionSettings = useNotebookStore((s) => s.regionSettings);
  const updateRegionSettings = useNotebookStore((s) => s.updateRegionSettings);

  const textColor = useNotebookStore((s) => s.textColor);
  const textFontSize = useNotebookStore((s) => s.textFontSize);
  const textBold = useNotebookStore((s) => s.textBold);
  const stickyColor = useNotebookStore((s) => s.stickyColor);
  const setTextSettings = useNotebookStore((s) => s.setTextSettings);

  const palmRejection = useNotebookStore((s) => s.palmRejection);
  const togglePalmRejection = useNotebookStore((s) => s.togglePalmRejection);
  const autoShape = useNotebookStore((s) => s.autoShape);
  const toggleAutoShape = useNotebookStore((s) => s.toggleAutoShape);
  const toolbarDock = useNotebookStore((s) => s.toolbarDock);
  const setToolbarDock = useNotebookStore((s) => s.setToolbarDock);
  const sidebarOpen = useNotebookStore((s) => s.sidebarOpen);
  const setSidebarOpen = useNotebookStore((s) => s.setSidebarOpen);
  const focusMode = useNotebookStore((s) => s.focusMode);
  const toggleFullscreenFocus = useNotebookStore((s) => s.toggleFullscreenFocus);

  const ruler = useNotebookStore((s) => s.ruler);
  const toggleRuler = useNotebookStore((s) => s.toggleRuler);
  const protractor = useNotebookStore((s) => s.protractor);
  const toggleProtractor = useNotebookStore((s) => s.toggleProtractor);
  const spotlight = useNotebookStore((s) => s.spotlight);
  const toggleSpotlight = useNotebookStore((s) => s.toggleSpotlight);

  const zoom = useNotebookStore((s) => s.zoom);
  const setZoom = useNotebookStore((s) => s.setZoom);
  const resetView = useNotebookStore((s) => s.resetView);
  const undo = useNotebookStore((s) => s.undo);
  const redo = useNotebookStore((s) => s.redo);
  const addElement = useNotebookStore((s) => s.addElement);
  const showToast = useNotebookStore((s) => s.showToast);

  const activePageId = useNotebookStore((s) => s.activePageId);
  const canUndo = useNotebookStore((s) => (s.undoStack[activePageId]?.length ?? 0) > 0);
  const canRedo = useNotebookStore((s) => (s.redoStack[activePageId]?.length ?? 0) > 0);

  const [openPopover, setOpenPopover] = useState<PopoverKey>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);

  const activePen = penPresets.find((p) => p.id === activePenId) ?? penPresets[0];
  const activeHighlighter =
    highlighterPresets.find((h) => h.id === activeHighlighterId) ?? highlighterPresets[0];

  const isVertical = toolbarDock === 'left' || toolbarDock === 'right';

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { dataUrl, width, height } = await readImageFile(file);
      const maxW = 420;
      const scale = width > maxW ? maxW / width : 1;
      addElement({
        id: uid('img'),
        type: 'image',
        x: 120,
        y: 140,
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        dataUrl,
      });
      setActiveTool('lasso');
      showToast('Görsel sayfaya eklendi — sürükleyip boyutlandırabilirsiniz', 'success');
    } catch {
      showToast('Görsel yüklenemedi', 'error');
    }
  };

  const toggleOrSelect = (tool: typeof activeTool, pop: PopoverKey) => {
    if (activeTool === tool) {
      setOpenPopover((prev) => (prev === pop ? null : pop));
    } else {
      setActiveTool(tool);
      setOpenPopover(pop);
    }
  };

  const popoverPosClass =
    toolbarDock === 'top'
      ? 'top-[62px] left-1/2 -translate-x-1/2'
      : toolbarDock === 'left'
        ? 'left-[72px] top-16'
        : 'right-[72px] top-16';

  const btnBase =
    'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95';
  const btnIdle = 'text-slate-300 hover:bg-slate-800 hover:text-white';
  const btnActive = 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/60';

  return (
    <div
      className={`relative z-30 flex select-none items-center gap-1.5 border-slate-800 bg-slate-950/95 p-2 backdrop-blur-md ${
        isVertical
          ? `h-full w-[66px] flex-col overflow-y-auto ${toolbarDock === 'left' ? 'border-r' : 'border-l'}`
          : 'w-full flex-row overflow-x-auto border-b'
      }`}
    >
      {/* Sol Panel Aç/Kapa */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`${btnBase} ${sidebarOpen ? 'bg-slate-800 text-blue-400' : btnIdle}`}
        title="Defter ve Sayfa Paneli"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      <div className={isVertical ? 'h-px w-8 bg-slate-800' : 'h-7 w-px bg-slate-800'} />

      {/* ÖN TANIMLI ÇOKLU KALEM YUVALARI */}
      <div className={`flex items-center gap-1 ${isVertical ? 'flex-col' : 'flex-row'}`}>
        {penPresets.map((pen, idx) => {
          const isSelected = activeTool === 'pen' && activePenId === pen.id;
          return (
            <button
              key={pen.id}
              type="button"
              onClick={() => {
                if (isSelected) {
                  setOpenPopover((prev) => (prev === 'pen' ? null : 'pen'));
                } else {
                  selectPenPreset(pen.id);
                  setOpenPopover(null);
                }
              }}
              className={`group relative flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border transition active:scale-95 ${
                isSelected
                  ? 'border-blue-400 bg-slate-800 shadow-lg ring-2 ring-blue-500/40'
                  : 'border-slate-800 bg-slate-900/90 hover:border-slate-600 hover:bg-slate-800'
              }`}
              title={`${pen.name} (${pen.size}px) — Düzenlemek için tekrar dokunun [Tuş: ${idx + 1}]`}
            >
              <span
                style={{
                  backgroundColor: pen.color,
                  width: Math.max(10, Math.min(22, pen.size * 2.2)),
                  height: Math.max(10, Math.min(22, pen.size * 2.2)),
                }}
                className="rounded-full border border-white/40 shadow-xs"
              />
              <span className="mt-0.5 text-[9px] font-bold text-slate-400">
                {Math.round(pen.size)}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={addPenPreset}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-700 text-slate-400 hover:border-blue-400 hover:text-blue-300"
          title="Yeni Ön Tanımlı Kalem Yuvası Ekle"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className={isVertical ? 'h-px w-8 bg-slate-800' : 'h-7 w-px bg-slate-800'} />

      {/* FOSFORLU KALEM YUVALARI */}
      <div className={`flex items-center gap-1 ${isVertical ? 'flex-col' : 'flex-row'}`}>
        {highlighterPresets.map((hl) => {
          const isSelected = activeTool === 'highlighter' && activeHighlighterId === hl.id;
          return (
            <button
              key={hl.id}
              type="button"
              onClick={() => {
                if (isSelected) {
                  setOpenPopover((prev) => (prev === 'highlighter' ? null : 'highlighter'));
                } else {
                  selectHighlighterPreset(hl.id);
                  setOpenPopover(null);
                }
              }}
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${
                isSelected
                  ? 'border-amber-300 bg-slate-800 ring-2 ring-amber-400/40'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-600'
              }`}
              title={`${hl.name} — Ayarlar için tekrar dokunun`}
            >
              <Highlighter className="h-4 w-4" style={{ color: hl.color }} />
            </button>
          );
        })}
      </div>

      <div className={isVertical ? 'h-px w-8 bg-slate-800' : 'h-7 w-px bg-slate-800'} />

      {/* SİLGİ, ŞEKİLLER, BÖLGE İŞARETLEME, LAZER, ODAK */}
      <button
        type="button"
        onClick={() => toggleOrSelect('eraser', 'eraser')}
        className={`${btnBase} ${activeTool === 'eraser' ? btnActive : btnIdle}`}
        title={`Silgi (${eraserMode === 'stroke' ? 'Çizgi Silgisi' : 'Kısmi Silgi'})`}
      >
        <Eraser className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => toggleOrSelect('shape', 'shape')}
        className={`${btnBase} ${activeTool === 'shape' ? btnActive : btnIdle}`}
        title="Hazır Geometrik Şekiller & Koordinat Düzlemi"
      >
        <Shapes className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => toggleOrSelect('region', 'region')}
        className={`${btnBase} ${activeTool === 'region' ? btnActive : btnIdle}`}
        title="Bölge İşaretleme & Vurgulama Çerçevesi"
      >
        <SquareDashedMousePointer className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => {
          setActiveTool('laser');
          setOpenPopover(null);
        }}
        className={`${btnBase} ${activeTool === 'laser' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : btnIdle}`}
        title="Lazer İşaretçi (Geçici Sunum İzi)"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => {
          toggleSpotlight();
          setOpenPopover(null);
        }}
        className={`${btnBase} ${spotlight.active ? 'bg-amber-500 text-slate-950 shadow-md' : btnIdle}`}
        title="Odak Perdesi (Spotlight)"
      >
        <Sun className="h-5 w-5" />
      </button>

      <div className={isVertical ? 'h-px w-8 bg-slate-800' : 'h-7 w-px bg-slate-800'} />

      {/* KEMENT, METİN, YAPIŞKAN NOT, GÖRSEL, CETVEL, AÇIÖLÇER, EL */}
      <button
        type="button"
        onClick={() => {
          setActiveTool('lasso');
          setOpenPopover(null);
        }}
        className={`${btnBase} ${activeTool === 'lasso' ? btnActive : btnIdle}`}
        title="Kement Seçim (Seç, Taşı, Boyutlandır, Renklendir)"
      >
        <Lasso className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => toggleOrSelect('text', 'text')}
        className={`${btnBase} ${activeTool === 'text' ? btnActive : btnIdle}`}
        title="Metin Kutusu Ekle"
      >
        <Type className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => toggleOrSelect('sticky', 'sticky')}
        className={`${btnBase} ${activeTool === 'sticky' ? btnActive : btnIdle}`}
        title="Yapışkan Not Ekle"
      >
        <StickyNote className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => imgInputRef.current?.click()}
        className={`${btnBase} ${btnIdle}`}
        title="Sayfaya Görsel Ekle (veya Ctrl+V ile yapıştır)"
      >
        <ImagePlus className="h-5 w-5" />
      </button>
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        onChange={handleImagePick}
        className="hidden"
      />

      <button
        type="button"
        onClick={toggleRuler}
        className={`${btnBase} ${ruler.visible ? 'bg-amber-500 text-slate-950' : btnIdle}`}
        title="Cetvel (Kenara yaslayarak düz çizgi çizebilirsiniz)"
      >
        <Ruler className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={toggleProtractor}
        className={`${btnBase} ${protractor.visible ? 'bg-sky-500 text-slate-950' : btnIdle}`}
        title="Açıölçer"
      >
        <Compass className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => {
          setActiveTool('pan');
          setOpenPopover(null);
        }}
        className={`${btnBase} ${activeTool === 'pan' ? btnActive : btnIdle}`}
        title="Sayfayı Kaydır (El Aracı)"
      >
        <Hand className="h-5 w-5" />
      </button>

      <div className={isVertical ? 'h-px w-8 bg-slate-800' : 'h-7 w-px bg-slate-800'} />

      {/* AKILLI ŞEKİL VE AVUÇ İÇİ REDDİ (SADECE KALEM) */}
      <button
        type="button"
        onClick={toggleAutoShape}
        className={`${btnBase} ${autoShape ? 'bg-violet-600 text-white shadow-md' : btnIdle}`}
        title="Akıllı Şekil Düzeltme (El çizimini düzgün doğru/daire/kareye çevirir)"
      >
        <Wand2 className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={togglePalmRejection}
        className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition active:scale-95 ${
          palmRejection
            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
        }`}
        title="Avuç İçi Reddi: Açıkken parmak sadece kaydırır, yalnızca kalem çizer"
      >
        <PenTool className="h-4 w-4 shrink-0" />
        {!isVertical && <span>{palmRejection ? 'Sadece Kalem' : 'Kalem+Parmak'}</span>}
      </button>

      <div className={isVertical ? 'h-px w-8 bg-slate-800' : 'h-7 w-px bg-slate-800'} />

      {/* GERİ AL / İLERİ AL */}
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        className={`${btnBase} ${canUndo ? btnIdle : 'cursor-not-allowed text-slate-600'}`}
        title="Geri Al (Ctrl+Z)"
      >
        <Undo2 className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        className={`${btnBase} ${canRedo ? btnIdle : 'cursor-not-allowed text-slate-600'}`}
        title="İleri Al (Ctrl+Y)"
      >
        <Redo2 className="h-5 w-5" />
      </button>

      {/* YAKINLAŞTIRMA */}
      <div className={`flex items-center gap-0.5 ${isVertical ? 'flex-col' : 'flex-row'}`}>
        <button
          type="button"
          onClick={() => setZoom(zoom - 0.15)}
          className={`${btnBase} h-9 w-9 ${btnIdle}`}
          title="Uzaklaştır"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded-lg px-1.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800"
          title="Görünümü Sıfırla (100%)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom(zoom + 0.15)}
          className={`${btnBase} h-9 w-9 ${btnIdle}`}
          title="Yakınlaştır"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      {/* ARAÇ ÇUBUĞU KONUMU (ÜST / SOL / SAĞ) VE TAM EKRAN */}
      <button
        type="button"
        onClick={() =>
          setToolbarDock(toolbarDock === 'top' ? 'left' : toolbarDock === 'left' ? 'right' : 'top')
        }
        className={`${btnBase} h-9 w-9 ${btnIdle}`}
        title="Araç Çubuğunu Taşı (Üst / Sol / Sağ El)"
      >
        {toolbarDock === 'top' ? (
          <PanelTop className="h-4 w-4" />
        ) : toolbarDock === 'left' ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelRight className="h-4 w-4" />
        )}
      </button>

      <button
        type="button"
        onClick={toggleFullscreenFocus}
        className={`${btnBase} h-9 w-9 ${focusMode ? 'bg-blue-600 text-white' : btnIdle}`}
        title="Odak / Sunum Modu"
      >
        {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {/* ==================== AYAR POPOVER'LARI ==================== */}
      {openPopover &&
        createPortal(
          <>
            <div onClick={() => setOpenPopover(null)} className="fixed inset-0 z-40" />
            <div
              className={`fixed z-50 w-80 max-w-[92vw] max-h-[82vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/98 p-4 text-slate-100 shadow-2xl backdrop-blur-xl ${popoverPosClass}`}
            >
            {/* KALEM AYARLARI */}
            {openPopover === 'pen' && activePen && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={activePen.name}
                    onChange={(e) => updatePenPreset(activePen.id, { name: e.target.value })}
                    className="w-44 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm font-semibold text-white outline-none focus:border-blue-500"
                  />
                  {penPresets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        deletePenPreset(activePen.id);
                        setOpenPopover(null);
                      }}
                      className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                      title="Bu Kalem Yuvasını Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Uç Tipi
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {PEN_TIP_LABELS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updatePenPreset(activePen.id, { tip: t.id })}
                        className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                          activePen.tip === t.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Kalınlık</span>
                    <span className="font-bold">{activePen.size.toFixed(1)} px</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    step={0.5}
                    value={activePen.size}
                    onChange={(e) =>
                      updatePenPreset(activePen.id, { size: Number(e.target.value) })
                    }
                    className="mt-1 w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Opaklık</span>
                    <span className="font-bold">{Math.round(activePen.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={activePen.opacity}
                    onChange={(e) =>
                      updatePenPreset(activePen.id, { opacity: Number(e.target.value) })
                    }
                    className="mt-1 w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                    <span>Renk</span>
                    <label className="flex cursor-pointer items-center gap-1 text-blue-400">
                      <span>Özel</span>
                      <input
                        type="color"
                        value={activePen.color}
                        onChange={(e) =>
                          updatePenPreset(activePen.id, { color: e.target.value })
                        }
                        className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {QUICK_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updatePenPreset(activePen.id, { color: c })}
                        style={{ backgroundColor: c }}
                        className={`h-7 w-7 rounded-full border-2 transition ${
                          activePen.color === c
                            ? 'scale-110 border-blue-400 ring-2 ring-blue-500/40'
                            : 'border-white/25 hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FOSFORLU KALEM AYARLARI */}
            {openPopover === 'highlighter' && activeHighlighter && (
              <div className="space-y-3">
                <div className="text-sm font-bold text-amber-300">{activeHighlighter.name}</div>
                <div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Genişlik</span>
                    <span className="font-bold">{activeHighlighter.size} px</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={48}
                    step={2}
                    value={activeHighlighter.size}
                    onChange={(e) =>
                      updateHighlighterPreset(activeHighlighter.id, {
                        size: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full accent-amber-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Şeffaflık</span>
                    <span className="font-bold">{Math.round(activeHighlighter.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={0.75}
                    step={0.05}
                    value={activeHighlighter.opacity}
                    onChange={(e) =>
                      updateHighlighterPreset(activeHighlighter.id, {
                        opacity: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full accent-amber-400"
                  />
                </div>
                <label className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium">
                  <span>Düz Çizgi Kilidi (Satır Vurgulama)</span>
                  <input
                    type="checkbox"
                    checked={activeHighlighter.straightLine}
                    onChange={(e) =>
                      updateHighlighterPreset(activeHighlighter.id, {
                        straightLine: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-amber-400"
                  />
                </label>
                <div className="flex items-center gap-2">
                  {['#fde047', '#86efac', '#f9a8d4', '#7dd3fc', '#fdba74', '#d8b4fe'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateHighlighterPreset(activeHighlighter.id, { color: c })}
                      style={{ backgroundColor: c }}
                      className={`h-7 w-7 rounded-full border-2 ${
                        activeHighlighter.color === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={activeHighlighter.color}
                    onChange={(e) =>
                      updateHighlighterPreset(activeHighlighter.id, { color: e.target.value })
                    }
                    className="h-7 w-7 cursor-pointer rounded bg-transparent"
                  />
                </div>
              </div>
            )}

            {/* SİLGİ AYARLARI */}
            {openPopover === 'eraser' && (
              <div className="space-y-3">
                <div className="text-sm font-bold">Silgi Modu</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEraserMode('stroke')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      eraserMode === 'stroke'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Çizgi / Nesne Silgisi
                  </button>
                  <button
                    type="button"
                    onClick={() => setEraserMode('partial')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      eraserMode === 'partial'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Kısmi (Bölgesel) Silgi
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Silgi Boyutu</span>
                    <span className="font-bold">{eraserSize} px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={64}
                    value={eraserSize}
                    onChange={(e) => setEraserSize(Number(e.target.value))}
                    className="mt-1 w-full accent-rose-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearPageElements();
                    setOpenPopover(null);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600/20 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-600/30"
                >
                  <Trash2 className="h-4 w-4" />
                  Bu Sayfadaki Tüm Çizimleri Temizle
                </button>
              </div>
            )}

            {/* GEOMETRİK ŞEKİLLER */}
            {openPopover === 'shape' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Geometrik Şekiller</span>
                  <span className="text-[11px] text-slate-400">Shift: Düzgün Oran</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SHAPE_CATALOG.map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      onClick={() => updateShapeSettings({ shapeKind: sh.id })}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                        shapeSettings.shapeKind === sh.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(['solid', 'dashed', 'dotted'] as DashStyle[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => updateShapeSettings({ dash: d })}
                      className={`rounded-lg py-1 text-xs ${
                        shapeSettings.dash === d ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {d === 'solid' ? 'Düz' : d === 'dashed' ? 'Kesik' : 'Noktalı'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center justify-between rounded-lg bg-slate-800 px-2.5 py-1.5">
                    <span>Kenar</span>
                    <input
                      type="color"
                      value={shapeSettings.strokeColor}
                      onChange={(e) => updateShapeSettings({ strokeColor: e.target.value })}
                      className="h-5 w-6 bg-transparent"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg bg-slate-800 px-2.5 py-1.5">
                    <span>Dolgu</span>
                    <input
                      type="color"
                      value={shapeSettings.fillColor === 'transparent' ? '#60a5fa' : shapeSettings.fillColor}
                      onChange={(e) =>
                        updateShapeSettings({
                          fillColor: e.target.value,
                          fillOpacity: Math.max(0.15, shapeSettings.fillOpacity),
                        })
                      }
                      className="h-5 w-6 bg-transparent"
                    />
                  </label>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span>Çizgi Kalınlığı</span>
                    <span>{shapeSettings.strokeWidth} px</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={14}
                    value={shapeSettings.strokeWidth}
                    onChange={(e) => updateShapeSettings({ strokeWidth: Number(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between">
                    <span>Dolgu Şeffaflığı</span>
                    <span>{Math.round(shapeSettings.fillOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.85}
                    step={0.05}
                    value={shapeSettings.fillOpacity}
                    onChange={(e) => updateShapeSettings({ fillOpacity: Number(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            )}

            {/* BÖLGE İŞARETLEME */}
            {openPopover === 'region' && (
              <div className="space-y-3">
                <div className="text-sm font-bold">Bölge İşaretleme Aracı</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'box', label: 'Çerçeve' },
                      { id: 'ellipse', label: 'Daire/Elips' },
                      { id: 'highlight-area', label: 'Vurgu Alanı' },
                    ] as { id: RegionKind; label: string }[]
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => updateRegionSettings({ regionKind: r.id })}
                      className={`rounded-lg py-1.5 text-xs font-medium ${
                        regionSettings.regionKind === r.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center justify-between rounded-lg bg-slate-800 px-2.5 py-1.5">
                    <span>Çerçeve</span>
                    <input
                      type="color"
                      value={regionSettings.strokeColor}
                      onChange={(e) => updateRegionSettings({ strokeColor: e.target.value })}
                      className="h-5 w-6 bg-transparent"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg bg-slate-800 px-2.5 py-1.5">
                    <span>İç Renk</span>
                    <input
                      type="color"
                      value={regionSettings.fillColor}
                      onChange={(e) => updateRegionSettings({ fillColor: e.target.value })}
                      className="h-5 w-6 bg-transparent"
                    />
                  </label>
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium">
                  <span>Otomatik Numara Rozeti (1, 2, 3...)</span>
                  <input
                    type="checkbox"
                    checked={regionSettings.autoNumberBadge}
                    onChange={(e) => updateRegionSettings({ autoNumberBadge: e.target.checked })}
                    className="h-4 w-4 accent-blue-500"
                  />
                </label>
              </div>
            )}

            {/* METİN AYARLARI */}
            {openPopover === 'text' && (
              <div className="space-y-3">
                <div className="text-sm font-bold">Metin Kutusu</div>
                <div className="flex items-center justify-between text-xs">
                  <span>Yazı Boyutu: {textFontSize}px</span>
                  <button
                    type="button"
                    onClick={() => setTextSettings({ textBold: !textBold })}
                    className={`rounded-lg px-2.5 py-1 font-bold ${
                      textBold ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Kalın (B)
                  </button>
                </div>
                <input
                  type="range"
                  min={12}
                  max={48}
                  value={textFontSize}
                  onChange={(e) => setTextSettings({ textFontSize: Number(e.target.value) })}
                  className="w-full accent-blue-500"
                />
                <div className="grid grid-cols-7 gap-1.5">
                  {QUICK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTextSettings({ textColor: c })}
                      style={{ backgroundColor: c }}
                      className={`h-7 w-7 rounded-full border-2 ${
                        textColor === c ? 'border-blue-400 scale-110' : 'border-white/25'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* YAPIŞKAN NOT AYARLARI */}
            {openPopover === 'sticky' && (
              <div className="space-y-3">
                <div className="text-sm font-bold">Yapışkan Not Rengi</div>
                <div className="flex items-center gap-2">
                  {STICKY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTextSettings({ stickyColor: c })}
                      style={{ backgroundColor: c }}
                      className={`h-8 w-8 rounded-lg border-2 ${
                        stickyColor === c ? 'border-blue-500 scale-110' : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Sayfada istediğiniz yere dokunarak yeni yapışkan not ekleyin.
                </p>
              </div>
            )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
