import { create } from 'zustand';
import {
  DEFAULT_HIGHLIGHTER_PRESETS,
  DEFAULT_PEN_PRESETS,
  PAGE_THEMES,
  isDarkColor,
} from '../constants/presets';
import type {
  CanvasElement,
  EraserMode,
  HighlighterPreset,
  Notebook,
  NotebookPage,
  PageBackground,
  PenPreset,
  ProtractorState,
  RegionSettings,
  RulerState,
  ShapeSettings,
  SpotlightState,
  ToolbarDock,
  ToolType,
} from '../types/notebook';
import { duplicateElement, uid } from '../utils/geometry';
import {
  deleteNotebookFromDb,
  loadAllNotebooks,
  loadPrefs,
  saveNotebook,
  savePrefs,
} from '../utils/storage';

const MAX_HISTORY = 80;

function createBlankPage(bg: PageBackground, width = 794, height = 1123): NotebookPage {
  return {
    id: uid('page'),
    width,
    height,
    background: {
      ...bg,
      pdfImageDataUrl: undefined,
      backgroundImageDataUrl: undefined,
      textContent: undefined,
    },
    elements: [],
  };
}

function createInitialNotebook(title = 'Mavi Defterim', bg?: PageBackground): Notebook {
  const defaultBackground: PageBackground = bg
    ? { ...bg }
    : { ...PAGE_THEMES[0].background };
  const now = Date.now();
  return {
    id: uid('nb'),
    title,
    createdAt: now,
    updatedAt: now,
    defaultBackground,
    pages: [createBlankPage(defaultBackground)],
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSaveNotebook(nb: Notebook | undefined) {
  if (!nb) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveNotebook(nb);
  }, 350);
}

interface ToastMessage {
  id: string;
  text: string;
  tone?: 'info' | 'success' | 'error';
}

interface NotebookStore {
  initialized: boolean;
  notebooks: Notebook[];
  activeNotebookId: string;
  activePageId: string;

  // Geçmiş (sayfa bazında)
  undoStack: Record<string, CanvasElement[][]>;
  redoStack: Record<string, CanvasElement[][]>;

  // Araçlar ve ön tanımlı kalemler
  activeTool: ToolType;
  penPresets: PenPreset[];
  activePenId: string;
  highlighterPresets: HighlighterPreset[];
  activeHighlighterId: string;
  eraserMode: EraserMode;
  eraserSize: number;
  shapeSettings: ShapeSettings;
  regionSettings: RegionSettings;
  textColor: string;
  textFontSize: number;
  textBold: boolean;
  stickyColor: string;
  laserColor: string;

  // Dokunmatik / ergonomi ayarları
  palmRejection: boolean;
  autoShape: boolean;
  toolbarDock: ToolbarDock;
  sidebarOpen: boolean;
  focusMode: boolean;

  // Görünüm
  zoom: number;
  panX: number;
  panY: number;

  // Seçim
  selectedIds: string[];

  // Yardımcı ölçüm ve odak katmanları
  ruler: RulerState;
  protractor: ProtractorState;
  spotlight: SpotlightState;

  // Bildirim ve meşgul durumu
  busyMessage: string | null;
  toast: ToastMessage | null;

  // Eylemler
  init: () => Promise<void>;
  getActiveNotebook: () => Notebook | undefined;
  getActivePage: () => NotebookPage | undefined;

  createNotebook: (title?: string, bg?: PageBackground) => void;
  selectNotebook: (id: string) => void;
  renameNotebook: (id: string, title: string) => void;
  deleteNotebook: (id: string) => void;
  importFullNotebook: (nb: Notebook) => void;

  selectPage: (pageId: string) => void;
  addPage: (afterCurrent?: boolean) => void;
  insertPages: (pages: NotebookPage[], asNewNotebookTitle?: string) => void;
  duplicatePage: (pageId: string) => void;
  deletePage: (pageId: string) => void;
  movePage: (pageId: string, direction: -1 | 1) => void;
  updatePageBackground: (patch: Partial<PageBackground>, applyToAll?: boolean) => void;
  setPageSize: (width: number, height: number, applyToAll?: boolean) => void;

