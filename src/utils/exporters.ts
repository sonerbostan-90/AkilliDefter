import { PDFDocument } from 'pdf-lib';
import type { Notebook, NotebookPage } from '../types/notebook';
import { renderPageToOffscreenCanvas } from './renderer';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Akilli_Defter';
}

export async function exportNotebookToPdf(
  notebook: Notebook,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(notebook.title);
  pdfDoc.setCreator('Akıllı Defter PWA');

  for (let i = 0; i < notebook.pages.length; i++) {
    onProgress?.(i + 1, notebook.pages.length);
    const page = notebook.pages[i];
    const canvas = await renderPageToOffscreenCanvas(page, 2);
    const pngDataUrl = canvas.toDataURL('image/png');
    const pngBytes = await fetch(pngDataUrl).then((r) => r.arrayBuffer());
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // 72 DPI PDF noktalarına ölçekle (1px ≈ 0.75pt)
    const ptW = page.width * 0.75;
    const ptH = page.height * 0.75;
    const pdfPage = pdfDoc.addPage([ptW, ptH]);
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: ptW,
      height: ptH,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  triggerDownload(blob, `${sanitizeName(notebook.title)}.pdf`);
}

export async function exportPageToPng(page: NotebookPage, title: string): Promise<void> {
  const canvas = await renderPageToOffscreenCanvas(page, 2);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  triggerDownload(blob, `${sanitizeName(title)}.png`);
}

export function exportNotebookJson(notebook: Notebook): void {
  const json = JSON.stringify(notebook, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, `${sanitizeName(notebook.title)}.akillidefter.json`);
}

export async function importNotebookJson(file: File): Promise<Notebook> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Notebook;
  if (!parsed || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error('Geçersiz defter yedek dosyası.');
  }
  return {
    ...parsed,
    updatedAt: Date.now(),
  };
}
