import getStroke from 'perfect-freehand';
import { isDarkColor } from '../constants/presets';
import type {
  CanvasElement,
  ImageElement,
  NotebookPage,
  PageBackground,
  RegionElement,
  ShapeElement,
  StrokeElement,
  TextElement,
} from '../types/notebook';

const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(dataUrl: string, onLoad?: () => void): HTMLImageElement | null {
  const existing = imageCache.get(dataUrl);
  if (existing) {
    if (existing.complete && existing.naturalWidth > 0) return existing;
    if (onLoad) existing.addEventListener('load', onLoad, { once: true });
    return null;
  }
  const img = new Image();
  img.src = dataUrl;
  imageCache.set(dataUrl, img);
  if (onLoad) {
    img.addEventListener('load', onLoad, { once: true });
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export async function loadImageAsync(dataUrl: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(dataUrl);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(dataUrl, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function getSvgPathFromStroke(stroke: number[][]): Path2D {
  const path = new Path2D();
  if (!stroke.length) return path;
  const first = stroke[0];
  path.moveTo(first[0], first[1]);
  for (let i = 0; i < stroke.length; i++) {
    const curr = stroke[i];
    const next = stroke[(i + 1) % stroke.length];
    const midX = (curr[0] + next[0]) / 2;
    const midY = (curr[1] + next[1]) / 2;
    path.quadraticCurveTo(curr[0], curr[1], midX, midY);
  }
  path.closePath();
  return path;
}

export function drawPageBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bg: PageBackground,
  onImageReady?: () => void
): void {
  ctx.save();
  ctx.fillStyle = bg.color || '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Arka plan PDF veya resim varsa çiz
  const bgDataUrl = bg.pdfImageDataUrl || bg.backgroundImageDataUrl;
  if (bgDataUrl) {
    const img = getCachedImage(bgDataUrl, onImageReady);
    if (img) {
      // Oranı koruyarak sayfaya sığdır
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const pageAspect = width / height;
      let dw = width;
      let dh = height;
      let dx = 0;
      let dy = 0;
      if (imgAspect > pageAspect) {
        dh = width / imgAspect;
        dy = (height - dh) / 2;
      } else {
        dw = height * imgAspect;
        dx = (width - dw) / 2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  } else {
    // Sayfa deseni çiz
    drawPattern(ctx, width, height, bg);
  }

  // Metin belgesi içeriği varsa okunaklı biçimde sayfaya yaz
  if (bg.textContent) {
    drawDocumentText(ctx, width, height, bg);
  }

  ctx.restore();
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bg: PageBackground
): void {
  if (bg.pattern === 'blank') return;
  const spacing = Math.max(16, bg.spacing || 32);
  ctx.save();
  ctx.strokeStyle = bg.patternColor || '#60a5fa';
  ctx.fillStyle = bg.patternColor || '#60a5fa';
  ctx.globalAlpha = bg.patternOpacity ?? 0.4;
  ctx.lineWidth = 1;

  if (bg.pattern === 'lined') {
    // Klasik sol kenar kırmızı/vurgulu marj çizgisi
    const marginX = 72;
    ctx.beginPath();
    for (let y = spacing * 2; y < height - spacing; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = isDarkColor(bg.color) ? '#f87171' : '#ef4444';
    ctx.globalAlpha = Math.min(0.45, (bg.patternOpacity ?? 0.4) * 0.9);
    ctx.moveTo(marginX, 0);
    ctx.lineTo(marginX, height);
    ctx.stroke();
  } else if (bg.pattern === 'grid') {
    ctx.beginPath();
    for (let x = spacing; x < width; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = spacing; y < height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  } else if (bg.pattern === 'dotted') {
    const r = 1.4;
    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (bg.pattern === 'isometric') {
    const stepX = spacing;
    const stepY = spacing * Math.sin(Math.PI / 3);
    ctx.beginPath();
    for (let x = -height; x < width + height; x += stepX) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height / Math.tan(Math.PI / 3), height);
      ctx.moveTo(x, 0);
      ctx.lineTo(x - height / Math.tan(Math.PI / 3), height);
    }
    for (let y = 0; y < height; y += stepY) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  } else if (bg.pattern === 'music') {
    const lineGap = 11;
    const staffGap = 108;
    ctx.beginPath();
    for (let top = 72; top < height - 70; top += staffGap) {
      for (let i = 0; i < 5; i++) {
        const y = top + i * lineGap;
        ctx.moveTo(48, y);
        ctx.lineTo(width - 48, y);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawDocumentText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bg: PageBackground
): void {
  const text = bg.textContent || '';
  const fontSize = bg.textFontSize || 16;
  const lineHeight = fontSize * 1.65;
  const padX = 56;
  const padY = 56;
  const maxW = width - padX * 2;

  ctx.save();
  ctx.fillStyle = bg.textColor || (isDarkColor(bg.color) ? '#f8fafc' : '#0f172a');
  ctx.font = `400 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'top';

  const paragraphs = text.split('\n');
  let y = padY;

  for (const para of paragraphs) {
    if (y > height - padY) break;
    if (para.trim() === '') {
      y += lineHeight * 0.7;
      continue;
    }
    // Markdown başlık kontrolü
    let lineText = para;
    if (para.startsWith('# ')) {
      ctx.font = `700 ${fontSize + 6}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      lineText = para.slice(2);
    } else if (para.startsWith('## ')) {
      ctx.font = `700 ${fontSize + 3}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      lineText = para.slice(3);
    } else {
      ctx.font = `400 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    }

    const words = lineText.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxW && current) {
        ctx.fillText(current, padX, y);
        y += lineHeight;
        current = word;
        if (y > height - padY) break;
      } else {
        current = test;
      }
    }
    if (current && y <= height - padY) {
      ctx.fillText(current, padX, y);
      y += lineHeight;
    }
  }
  ctx.restore();
}

export function drawStrokeElement(
  ctx: CanvasRenderingContext2D,
  el: StrokeElement,
  pageBgColor: string
): void {
  if (el.points.length === 0) return;
  ctx.save();

  if (el.isHighlighter) {
    ctx.globalCompositeOperation = isDarkColor(pageBgColor) ? 'screen' : 'multiply';
    ctx.globalAlpha = el.opacity;
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i].x, el.points[i].y);
    }
    if (el.points.length === 1) {
      ctx.lineTo(el.points[0].x + 0.1, el.points[0].y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.tip === 'dashed') {
    ctx.globalAlpha = el.opacity;
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([el.size * 2.4, el.size * 2.1]);
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i].x, el.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const inputPts = el.points.map((p) => [p.x, p.y, p.pressure]);
  const optionsByTip = {
    ballpoint: {
      size: el.size,
      thinning: 0.22,
      smoothing: 0.55,
      streamline: 0.45,
      simulatePressure: false,
    },
    fountain: {
      size: el.size * 1.25,
      thinning: 0.72,
      smoothing: 0.65,
      streamline: 0.55,
      simulatePressure: false,
    },
    pencil: {
      size: el.size * 0.95,
      thinning: 0.35,
      smoothing: 0.3,
      streamline: 0.25,
      simulatePressure: false,
    },
    brush: {
      size: el.size * 1.6,
      thinning: 0.65,
      smoothing: 0.75,
      streamline: 0.6,
      simulatePressure: false,
    },
  };

  const opts = optionsByTip[el.tip];
  const hasRealPressure = el.points.some((p) => p.pressure !== 0.5 && p.pressure > 0);
  const outline = getStroke(inputPts, {
    ...opts,
    simulatePressure: !hasRealPressure,
  });

  const path = getSvgPathFromStroke(outline);
  ctx.fillStyle = el.color;
  ctx.globalAlpha = el.tip === 'pencil' ? el.opacity * 0.82 : el.opacity;
  if (el.tip === 'brush') {
    ctx.shadowColor = el.color;
    ctx.shadowBlur = 1.5;
  }
  ctx.fill(path);
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = Math.max(12, size * 3.5);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function drawPolygonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number
) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawShapeElement(ctx: CanvasRenderingContext2D, el: ShapeElement): void {
  ctx.save();
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (el.dash === 'dashed' || el.shapeKind === 'dashed-line') {
    ctx.setLineDash([el.strokeWidth * 3 + 4, el.strokeWidth * 2 + 4]);
  } else if (el.dash === 'dotted') {
    ctx.setLineDash([el.strokeWidth, el.strokeWidth * 2.5]);
  }

  const minX = Math.min(el.x1, el.x2);
  const minY = Math.min(el.y1, el.y2);
  const w = Math.abs(el.x2 - el.x1);
  const h = Math.abs(el.y2 - el.y1);
  const cx = minX + w / 2;
  const cy = minY + h / 2;

  const fillIfNeeded = () => {
    if (el.fillColor && el.fillColor !== 'transparent' && el.fillOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = el.fillOpacity;
      ctx.fillStyle = el.fillColor;
      ctx.fill();
      ctx.restore();
    }
  };

  switch (el.shapeKind) {
    case 'line':
    case 'dashed-line': {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrowHead(ctx, el.x1, el.y1, el.x2, el.y2, el.strokeWidth);
      break;
    }
    case 'double-arrow': {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrowHead(ctx, el.x1, el.y1, el.x2, el.y2, el.strokeWidth);
      drawArrowHead(ctx, el.x2, el.y2, el.x1, el.y1, el.strokeWidth);
      break;
    }
    case 'rect': {
      ctx.beginPath();
      ctx.rect(minX, minY, w, h);
      fillIfNeeded();
      ctx.stroke();
      break;
    }
    case 'rounded-rect': {
      const r = Math.min(18, w / 4, h / 4);
      ctx.beginPath();
      ctx.roundRect(minX, minY, w, h, r);
      fillIfNeeded();
      ctx.stroke();
      break;
    }
    case 'ellipse': {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
      fillIfNeeded();
      ctx.stroke();
      break;
    }
    case 'triangle': {
      ctx.beginPath();
      ctx.moveTo(cx, minY);
      ctx.lineTo(minX + w, minY + h);
      ctx.lineTo(minX, minY + h);
      ctx.closePath();
      fillIfNeeded();
      ctx.stroke();
      break;
    }
    case 'right-triangle': {
      ctx.beginPath();
      ctx.moveTo(minX, minY);
      ctx.lineTo(minX, minY + h);
      ctx.lineTo(minX + w, minY + h);
      ctx.closePath();
      fillIfNeeded();
      ctx.stroke();
      // Dik açı işareti
      const sq = Math.min(18, w * 0.25, h * 0.25);
      if (sq > 5) {
        ctx.beginPath();
        ctx.moveTo(minX, minY + h - sq);
        ctx.lineTo(minX + sq, minY + h - sq);
        ctx.lineTo(minX + sq, minY + h);
        ctx.stroke();
      }
      break;
    }
    case 'pentagon': {
      drawPolygonPath(ctx, cx, cy, w / 2, h / 2, 5);
      fillIfNeeded();
      ctx.stroke();
      break;
    }
    case 'hexagon': {
      drawPolygonPath(ctx, cx, cy, w / 2, h / 2, 6);
      fillIfNeeded();
      ctx.stroke();
      break;
    }
    case 'star': {
      ctx.beginPath();
      const spikes = 5;
      for (let i = 0; i < spikes * 2; i++) {
        const radiusX = i % 2 === 0 ? w / 2 : w * 0.22;
        const radiusY = i % 2 === 0 ? h / 2 : h * 0.22;
        const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
        const x = cx + radiusX * Math.cos(angle);
        const y = cy + radiusY * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      fillIfNeeded();
      ctx.stroke();
      break;
    }
    case 'callout': {
      const r = Math.min(16, w / 5, h / 5);
      const boxH = Math.max(24, h * 0.78);
      ctx.beginPath();
      ctx.moveTo(minX + r, minY);
      ctx.lineTo(minX + w - r, minY);
      ctx.quadraticCurveTo(minX + w, minY, minX + w, minY + r);
      ctx.lineTo(minX + w, minY + boxH - r);
      ctx.quadraticCurveTo(minX + w, minY + boxH, minX + w - r, minY + boxH);
      ctx.lineTo(minX + w * 0.42, minY + boxH);
      ctx.lineTo(minX + w * 0.18, minY + h);
      ctx.lineTo(minX + w * 0.26, minY + boxH);
      ctx.lineTo(minX + r, minY + boxH);
      ctx.quadraticCurveTo(minX, minY + boxH, minX, minY + boxH - r);
      ctx.lineTo(minX, minY + r);
      ctx.quadraticCurveTo(minX, minY, minX + r, minY);
      ctx.closePath();
      fillIfNeeded();
      ctx.stroke();
      break;
    }
    case 'axes': {
      // İnce arka plan ızgarası
      const step = Math.max(20, Math.round(Math.min(w, h) / 10));
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = cx; x <= minX + w; x += step) {
        ctx.moveTo(x, minY);
        ctx.lineTo(x, minY + h);
      }
      for (let x = cx - step; x >= minX; x -= step) {
        ctx.moveTo(x, minY);
        ctx.lineTo(x, minY + h);
      }
      for (let y = cy; y <= minY + h; y += step) {
        ctx.moveTo(minX, y);
        ctx.lineTo(minX + w, y);
      }
      for (let y = cy - step; y >= minY; y -= step) {
        ctx.moveTo(minX, y);
        ctx.lineTo(minX + w, y);
      }
      ctx.stroke();
      ctx.restore();

      // Ana X ve Y eksenleri
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(minX, cy);
      ctx.lineTo(minX + w, cy);
      ctx.moveTo(cx, minY + h);
      ctx.lineTo(cx, minY);
      ctx.stroke();

      drawArrowHead(ctx, minX, cy, minX + w, cy, el.strokeWidth);
      drawArrowHead(ctx, cx, minY + h, cx, minY, el.strokeWidth);

      // Çentikler
      ctx.beginPath();
      for (let x = cx + step; x < minX + w - 10; x += step) {
        ctx.moveTo(x, cy - 4);
        ctx.lineTo(x, cy + 4);
      }
      for (let x = cx - step; x > minX + 10; x -= step) {
        ctx.moveTo(x, cy - 4);
        ctx.lineTo(x, cy + 4);
      }
      for (let y = cy + step; y < minY + h - 10; y += step) {
        ctx.moveTo(cx - 4, y);
        ctx.lineTo(cx + 4, y);
      }
      for (let y = cy - step; y > minY + 10; y -= step) {
        ctx.moveTo(cx - 4, y);
        ctx.lineTo(cx + 4, y);
      }
      ctx.stroke();

      ctx.fillStyle = el.strokeColor;
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('x', minX + w - 12, cy + 16);
      ctx.fillText('y', cx + 10, minY + 14);
      ctx.fillText('0', cx + 6, cy + 15);
      break;
    }
    case 'number-line': {
      const midY = (el.y1 + el.y2) / 2;
      const leftX = Math.min(el.x1, el.x2);
      const rightX = Math.max(el.x1, el.x2);
      const len = rightX - leftX;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(leftX, midY);
      ctx.lineTo(rightX, midY);
      ctx.stroke();
      drawArrowHead(ctx, leftX, midY, rightX, midY, el.strokeWidth);
      drawArrowHead(ctx, rightX, midY, leftX, midY, el.strokeWidth);

      const ticks = Math.max(4, Math.min(12, Math.floor(len / 44)));
      const usable = len - 40;
      const step = usable / ticks;
      const half = Math.floor(ticks / 2);
      ctx.fillStyle = el.strokeColor;
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i <= ticks; i++) {
        const tx = leftX + 20 + i * step;
        ctx.beginPath();
        ctx.moveTo(tx, midY - 7);
        ctx.lineTo(tx, midY + 7);
        ctx.stroke();
        ctx.fillText(String(i - half), tx, midY + 22);
      }
      break;
    }
  }

  ctx.restore();
}

export function drawRegionElement(ctx: CanvasRenderingContext2D, el: RegionElement): void {
  const minX = Math.min(el.x1, el.x2);
  const minY = Math.min(el.y1, el.y2);
  const w = Math.abs(el.x2 - el.x1);
  const h = Math.abs(el.y2 - el.y1);
  if (w < 4 || h < 4) return;

  ctx.save();
  ctx.beginPath();
  if (el.regionKind === 'ellipse') {
    ctx.ellipse(minX + w / 2, minY + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.roundRect(minX, minY, w, h, el.regionKind === 'highlight-area' ? 8 : 12);
  }

  ctx.save();
  ctx.fillStyle = el.fillColor;
  ctx.globalAlpha = el.fillOpacity;
  ctx.fill();
  ctx.restore();

  if (el.regionKind !== 'highlight-area') {
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = Math.max(1.5, el.strokeWidth * 0.7);
    ctx.stroke();
  }

  // Numaralı bölge rozeti
  if (el.badge) {
    const bx = minX + 12;
    const by = minY - 2;
    ctx.fillStyle = el.strokeColor;
    ctx.beginPath();
    ctx.arc(bx, by, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.badge, bx, by + 0.5);
  }
  ctx.restore();
}

export function drawTextElement(ctx: CanvasRenderingContext2D, el: TextElement): void {
  ctx.save();
  if (el.isSticky) {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = el.backgroundColor || '#fef08a';
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.width, el.height, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (el.backgroundColor && el.backgroundColor !== 'transparent') {
    ctx.fillStyle = el.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.width, el.height, 6);
    ctx.fill();
  }

  const pad = el.isSticky ? 14 : 6;
  ctx.fillStyle = el.color;
  ctx.font = `${el.fontWeight} ${el.fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'top';

  const maxW = Math.max(20, el.width - pad * 2);
  const lineH = el.fontSize * 1.4;
  const paragraphs = el.text.split('\n');
  let y = el.y + pad;

  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, el.x + pad, y);
        y += lineH;
        line = word;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, el.x + pad, y);
    y += lineH;
  }

  ctx.restore();
}

export function drawImageElement(
  ctx: CanvasRenderingContext2D,
  el: ImageElement,
  onImageReady?: () => void
): void {
  const img = getCachedImage(el.dataUrl, onImageReady);
  ctx.save();
  if (img) {
    ctx.drawImage(img, el.x, el.y, el.width, el.height);
  } else {
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fillRect(el.x, el.y, el.width, el.height);
  }
  ctx.restore();
}

export function drawCanvasElement(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  pageBgColor: string,
  onImageReady?: () => void
): void {
  switch (el.type) {
    case 'stroke':
      drawStrokeElement(ctx, el, pageBgColor);
      break;
    case 'shape':
      drawShapeElement(ctx, el);
      break;
    case 'region':
      drawRegionElement(ctx, el);
      break;
    case 'text':
      drawTextElement(ctx, el);
      break;
    case 'image':
      drawImageElement(ctx, el, onImageReady);
      break;
  }
}

export function renderFullPage(
  ctx: CanvasRenderingContext2D,
  page: NotebookPage,
  onImageReady?: () => void
): void {
  drawPageBackground(ctx, page.width, page.height, page.background, onImageReady);
  for (const el of page.elements) {
    drawCanvasElement(ctx, el, page.background.color, onImageReady);
  }
}

/**
 * Dışa aktarma için tüm gömülü görsellerin yüklenmesini bekleyip sayfayı eksiksiz çizer.
 */
export async function renderPageToOffscreenCanvas(
  page: NotebookPage,
  scale = 2
): Promise<HTMLCanvasElement> {
  const urls: string[] = [];
  if (page.background.pdfImageDataUrl) urls.push(page.background.pdfImageDataUrl);
  if (page.background.backgroundImageDataUrl) urls.push(page.background.backgroundImageDataUrl);
  for (const el of page.elements) {
    if (el.type === 'image') urls.push(el.dataUrl);
  }
  await Promise.all(urls.map((u) => loadImageAsync(u).catch(() => null)));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(page.width * scale);
  canvas.height = Math.round(page.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  renderFullPage(ctx, page);
  return canvas;
}