  // Eleman ve geçmiş işlemleri
  commitPageElements: (nextElements: CanvasElement[], recordHistory?: boolean) => void;
  addElement: (el: CanvasElement) => void;
  updateElementsById: (updater: (el: CanvasElement) => CanvasElement, recordHistory?: boolean) => void;
  deleteSelectedElements: () => void;
  duplicateSelectedElements: () => void;
  recolorSelectedElements: (color: string) => void;
  clearPageElements: () => void;
  undo: () => void;
  redo: () => void;

  // Kalem ve araç ayarları
  setActiveTool: (tool: ToolType) => void;
  selectPenPreset: (id: string) => void;
  updatePenPreset: (id: string, patch: Partial<PenPreset>) => void;
  addPenPreset: () => void;
  deletePenPreset: (id: string) => void;
  selectHighlighterPreset: (id: string) => void;
  updateHighlighterPreset: (id: string, patch: Partial<HighlighterPreset>) => void;
  setEraserMode: (mode: EraserMode) => void;
  setEraserSize: (size: number) => void;
  updateShapeSettings: (patch: Partial<ShapeSettings>) => void;
  updateRegionSettings: (patch: Partial<RegionSettings>) => void;
  setTextSettings: (patch: Partial<{ textColor: string; textFontSize: number; textBold: boolean; stickyColor: string }>) => void;
  setLaserColor: (color: string) => void;

  togglePalmRejection: () => void;
  toggleAutoShape: () => void;
  setToolbarDock: (dock: ToolbarDock) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleFullscreenFocus: () => void;

  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;
  setSelectedIds: (ids: string[]) => void;

  toggleRuler: () => void;
  updateRuler: (patch: Partial<RulerState>) => void;
  toggleProtractor: () => void;
  updateProtractor: (patch: Partial<ProtractorState>) => void;
  toggleSpotlight: () => void;
  updateSpotlight: (patch: Partial<SpotlightState>) => void;

