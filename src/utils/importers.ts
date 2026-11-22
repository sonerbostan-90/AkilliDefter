import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import type { NotebookPage, PageBackground } from '../types/notebook';
import { uid } from './geometry';

// Vite ile yerel PDF.js worker tanımı (çevrimdışı PWA uyumlu)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function importPdfFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<NotebookPage[]> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages: NotebookPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(i, pdf.numPages);
    const pdfPage = await pdf.getPage(i);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    // Standart ekranda rahat çizim boyutu (~900px genişlik)
    const targetWidth = 900;
    const displayScale = targetWidth / baseViewport.width;
    const width = Math.round(baseViewport.width * displayScale);
    const height = Math.round(baseViewport.height * displayScale);

    // Keskin metinler için 2x render
    const renderViewport = pdfPage.getViewport({ scale: displayScale * 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(renderViewport.width);
    canvas.height = Math.round(renderViewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await pdfPage.render({
      canvasContext: ctx,
      viewport: renderViewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    pages.push({
      id: uid('page'),
      title: `${file.name} - Sayfa ${i}`,
      width,
      height,
      background: {
        color: '#ffffff',
        pattern: 'blank',
        patternColor: '#94a3b8',
        patternOpacity: 0,
        spacing: 32,
        pdfImageDataUrl: dataUrl,
      },
      elements: [],
    });
  }

  return pages;
}

/**
 * .txt, .md veya .docx metin belgesini seçili defter arka planıyla sayfalara böler.
 */
export async function importTextOrDocxFile(
  file: File,
  baseBackground: PageBackground
): Promise<NotebookPage[]> {
  let rawText = '';
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buffer });
    rawText = res.value || '';
  } else {
    rawText = await file.text();
  }

  rawText = rawText.replace(/\r\n/g, '\n').trim();
  if (!rawText) rawText = '(Boş belge)';

  // A4 sayfa başına ~36 satır olacak şekilde sayfalara böl
  const maxCharsPerLine = 68;
  const maxLinesPerPage = 34;
  const visualLines: string[] = [];

  for (const para of rawText.split('\n')) {
    if (para.trim() === '') {
      visualLines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxCharsPerLine && line) {
        visualLines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) visualLines.push(line);
  }

  const pages: NotebookPage[] = [];
  for (let i = 0; i < visualLines.length; i += maxLinesPerPage) {
    const chunk = visualLines.slice(i, i + maxLinesPerPage).join('\n');
    const pageNum = Math.floor(i / maxLinesPerPage) + 1;
    pages.push({
      id: uid('page'),
      title: `${file.name} - Sayfa ${pageNum}`,
      width: 794,
      height: 1123,
      background: {
        ...baseBackground,
        pdfImageDataUrl: undefined,
        backgroundImageDataUrl: undefined,
        textContent: chunk,
      },
      elements: [],
    });
  }

  return pages;
}

export async function readImageFile(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 320, height: 240 });
    img.src = dataUrl;
  });

  return { dataUrl, ...dims };
}
