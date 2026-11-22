import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Minimize2,
  Plus,
} from 'lucide-react';
import { CanvasStage } from './components/CanvasStage';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { useNotebookStore } from './store/useNotebookStore';
import { importNotebookJson } from './utils/exporters';
import { uid } from './utils/geometry';
import { importPdfFile, importTextOrDocxFile, readImageFile } from './utils/importers';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  const init = useNotebookStore((s) => s.init);
  const notebooks = useNotebookStore((s) => s.notebooks);
  const activeNotebookId = useNotebookStore((s) => s.activeNotebookId);
  const activePageId = useNotebookStore((s) => s.activePageId);
  const toolbarDock = useNotebookStore((s) => s.toolbarDock);
  const sidebarOpen = useNotebookStore((s) => s.sidebarOpen);
  const focusMode = useNotebookStore((s) => s.focusMode);
  const toggleFullscreenFocus = useNotebookStore((s) => s.toggleFullscreenFocus);
  const busyMessage = useNotebookStore((s) => s.busyMessage);
  const toast = useNotebookStore((s) => s.toast);

  const selectPage = useNotebookStore((s) => s.selectPage);
  const addPage = useNotebookStore((s) => s.addPage);
  const insertPages = useNotebookStore((s) => s.insertPages);
  const addElement = useNotebookStore((s) => s.addElement);
  const importFullNotebook = useNotebookStore((s) => s.importFullNotebook);
  const setBusyMessage = useNotebookStore((s) => s.setBusyMessage);
  const showToast = useNotebookStore((s) => s.showToast);

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const activeNotebook = useMemo(
    () => notebooks.find((n) => n.id === activeNotebookId) ?? notebooks[0],
    [notebooks, activeNotebookId]
  );

  const pageIndex = useMemo(() => {
    if (!activeNotebook) return 0;
    const idx = activeNotebook.pages.findIndex((p) => p.id === activePageId);
    return idx >= 0 ? idx : 0;
  }, [activeNotebook, activePageId]);

  // IndexedDB verilerini yükle
  useEffect(() => {
    void init();
  }, [init]);

  // PWA kurulum olayını yakala
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Klavye kısayolları ve pano görsel yapıştırma (Ctrl+V)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isEditing) return;

      const store = useNotebookStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length > 0) {
          e.preventDefault();
          store.deleteSelectedElements();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (store.selectedIds.length > 0) store.setSelectedIds([]);
        else if (store.focusMode) store.toggleFullscreenFocus();
        return;
      }
      // 1-9 tuşlarıyla ön tanımlı kalem yuvalarına anında geçiş
      if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (store.penPresets[idx]) {
          store.selectPenPreset(store.penPresets[idx].id);
        }
      }
    };

    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          try {
            const { dataUrl, width, height } = await readImageFile(file);
            const maxW = 420;
            const scale = width > maxW ? maxW / width : 1;
            useNotebookStore.getState().addElement({
              id: uid('img'),
              type: 'image',
              x: 120,
              y: 120,
              width: Math.round(width * scale),
              height: Math.round(height * scale),
              dataUrl,
            });
            useNotebookStore.getState().showToast('Panodaki görsel sayfaya yapıştırıldı', 'success');
          } catch {
            // yoksay
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  // Sürükle-Bırak belge/görsel yükleme
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();

    try {
      if (lower.endsWith('.pdf')) {
        setBusyMessage('PDF sayfaları içe aktarılıyor...');
        const pages = await importPdfFile(file, (cur, total) =>
          setBusyMessage(`PDF işleniyor (${cur}/${total})...`)
        );
        insertPages(pages);
        showToast(`${pages.length} PDF sayfası eklendi`, 'success');
      } else if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.docx')) {
        setBusyMessage('Metin belgesi ekleniyor...');
        const activePage = useNotebookStore.getState().getActivePage();
        const bg = activePage?.background ?? activeNotebook!.defaultBackground;
        const pages = await importTextOrDocxFile(file, bg);
        insertPages(pages);
        showToast(`${pages.length} metin sayfası eklendi`, 'success');
      } else if (lower.endsWith('.json')) {
        const nb = await importNotebookJson(file);
        importFullNotebook(nb);
      } else if (file.type.startsWith('image/')) {
        const { dataUrl, width, height } = await readImageFile(file);
        const maxW = 460;
        const scale = width > maxW ? maxW / width : 1;
        addElement({
          id: uid('img'),
          type: 'image',
          x: 100,
          y: 120,
          width: Math.round(width * scale),
          height: Math.round(height * scale),
          dataUrl,
        });
        showToast('Görsel sayfaya eklendi', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Dosya içe aktarılırken bir hata oluştu', 'error');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const prevPage = () => {
    if (activeNotebook && pageIndex > 0) {
      selectPage(activeNotebook.pages[pageIndex - 1].id);
    }
  };
  const nextPage = () => {
    if (activeNotebook && pageIndex < activeNotebook.pages.length - 1) {
      selectPage(activeNotebook.pages[pageIndex + 1].id);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragActive) setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={handleDrop}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100"
    >
      {/* ÜST ARAÇ ÇUBUĞU (dock === 'top') */}
      {!focusMode && toolbarDock === 'top' && <Toolbar />}

      {/* ANA ÇALIŞMA ALANI */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!focusMode && sidebarOpen && <Sidebar />}
        {!focusMode && toolbarDock === 'left' && <Toolbar />}

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <CanvasStage />

          {/* Alt Hızlı Sayfa Gezinme Çubuğu */}
          {activeNotebook && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
              <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/90 px-2 py-1 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md">
                <button
                  type="button"
                  onClick={prevPage}
                  disabled={pageIndex === 0}
                  className="rounded-full p-1.5 hover:bg-slate-800 disabled:opacity-30"
                  title="Önceki Sayfa"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[66px] text-center">
                  {pageIndex + 1} / {activeNotebook.pages.length}
                </span>
                <button
                  type="button"
                  onClick={nextPage}
                  disabled={pageIndex >= activeNotebook.pages.length - 1}
                  className="rounded-full p-1.5 hover:bg-slate-800 disabled:opacity-30"
                  title="Sonraki Sayfa"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="mx-0.5 h-4 w-px bg-slate-700" />
                <button
                  type="button"
                  onClick={() => addPage(true)}
                  className="flex items-center gap-1 rounded-full bg-blue-600/90 px-2.5 py-1 text-white hover:bg-blue-500"
                  title="Yeni Boş Sayfa Ekle"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Sayfa</span>
                </button>
                {focusMode && (
                  <button
                    type="button"
                    onClick={toggleFullscreenFocus}
                    className="ml-1 flex items-center gap-1 rounded-full bg-slate-700 px-2.5 py-1 text-white hover:bg-slate-600"
                    title="Odak Modundan Çık (Esc)"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>Çık</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PWA Uygulama Kurulum Butonu */}
          {installPrompt && !focusMode && (
            <button
              type="button"
              onClick={handleInstallPwa}
              className="absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-full bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xl hover:bg-blue-500"
            >
              <Download className="h-4 w-4" />
              Uygulama Olarak Kur (PWA)
            </button>
          )}
        </div>

        {!focusMode && toolbarDock === 'right' && <Toolbar />}
      </div>

      {/* Sürükle-Bırak Göstergesi */}
      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-950/80 backdrop-blur-xs">
          <div className="rounded-3xl border-2 border-dashed border-blue-400 bg-slate-900/90 px-10 py-8 text-center shadow-2xl">
            <p className="text-lg font-bold text-white">Dosyayı Buraya Bırakın</p>
            <p className="mt-1 text-xs text-blue-200">
              PDF (.pdf), Metin/Word (.txt, .md, .docx), Görsel veya Defter Yedeği (.json)
            </p>
          </div>
        </div>
      )}

      {/* Meşgul / İşlem Göstergesi */}
      {busyMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 shadow-2xl">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <span className="text-sm font-semibold text-white">{busyMessage}</span>
          </div>
        </div>
      )}

      {/* Bildirim Toast */}
      {toast && (
        <div className="pointer-events-none fixed top-16 right-4 z-50">
          <div
            className={`rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-2xl backdrop-blur-md ${
              toast.tone === 'error'
                ? 'border-rose-500/50 bg-rose-950/90 text-rose-100'
                : toast.tone === 'success'
                  ? 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100'
                  : 'border-blue-500/40 bg-slate-900/95 text-slate-100'
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