  setBusyMessage: (msg: string | null) => void;
  showToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const initialNb = createInitialNotebook();

export const useNotebookStore = create<NotebookStore>((set, get) => {
  const persistCurrentPrefs = () => {
    const s = get();
    void savePrefs({
      penPresets: s.penPresets,
      highlighterPresets: s.highlighterPresets,
      palmRejection: s.palmRejection,
      autoShape: s.autoShape,
      toolbarDock: s.toolbarDock,
      activeNotebookId: s.activeNotebookId,
    });
  };

  return {
    initialized: false,
    notebooks: [initialNb],
    activeNotebookId: initialNb.id,
    activePageId: initialNb.pages[0].id,

    undoStack: {},
    redoStack: {},

    activeTool: 'pen',
    penPresets: DEFAULT_PEN_PRESETS,
    activePenId: DEFAULT_PEN_PRESETS[1].id, // Lacivert dolma kalem
    highlighterPresets: DEFAULT_HIGHLIGHTER_PRESETS,
    activeHighlighterId: DEFAULT_HIGHLIGHTER_PRESETS[0].id,
    eraserMode: 'stroke',
    eraserSize: 22,
    shapeSettings: {
      shapeKind: 'rect',
      strokeColor: '#1d4ed8',
      strokeWidth: 3,
      fillColor: '#60a5fa',
      fillOpacity: 0.12,
      dash: 'solid',
    },
    regionSettings: {
      regionKind: 'box',
      strokeColor: '#dc2626',
      fillColor: '#fde047',
      fillOpacity: 0.22,
      strokeWidth: 3,
      autoNumberBadge: true,
    },
    textColor: '#0f172a',
    textFontSize: 20,
    textBold: false,
    stickyColor: '#fef08a',
    laserColor: '#ef4444',

    palmRejection: false,
    autoShape: false,
    toolbarDock: 'top',
    sidebarOpen: true,
    focusMode: false,

    zoom: 1,
    panX: 0,
    panY: 0,

    selectedIds: [],

    ruler: { visible: false, x: 400, y: 360, angle: 0, length: 480 },
    protractor: { visible: false, x: 400, y: 420, angle: 0, radius: 155 },
    spotlight: { active: false, x: 200, y: 180, width: 380, height: 240, shape: 'rect', dimOpacity: 0.68 },

    busyMessage: null,
    toast: null,

    init: async () => {
      const [storedNotebooks, prefs] = await Promise.all([loadAllNotebooks(), loadPrefs()]);
      if (storedNotebooks.length > 0) {
        const chosenNb =
          storedNotebooks.find((n) => n.id === prefs.activeNotebookId) ?? storedNotebooks[0];
        set({
          initialized: true,
          notebooks: storedNotebooks,
          activeNotebookId: chosenNb.id,
          activePageId: chosenNb.pages[0]?.id ?? '',
          penPresets: prefs.penPresets?.length ? prefs.penPresets : DEFAULT_PEN_PRESETS,
          activePenId: prefs.penPresets?.[0]?.id ?? DEFAULT_PEN_PRESETS[1].id,
          highlighterPresets: prefs.highlighterPresets?.length
            ? prefs.highlighterPresets
            : DEFAULT_HIGHLIGHTER_PRESETS,
          activeHighlighterId:
            prefs.highlighterPresets?.[0]?.id ?? DEFAULT_HIGHLIGHTER_PRESETS[0].id,
          palmRejection: prefs.palmRejection ?? false,
          autoShape: prefs.autoShape ?? false,
          toolbarDock: prefs.toolbarDock ?? 'top',
        });
      } else {
        await saveNotebook(initialNb);
        set({ initialized: true });
      }
    },

    getActiveNotebook: () => {
      const { notebooks, activeNotebookId } = get();
      return notebooks.find((n) => n.id === activeNotebookId) ?? notebooks[0];
    },

    getActivePage: () => {
      const nb = get().getActiveNotebook();
      if (!nb) return undefined;
      return nb.pages.find((p) => p.id === get().activePageId) ?? nb.pages[0];
    },

    createNotebook: (title, bg) => {
      const nb = createInitialNotebook(title || `Defter ${get().notebooks.length + 1}`, bg);
      set((s) => ({
        notebooks: [nb, ...s.notebooks],
        activeNotebookId: nb.id,
        activePageId: nb.pages[0].id,
        selectedIds: [],
        panX: 0,
        panY: 0,
        zoom: 1,
      }));
      void saveNotebook(nb);
      persistCurrentPrefs();
      get().showToast(`"${nb.title}" oluşturuldu`, 'success');
    },

    selectNotebook: (id) => {
      const nb = get().notebooks.find((n) => n.id === id);
      if (!nb) return;
      set({
        activeNotebookId: nb.id,
        activePageId: nb.pages[0]?.id ?? '',
        selectedIds: [],
        panX: 0,
        panY: 0,
      });
      persistCurrentPrefs();
    },

    renameNotebook: (id, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      let updatedNb: Notebook | undefined;
      set((s) => ({
        notebooks: s.notebooks.map((n) => {
          if (n.id !== id) return n;
          updatedNb = { ...n, title: trimmed, updatedAt: Date.now() };
          return updatedNb;
        }),
      }));
      scheduleSaveNotebook(updatedNb);
    },

    deleteNotebook: (id) => {
      const s = get();
      if (s.notebooks.length <= 1) {
        s.showToast('En az bir defter bulunmalıdır', 'error');
        return;
      }
      const rest = s.notebooks.filter((n) => n.id !== id);
      const nextActive = s.activeNotebookId === id ? rest[0] : s.getActiveNotebook()!;
      set({
        notebooks: rest,
        activeNotebookId: nextActive.id,
        activePageId: nextActive.pages[0].id,
        selectedIds: [],
      });
      void deleteNotebookFromDb(id);
      persistCurrentPrefs();
      get().showToast('Defter silindi', 'info');
    },

    importFullNotebook: (nb) => {
      const cloned: Notebook = {
        ...nb,
        id: uid('nb'),
        updatedAt: Date.now(),
      };
      set((s) => ({
        notebooks: [cloned, ...s.notebooks],
        activeNotebookId: cloned.id,
        activePageId: cloned.pages[0].id,
        selectedIds: [],
      }));
      void saveNotebook(cloned);
      persistCurrentPrefs();
      get().showToast(`"${cloned.title}" içe aktarıldı`, 'success');
    },

    selectPage: (pageId) => {
      set({ activePageId: pageId, selectedIds: [] });
    },

    addPage: (afterCurrent = true) => {
      const nb = get().getActiveNotebook();
      if (!nb) return;
      const activePage = get().getActivePage();
      const bg = activePage
        ? {
            ...nb.defaultBackground,
            color: activePage.background.pdfImageDataUrl
              ? nb.defaultBackground.color
              : activePage.background.color,
            pattern: activePage.background.pdfImageDataUrl
              ? nb.defaultBackground.pattern
              : activePage.background.pattern,
            patternColor: activePage.background.patternColor || nb.defaultBackground.patternColor,
            patternOpacity: activePage.background.pdfImageDataUrl
              ? nb.defaultBackground.patternOpacity
              : activePage.background.patternOpacity,
            spacing: activePage.background.spacing || nb.defaultBackground.spacing,
          }
        : nb.defaultBackground;
      const newPage = createBlankPage(
        bg,
        activePage?.width ?? 794,
        activePage?.height ?? 1123
      );
      const idx = nb.pages.findIndex((p) => p.id === get().activePageId);
      const nextPages = [...nb.pages];
      if (afterCurrent && idx >= 0) {
        nextPages.splice(idx + 1, 0, newPage);
      } else {
        nextPages.push(newPage);
      }
      const updatedNb: Notebook = { ...nb, pages: nextPages, updatedAt: Date.now() };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
        activePageId: newPage.id,
        selectedIds: [],
      }));
      scheduleSaveNotebook(updatedNb);
    },

