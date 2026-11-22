import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  Download,
  FilePlus2,
  FileText,
  FileUp,
  FolderArchive,
  Image as ImageIcon,
  Palette,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { PAGE_PATTERNS, PAGE_SIZES, PAGE_THEMES } from '../constants/presets';
import { useNotebookStore } from '../store/useNotebookStore';
import {
  exportNotebookJson,
  exportNotebookToPdf,
  exportPageToPng,
  importNotebookJson,
} from '../utils/exporters';
import { importPdfFile, importTextOrDocxFile } from '../utils/importers';
import { PageThumb } from './PageThumb';

type TabKey = 'pages' | 'theme' | 'docs';

export function Sidebar() {
  const notebooks = useNotebookStore((s) => s.notebooks);
  const activeNotebookId = useNotebookStore((s) => s.activeNotebookId);
  const activePageId = useNotebookStore((s) => s.activePageId);

  const notebook = useMemo(
    () => notebooks.find((n) => n.id === activeNotebookId) ?? notebooks[0],
    [notebooks, activeNotebookId]
  );
  const activePage = useMemo(
    () => notebook?.pages.find((p) => p.id === activePageId) ?? notebook?.pages[0],
    [notebook, activePageId]
  );

  const createNotebook = useNotebookStore((s) => s.createNotebook);
  const selectNotebook = useNotebookStore((s) => s.selectNotebook);
  const renameNotebook = useNotebookStore((s) => s.renameNotebook);
  const deleteNotebook = useNotebookStore((s) => s.deleteNotebook);
  const importFullNotebook = useNotebookStore((s) => s.importFullNotebook);

  const selectPage = useNotebookStore((s) => s.selectPage);
  const addPage = useNotebookStore((s) => s.addPage);
  const insertPages = useNotebookStore((s) => s.insertPages);
  const duplicatePage = useNotebookStore((s) => s.duplicatePage);
  const deletePage = useNotebookStore((s) => s.deletePage);
  const movePage = useNotebookStore((s) => s.movePage);
  const updatePageBackground = useNotebookStore((s) => s.updatePageBackground);
  const setPageSize = useNotebookStore((s) => s.setPageSize);

  const setBusyMessage = useNotebookStore((s) => s.setBusyMessage);
  const showToast = useNotebookStore((s) => s.showToast);

  const [tab, setTab] = useState<TabKey>('pages');
  const [importAsNew, setImportAsNew] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  if (!notebook || !activePage) return null;

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setBusyMessage('PDF sayfaları hazırlanıyor...');
      const pages = await importPdfFile(file, (cur, total) =>
        setBusyMessage(`PDF işleniyor (${cur}/${total})...`)
      );
      insertPages(pages, importAsNew ? file.name.replace(/\.pdf$/i, '') : undefined);
      showToast(`${pages.length} PDF sayfası eklendi`, 'success');
      setTab('pages');
    } catch (err) {
      console.error(err);
      showToast('PDF dosyası okunamadı', 'error');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleTextImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setBusyMessage('Metin belgesi sayfalara yerleştiriliyor...');
      const pages = await importTextOrDocxFile(file, activePage.background);
      insertPages(
        pages,
        importAsNew ? file.name.replace(/\.(txt|md|docx)$/i, '') : undefined
      );
      showToast(`${pages.length} metin sayfası eklendi`, 'success');
      setTab('pages');
    } catch (err) {
      console.error(err);
      showToast('Metin belgesi okunamadı', 'error');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const nb = await importNotebookJson(file);
      importFullNotebook(nb);
    } catch {
      showToast('Yedek dosyası geçersiz', 'error');
    }
  };

  const handleExportPdf = async () => {
    try {
      setBusyMessage('PDF dışa aktarılıyor...');
      await exportNotebookToPdf(notebook, (cur, total) =>
        setBusyMessage(`PDF oluşturuluyor (${cur}/${total})...`)
      );
      showToast('PDF indirildi', 'success');
    } catch (err) {
      console.error(err);
      showToast('PDF dışa aktarılamadı', 'error');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleExportPng = async () => {
    try {
      setBusyMessage('PNG oluşturuluyor...');
      await exportPageToPng(activePage, `${notebook.title}_Sayfa`);
      showToast('Aktif sayfa PNG olarak indirildi', 'success');
    } catch {
      showToast('PNG dışa aktarılamadı', 'error');
    } finally {
      setBusyMessage(null);
    }
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 select-none">
      {/* Üst Defter Seçici */}
      <div className="border-b border-slate-800 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">Akıllı Defter</span>
          </div>
          <button
            type="button"
            onClick={() => createNotebook()}
            className="flex items-center gap-1 rounded-lg bg-blue-600/20 px-2 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/35"
            title="Yeni Defter Oluştur"
          >
            <Plus className="h-3.5 w-3.5" />
            Yeni
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={notebook.id}
            onChange={(e) => selectNotebook(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-medium text-slate-100 outline-none focus:border-blue-500"
          >
            {notebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>
                {nb.title} ({nb.pages.length} s.)
              </option>
            ))}
          </select>
          {notebooks.length > 1 && (
            <button
              type="button"
              onClick={() => deleteNotebook(notebook.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
              title="Defteri Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <input
          type="text"
          value={notebook.title}
          onChange={(e) => renameNotebook(notebook.id, e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-blue-500"
          placeholder="Defter adı..."
        />
      </div>

      {/* Sekmeler: Sayfalar / Arka Plan / Belge & Çıktı */}
      <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-900/50 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab('pages')}
          className={`flex items-center justify-center gap-1 rounded-lg py-1.5 transition ${
            tab === 'pages' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Sayfalar
        </button>
        <button
          type="button"
          onClick={() => setTab('theme')}
          className={`flex items-center justify-center gap-1 rounded-lg py-1.5 transition ${
            tab === 'theme' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          Arka Plan
        </button>
        <button
          type="button"
          onClick={() => setTab('docs')}
          className={`flex items-center justify-center gap-1 rounded-lg py-1.5 transition ${
            tab === 'docs' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileUp className="h-3.5 w-3.5" />
          PDF / İndir
        </button>
      </div>

      {/* SEKME İÇERİĞİ */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* 1. SAYFALAR SEKMESİ */}
        {tab === 'pages' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => addPage(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 active:scale-[0.98]"
            >
              <FilePlus2 className="h-4 w-4" />
              Yeni Boş Sayfa Ekle
            </button>

            <div className="space-y-2.5">
              {notebook.pages.map((p, index) => {
                const isActive = p.id === activePage.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => selectPage(p.id)}
                    className={`group flex cursor-pointer items-center gap-2.5 rounded-xl border p-2 transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-500/15 shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <PageThumb page={p} width={68} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">
                          Sayfa {index + 1}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {p.background.pdfImageDataUrl
                            ? 'PDF'
                            : p.background.textContent
                              ? 'Metin'
                              : 'Defter'}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-400">
                        {p.elements.length} çizim öğesi
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 flex items-center gap-1"
                      >
                        <button
                          type="button"
                          onClick={() => movePage(p.id, -1)}
                          disabled={index === 0}
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                          title="Yukarı Taşı"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePage(p.id, 1)}
                          disabled={index === notebook.pages.length - 1}
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                          title="Aşağı Taşı"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicatePage(p.id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                          title="Sayfayı Çoğalt"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {notebook.pages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deletePage(p.id)}
                            className="ml-auto rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
                            title="Sayfayı Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. ARKA PLAN & DEFTER TEMASI SEKMESİ */}
        {tab === 'theme' && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Hazır Defter Renkleri
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PAGE_THEMES.map((theme) => {
                  const selected =
                    activePage.background.color.toLowerCase() ===
                    theme.background.color.toLowerCase();
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => updatePageBackground(theme.background, false)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-medium transition ${
                        selected
                          ? 'border-blue-500 bg-blue-500/15 text-white'
                          : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: theme.swatch }}
                        className="h-6 w-6 shrink-0 rounded-lg border border-white/25 shadow-xs"
                      />
                      <span className="truncate">{theme.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Özel Renk Seçici */}
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Özel Renk Düzeni
              </div>
              <label className="flex items-center justify-between text-xs text-slate-200">
                <span>Sayfa Arka Plan Rengi</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">
                    {activePage.background.color}
                  </span>
                  <input
                    type="color"
                    value={activePage.background.color}
                    onChange={(e) =>
                      updatePageBackground({ color: e.target.value }, false)
                    }
                    className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"
                  />
                </div>
              </label>

              <label className="flex items-center justify-between text-xs text-slate-200">
                <span>Çizgi / Desen Rengi</span>
                <input
                  type="color"
                  value={activePage.background.patternColor}
                  onChange={(e) =>
                    updatePageBackground({ patternColor: e.target.value }, false)
                  }
                  className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"
                />
              </label>
            </div>

            {/* Sayfa Deseni */}
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Sayfa Şablonu
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PAGE_PATTERNS.map((pat) => (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => updatePageBackground({ pattern: pat.id }, false)}
                    className={`rounded-lg py-1.5 text-xs font-medium transition ${
                      activePage.background.pattern === pat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {pat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aralık & Opaklık */}
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Çizgi / Kare Aralığı</span>
                  <span>{activePage.background.spacing} px</span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={60}
                  value={activePage.background.spacing}
                  onChange={(e) =>
                    updatePageBackground({ spacing: Number(e.target.value) }, false)
                  }
                  className="mt-1 w-full accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Desen Opaklığı</span>
                  <span>{Math.round(activePage.background.patternOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={activePage.background.patternOpacity}
                  onChange={(e) =>
                    updatePageBackground({ patternOpacity: Number(e.target.value) }, false)
                  }
                  className="mt-1 w-full accent-blue-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                updatePageBackground(
                  {
                    color: activePage.background.color,
                    pattern: activePage.background.pattern,
                    patternColor: activePage.background.patternColor,
                    patternOpacity: activePage.background.patternOpacity,
                    spacing: activePage.background.spacing,
                  },
                  true
                );
                showToast('Arka plan düzeni tüm sayfalara uygulandı', 'success');
              }}
              className="w-full rounded-xl bg-blue-600/20 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-600/35"
            >
              Bu Düzeni Tüm Sayfalara Uygula
            </button>

            {/* Sayfa Boyutu */}
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Sayfa Boyutu
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PAGE_SIZES.map((sz) => {
                  const active =
                    activePage.width === sz.width && activePage.height === sz.height;
                  return (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setPageSize(sz.width, sz.height, false)}
                      className={`rounded-lg py-1.5 text-xs font-medium ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {sz.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. BELGE İÇE AKTARMA & DIŞA AKTARMA SEKMESİ */}
        {tab === 'docs' && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Belge Ekle (İçe Aktar)
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-800/80 px-2.5 py-2 text-xs text-slate-200">
                <span>Yeni defter olarak aç</span>
                <input
                  type="checkbox"
                  checked={importAsNew}
                  onChange={(e) => setImportAsNew(e.target.checked)}
                  className="h-4 w-4 accent-blue-500"
                />
              </label>

              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="flex w-full items-center gap-2.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-500"
              >
                <Upload className="h-4 w-4" />
                PDF Belgesi Ekle (.pdf)
              </button>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handlePdfImport}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => textInputRef.current?.click()}
                className="flex w-full items-center gap-2.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
              >
                <FileText className="h-4 w-4" />
                Metin / Word Ekle (.txt, .md, .docx)
              </button>
              <input
                ref={textInputRef}
                type="file"
                accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleTextImport}
                className="hidden"
              />

              <p className="text-[11px] leading-relaxed text-slate-400">
                İpucu: PDF, metin veya resim dosyalarını doğrudan tuvalin üzerine sürükleyip bırakabilirsiniz.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Dışa Aktar & Yedekle
              </div>

              <button
                type="button"
                onClick={handleExportPdf}
                className="flex w-full items-center gap-2.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <Download className="h-4 w-4" />
                Tüm Defteri PDF İndir
              </button>

              <button
                type="button"
                onClick={handleExportPng}
                className="flex w-full items-center gap-2.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <ImageIcon className="h-4 w-4 text-sky-400" />
                Aktif Sayfayı PNG İndir
              </button>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => exportNotebookJson(notebook)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  <FolderArchive className="h-3.5 w-3.5 text-amber-400" />
                  Yedek Al
                </button>
                <button
                  type="button"
                  onClick={() => jsonInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  <Upload className="h-3.5 w-3.5 text-blue-400" />
                  Yedek Yükle
                </button>
              </div>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,.akillidefter.json"
                onChange={handleJsonImport}
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