    insertPages: (pages, asNewNotebookTitle) => {
      if (pages.length === 0) return;
      if (asNewNotebookTitle) {
        const now = Date.now();
        const nb: Notebook = {
          id: uid('nb'),
          title: asNewNotebookTitle,
          createdAt: now,
          updatedAt: now,
          defaultBackground: { ...PAGE_THEMES[0].background },
          pages,
        };
        set((s) => ({
          notebooks: [nb, ...s.notebooks],
          activeNotebookId: nb.id,
          activePageId: pages[0].id,
          selectedIds: [],
          panX: 0,
          panY: 0,
        }));
        void saveNotebook(nb);
        persistCurrentPrefs();
        return;
      }

      const nb = get().getActiveNotebook();
      if (!nb) return;
      const idx = nb.pages.findIndex((p) => p.id === get().activePageId);
      const nextPages = [...nb.pages];
      nextPages.splice(idx >= 0 ? idx + 1 : nextPages.length, 0, ...pages);
      const updatedNb: Notebook = { ...nb, pages: nextPages, updatedAt: Date.now() };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
        activePageId: pages[0].id,
        selectedIds: [],
      }));
      scheduleSaveNotebook(updatedNb);
    },

    duplicatePage: (pageId) => {
      const nb = get().getActiveNotebook();
      if (!nb) return;
      const idx = nb.pages.findIndex((p) => p.id === pageId);
      if (idx < 0) return;
      const src = nb.pages[idx];
      const copy: NotebookPage = {
        ...src,
        id: uid('page'),
        background: { ...src.background },
        elements: src.elements.map((e) => ({ ...e, id: uid(e.type) })),
      };
      const nextPages = [...nb.pages];
      nextPages.splice(idx + 1, 0, copy);
      const updatedNb: Notebook = { ...nb, pages: nextPages, updatedAt: Date.now() };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
        activePageId: copy.id,
      }));
      scheduleSaveNotebook(updatedNb);
    },

    deletePage: (pageId) => {
      const nb = get().getActiveNotebook();
      if (!nb) return;
      if (nb.pages.length <= 1) {
        get().showToast('Defterde en az 1 sayfa kalmalıdır', 'error');
        return;
      }
      const idx = nb.pages.findIndex((p) => p.id === pageId);
      const nextPages = nb.pages.filter((p) => p.id !== pageId);
      const nextActive =
        get().activePageId === pageId
          ? nextPages[Math.max(0, idx - 1)].id
          : get().activePageId;
      const updatedNb: Notebook = { ...nb, pages: nextPages, updatedAt: Date.now() };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
        activePageId: nextActive,
        selectedIds: [],
      }));
      scheduleSaveNotebook(updatedNb);
    },

    movePage: (pageId, direction) => {
      const nb = get().getActiveNotebook();
      if (!nb) return;
      const idx = nb.pages.findIndex((p) => p.id === pageId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= nb.pages.length) return;
      const nextPages = [...nb.pages];
      const [item] = nextPages.splice(idx, 1);
      nextPages.splice(target, 0, item);
      const updatedNb: Notebook = { ...nb, pages: nextPages, updatedAt: Date.now() };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
      }));
      scheduleSaveNotebook(updatedNb);
    },

    updatePageBackground: (patch, applyToAll = false) => {
      const nb = get().getActiveNotebook();
      if (!nb) return;
      const activePageId = get().activePageId;

      const patchWithContrast = { ...patch };
      if (patch.color && !patch.textColor) {
        patchWithContrast.textColor = isDarkColor(patch.color) ? '#f8fafc' : '#0f172a';
      }

      const nextDefault: PageBackground = {
        ...nb.defaultBackground,
        ...patchWithContrast,
        pdfImageDataUrl: undefined,
        textContent: undefined,
      };

      const nextPages = nb.pages.map((p) => {
        if (!applyToAll && p.id !== activePageId) return p;
        return {
          ...p,
          background: {
            ...p.background,
            ...patchWithContrast,
          },
        };
      });

      const updatedNb: Notebook = {
        ...nb,
        defaultBackground: applyToAll ? nextDefault : nb.defaultBackground,
        pages: nextPages,
        updatedAt: Date.now(),
      };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
      }));
      scheduleSaveNotebook(updatedNb);
    },

    setPageSize: (width, height, applyToAll = false) => {
      const nb = get().getActiveNotebook();
      if (!nb) return;
      const activePageId = get().activePageId;
      const nextPages = nb.pages.map((p) =>
        applyToAll || p.id === activePageId ? { ...p, width, height } : p
      );
      const updatedNb: Notebook = { ...nb, pages: nextPages, updatedAt: Date.now() };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
      }));
      scheduleSaveNotebook(updatedNb);
    },

    commitPageElements: (nextElements, recordHistory = true) => {
      const nb = get().getActiveNotebook();
      const page = get().getActivePage();
      if (!nb || !page) return;

      const nextPages = nb.pages.map((p) =>
        p.id === page.id ? { ...p, elements: nextElements } : p
      );
      const updatedNb: Notebook = { ...nb, pages: nextPages, updatedAt: Date.now() };

      set((s) => {
        const nextUndo = { ...s.undoStack };
        const nextRedo = { ...s.redoStack };
        if (recordHistory) {
          const prevStack = nextUndo[page.id] ?? [];
          nextUndo[page.id] = [...prevStack.slice(-(MAX_HISTORY - 1)), page.elements];
          nextRedo[page.id] = [];
        }
        return {
          notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
          undoStack: nextUndo,
          redoStack: nextRedo,
        };
      });
      scheduleSaveNotebook(updatedNb);
    },

    addElement: (el) => {
      const page = get().getActivePage();
      if (!page) return;
      get().commitPageElements([...page.elements, el], true);
    },

    updateElementsById: (updater, recordHistory = true) => {
      const page = get().getActivePage();
      if (!page) return;
      const next = page.elements.map(updater);
      get().commitPageElements(next, recordHistory);
    },

    deleteSelectedElements: () => {
      const page = get().getActivePage();
      const ids = get().selectedIds;
      if (!page || ids.length === 0) return;
      const idSet = new Set(ids);
      get().commitPageElements(
        page.elements.filter((e) => !idSet.has(e.id)),
        true
      );
      set({ selectedIds: [] });
    },

    duplicateSelectedElements: () => {
      const page = get().getActivePage();
      const ids = get().selectedIds;
      if (!page || ids.length === 0) return;
      const idSet = new Set(ids);
      const copies = page.elements.filter((e) => idSet.has(e.id)).map((e) => duplicateElement(e));
      get().commitPageElements([...page.elements, ...copies], true);
      set({ selectedIds: copies.map((c) => c.id) });
    },

    recolorSelectedElements: (color) => {
      const ids = new Set(get().selectedIds);
      if (ids.size === 0) return;
      get().updateElementsById((el) => {
        if (!ids.has(el.id)) return el;
        if (el.type === 'stroke') return { ...el, color };
        if (el.type === 'shape') return { ...el, strokeColor: color };
        if (el.type === 'region') return { ...el, strokeColor: color };
        if (el.type === 'text') return { ...el, color };
        return el;
      }, true);
    },

    clearPageElements: () => {
      const page = get().getActivePage();
      if (!page || page.elements.length === 0) return;
      get().commitPageElements([], true);
      set({ selectedIds: [] });
      get().showToast('Sayfadaki çizimler temizlendi', 'info');
    },

    undo: () => {
      const nb = get().getActiveNotebook();
      const page = get().getActivePage();
      if (!nb || !page) return;
      const stack = get().undoStack[page.id] ?? [];
      if (stack.length === 0) return;
      const previous = stack[stack.length - 1];
      const updatedNb: Notebook = {
        ...nb,
        pages: nb.pages.map((p) => (p.id === page.id ? { ...p, elements: previous } : p)),
        updatedAt: Date.now(),
      };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
        undoStack: { ...s.undoStack, [page.id]: stack.slice(0, -1) },
        redoStack: {
          ...s.redoStack,
          [page.id]: [...(s.redoStack[page.id] ?? []), page.elements],
        },
        selectedIds: [],
      }));
      scheduleSaveNotebook(updatedNb);
    },

    redo: () => {
      const nb = get().getActiveNotebook();
      const page = get().getActivePage();
      if (!nb || !page) return;
      const stack = get().redoStack[page.id] ?? [];
      if (stack.length === 0) return;
      const next = stack[stack.length - 1];
      const updatedNb: Notebook = {
        ...nb,
        pages: nb.pages.map((p) => (p.id === page.id ? { ...p, elements: next } : p)),
        updatedAt: Date.now(),
      };
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
        redoStack: { ...s.redoStack, [page.id]: stack.slice(0, -1) },
        undoStack: {
          ...s.undoStack,
          [page.id]: [...(s.undoStack[page.id] ?? []), page.elements],
        },
        selectedIds: [],
      }));
      scheduleSaveNotebook(updatedNb);
    },

    setActiveTool: (tool) => set({ activeTool: tool, selectedIds: tool === 'lasso' ? get().selectedIds : [] }),

    selectPenPreset: (id) => set({ activeTool: 'pen', activePenId: id, selectedIds: [] }),

    updatePenPreset: (id, patch) => {
      set((s) => ({
        penPresets: s.penPresets.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
      persistCurrentPrefs();
    },

    addPenPreset: () => {
      const count = get().penPresets.length;
      if (count >= 10) {
        get().showToast('En fazla 10 ön tanımlı kalem ekleyebilirsiniz', 'info');
        return;
      }
      const colors = ['#7c3aed', '#0284c7', '#db2777', '#0f766e', '#ca8a04'];
      const newPen: PenPreset = {
        id: uid('pen'),
        name: `Kalem ${count + 1}`,
        color: colors[count % colors.length],
        size: 4,
        opacity: 1,
        tip: 'ballpoint',
      };
      set((s) => ({
        penPresets: [...s.penPresets, newPen],
        activePenId: newPen.id,
        activeTool: 'pen',
      }));
      persistCurrentPrefs();
    },

    deletePenPreset: (id) => {
      const list = get().penPresets;
      if (list.length <= 1) return;
      const next = list.filter((p) => p.id !== id);
      set({
        penPresets: next,
        activePenId: get().activePenId === id ? next[0].id : get().activePenId,
      });
      persistCurrentPrefs();
    },

    selectHighlighterPreset: (id) =>
      set({ activeTool: 'highlighter', activeHighlighterId: id, selectedIds: [] }),

    updateHighlighterPreset: (id, patch) => {
      set((s) => ({
        highlighterPresets: s.highlighterPresets.map((h) =>
          h.id === id ? { ...h, ...patch } : h
        ),
      }));
      persistCurrentPrefs();
    },

    setEraserMode: (mode) => set({ eraserMode: mode, activeTool: 'eraser' }),
    setEraserSize: (size) => set({ eraserSize: size }),
    updateShapeSettings: (patch) =>
      set((s) => ({
        shapeSettings: { ...s.shapeSettings, ...patch },
      })),
    updateRegionSettings: (patch) =>
      set((s) => ({
        regionSettings: { ...s.regionSettings, ...patch },
      })),
    setTextSettings: (patch) => set((s) => ({ ...s, ...patch })),
    setLaserColor: (color) => set({ laserColor: color }),

    togglePalmRejection: () => {
      const next = !get().palmRejection;
      set({ palmRejection: next });
      persistCurrentPrefs();
      get().showToast(
        next
          ? 'Sadece Kalem Modu AÇIK (parmakla kaydır, kalemle çiz)'
          : 'Sadece Kalem Modu KAPALI (parmak ve kalemle çiz)',
        'info'
      );
    },

    toggleAutoShape: () => {
      const next = !get().autoShape;
      set({ autoShape: next });
      persistCurrentPrefs();
      get().showToast(
        next ? 'Akıllı Şekil Düzeltme AÇIK' : 'Akıllı Şekil Düzeltme KAPALI',
        'info'
      );
    },

    setToolbarDock: (dock) => {
      set({ toolbarDock: dock });
      persistCurrentPrefs();
    },

    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleFullscreenFocus: () => set((s) => ({ focusMode: !s.focusMode })),

    setZoom: (zoom) => set({ zoom: Math.max(0.35, Math.min(3.5, zoom)) }),
    setPan: (panX, panY) => set({ panX, panY }),
    resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
    setSelectedIds: (selectedIds) => set({ selectedIds }),

    toggleRuler: () => set((s) => ({ ruler: { ...s.ruler, visible: !s.ruler.visible } })),
    updateRuler: (patch) => set((s) => ({ ruler: { ...s.ruler, ...patch } })),
    toggleProtractor: () =>
      set((s) => ({ protractor: { ...s.protractor, visible: !s.protractor.visible } })),
    updateProtractor: (patch) => set((s) => ({ protractor: { ...s.protractor, ...patch } })),
    toggleSpotlight: () =>
      set((s) => ({ spotlight: { ...s.spotlight, active: !s.spotlight.active } })),
    updateSpotlight: (patch) => set((s) => ({ spotlight: { ...s.spotlight, ...patch } })),

    setBusyMessage: (busyMessage) => set({ busyMessage }),

    showToast: (text, tone = 'info') => {
      const id = uid('toast');
      set({ toast: { id, text, tone } });
      setTimeout(() => {
        if (get().toast?.id === id) {
          set({ toast: null });
        }
      }, 2800);
    },
  };
});
