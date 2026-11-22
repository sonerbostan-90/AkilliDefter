import type {
  BBox,
  CanvasElement,
  Point,
  RulerState,
  ShapeElement,
  StrokeElement,
} from '../types/notebook';

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function getElementBBox(el: CanvasElement): BBox {
  if (el.type === 'stroke') {
    if (el.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = Math.max(el.size / 2, 4);
    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(maxX - minX + pad * 2, 8),
      height: Math.max(maxY - minY + pad * 2, 8),
    };
  }
  if (el.type === 'shape' || el.type === 'region') {
    const minX = Math.min(el.x1, el.x2);
    const minY = Math.min(el.y1, el.y2);
    const maxX = Math.max(el.x1, el.x2);
    const maxY = Math.max(el.y1, el.y2);
    const pad = Math.max(el.strokeWidth / 2, 4);
    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(maxX - minX + pad * 2, 12),
      height: Math.max(maxY - minY + pad * 2, 12),
    };
  }
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export function mergeBBoxes(boxes: BBox[]): BBox | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function elementInLasso(el: CanvasElement, poly: { x: number; y: number }[]): boolean {
  if (el.type === 'stroke') {
    const step = Math.max(1, Math.floor(el.points.length / 25));
    for (let i = 0; i < el.points.length; i += step) {
      if (pointInPolygon(el.points[i].x, el.points[i].y, poly)) return true;
    }
    return false;
  }
  const box = getElementBBox(el);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (pointInPolygon(cx, cy, poly)) return true;
  if (pointInPolygon(box.x, box.y, poly)) return true;
  if (pointInPolygon(box.x + box.width, box.y + box.height, poly)) return true;
  return false;
}

export function hitTestElement(el: CanvasElement, x: number, y: number, radius = 10): boolean {
  if (el.type === 'stroke') {
    const thr = Math.max(radius, el.size * 0.75);
    if (el.points.length === 1) {
      return distance(x, y, el.points[0].x, el.points[0].y) <= thr;
    }
    for (let i = 1; i < el.points.length; i++) {
      const d = distanceToSegment(
        x,
        y,
        el.points[i - 1].x,
        el.points[i - 1].y,
        el.points[i].x,
        el.points[i].y
      );
      if (d <= thr) return true;
    }
    return false;
  }

  if (el.type === 'shape') {
    if (
      el.shapeKind === 'line' ||
      el.shapeKind === 'dashed-line' ||
      el.shapeKind === 'arrow' ||
      el.shapeKind === 'double-arrow' ||
      el.shapeKind === 'number-line'
    ) {
      return distanceToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= Math.max(radius, el.strokeWidth + 6);
    }
    const box = getElementBBox(el);
    return (
      x >= box.x - radius &&
      x <= box.x + box.width + radius &&
      y >= box.y - radius &&
      y <= box.y + box.height + radius
    );
  }

  const box = getElementBBox(el);
  return (
    x >= box.x - radius &&
    x <= box.x + box.width + radius &&
    y >= box.y - radius &&
    y <= box.y + box.height + radius
  );
}

/**
 * Kısmi silgi: bir çizgiyi silgi dairesine temas eden noktalardan böler.
 */
export function splitStrokeByEraser(
  stroke: StrokeElement,
  ex: number,
  ey: number,
  radius: number
): StrokeElement[] | null {
  const thr = radius + stroke.size * 0.4;
  let hitAny = false;
  const segments: Point[][] = [];
  let current: Point[] = [];

  for (let i = 0; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    const hit = distance(ex, ey, pt.x, pt.y) <= thr;
    if (hit) {
      hitAny = true;
      if (current.length >= 2) {
        segments.push(current);
      }
      current = [];
    } else {
      current.push(pt);
    }
  }
  if (current.length >= 2) {
    segments.push(current);
  }

  if (!hitAny) return null;
  return segments.map((pts) => ({
    ...stroke,
    id: uid('stroke'),
    points: pts,
  }));
}

export function translateElement(el: CanvasElement, dx: number, dy: number): CanvasElement {
  if (el.type === 'stroke') {
    return {
      ...el,
      points: el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    };
  }
  if (el.type === 'shape' || el.type === 'region') {
    return {
      ...el,
      x1: el.x1 + dx,
      y1: el.y1 + dy,
      x2: el.x2 + dx,
      y2: el.y2 + dy,
    };
  }
  return {
    ...el,
    x: el.x + dx,
    y: el.y + dy,
  };
}

export function scaleElement(el: CanvasElement, oldBox: BBox, newBox: BBox): CanvasElement {
  const sx = oldBox.width > 1 ? newBox.width / oldBox.width : 1;
  const sy = oldBox.height > 1 ? newBox.height / oldBox.height : 1;
  const mapX = (x: number) => newBox.x + (x - oldBox.x) * sx;
  const mapY = (y: number) => newBox.y + (y - oldBox.y) * sy;

  if (el.type === 'stroke') {
    return {
      ...el,
      points: el.points.map((p) => ({ ...p, x: mapX(p.x), y: mapY(p.y) })),
    };
  }
  if (el.type === 'shape' || el.type === 'region') {
    return {
      ...el,
      x1: mapX(el.x1),
      y1: mapY(el.y1),
      x2: mapX(el.x2),
      y2: mapY(el.y2),
    };
  }
  return {
    ...el,
    x: mapX(el.x),
    y: mapY(el.y),
    width: Math.max(24, el.width * sx),
    height: Math.max(24, el.height * sy),
  };
}

export function duplicateElement(el: CanvasElement, offset = 24): CanvasElement {
  const moved = translateElement(el, offset, offset);
  return { ...moved, id: uid(el.type) };
}

/**
 * Cetvel açıkken kenarına 26px yakınlıktaki kalem noktalarını cetvel üst kenarına yaslar.
 */
export function snapPointToRuler(pt: Point, ruler: RulerState): Point {
  if (!ruler.visible) return pt;
  const rad = (ruler.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfLen = ruler.length / 2;
  const halfH = 32; // cetvel yüksekliği 64px

  // Noktayı cetvelin yerel eksenine çevir
  const dx = pt.x - ruler.x;
  const dy = pt.y - ruler.y;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;

  if (localX < -halfLen - 16 || localX > halfLen + 16) return pt;

  // Üst kenar: localY = -halfH, alt kenar: localY = +halfH
  const distTop = Math.abs(localY + halfH);
  const distBottom = Math.abs(localY - halfH);

  let snappedLocalY = localY;
  if (distTop <= 26) {
    snappedLocalY = -halfH - 2;
  } else if (distBottom <= 26) {
    snappedLocalY = halfH + 2;
  } else {
    return pt;
  }

  const clampedX = Math.max(-halfLen, Math.min(halfLen, localX));
  return {
    x: ruler.x + clampedX * cos - snappedLocalY * sin,
    y: ruler.y + clampedX * sin + snappedLocalY * cos,
    pressure: pt.pressure,
  };
}

/**
 * Akıllı Şekil Düzeltme (Auto-Shape):
 * Serbest elle çizilen doğru, daire/elips, dikdörtgen veya üçgeni tanıyıp düzgün şekle çevirir.
 */
export function recognizeAutoShape(stroke: StrokeElement): ShapeElement | null {
  const pts = stroke.points;
  if (pts.length < 8) return null;

  const first = pts[0];
  const last = pts[pts.length - 1];
  let totalLen = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      totalLen += distance(pts[i - 1].x, pts[i - 1].y, p.x, p.y);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const diag = Math.hypot(width, height);
  if (totalLen < 40 || diag < 28) return null;

  const endDist = distance(first.x, first.y, last.x, last.y);

  // 1. Düz Doğru Algılama
  if (endDist > 30 && totalLen / endDist < 1.12) {
    let maxDev = 0;
    for (const p of pts) {
      const d = distanceToSegment(p.x, p.y, first.x, first.y, last.x, last.y);
      if (d > maxDev) maxDev = d;
    }
    if (maxDev < Math.max(14, endDist * 0.08)) {
      return {
        id: uid('shape'),
        type: 'shape',
        shapeKind: stroke.tip === 'dashed' ? 'dashed-line' : 'line',
        x1: first.x,
        y1: first.y,
        x2: last.x,
        y2: last.y,
        strokeColor: stroke.color,
        strokeWidth: Math.max(2, stroke.size),
        fillColor: 'transparent',
        fillOpacity: 0,
        dash: stroke.tip === 'dashed' ? 'dashed' : 'solid',
      };
    }
  }

  // Kapalı şekil kontrolü
  const isClosed = endDist < Math.max(45, diag * 0.28);
  if (!isClosed || width < 24 || height < 24) return null;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = width / 2;
  const ry = height / 2;

  // 2. Elips / Daire uygunluk skoru
  let ellipseErrSum = 0;
  let rectErrSum = 0;
  for (const p of pts) {
    const normDist = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
    ellipseErrSum += Math.abs(normDist - 1);

    const dLeft = Math.abs(p.x - minX);
    const dRight = Math.abs(p.x - maxX);
    const dTop = Math.abs(p.y - minY);
    const dBottom = Math.abs(p.y - maxY);
    rectErrSum += Math.min(dLeft, dRight, dTop, dBottom) / Math.max(rx, ry);
  }
  const ellipseErr = ellipseErrSum / pts.length;
  const rectErr = rectErrSum / pts.length;

  // 3. Üçgen kontrolü (en uzak 3 köşe veya düşük alan oranı)
  const expectedRectPerimeter = 2 * (width + height);
  const ratioRect = totalLen / expectedRectPerimeter;

  if (ellipseErr < 0.16 && ellipseErr < rectErr * 1.15) {
    // Çembere yakınsa tam çember yap
    let x1 = minX;
    let y1 = minY;
    let x2 = maxX;
    let y2 = maxY;
    if (Math.abs(width - height) / Math.max(width, height) < 0.16) {
      const avg = (width + height) / 2;
      x1 = cx - avg / 2;
      y1 = cy - avg / 2;
      x2 = cx + avg / 2;
      y2 = cy + avg / 2;
    }
    return {
      id: uid('shape'),
      type: 'shape',
      shapeKind: 'ellipse',
      x1,
      y1,
      x2,
      y2,
      strokeColor: stroke.color,
      strokeWidth: Math.max(2, stroke.size),
      fillColor: 'transparent',
      fillOpacity: 0,
      dash: stroke.tip === 'dashed' ? 'dashed' : 'solid',
    };
  }

  if (rectErr < 0.16 && ratioRect > 0.8 && ratioRect < 1.25) {
    return {
      id: uid('shape'),
      type: 'shape',
      shapeKind: 'rect',
      x1: minX,
      y1: minY,
      x2: maxX,
      y2: maxY,
      strokeColor: stroke.color,
      strokeWidth: Math.max(2, stroke.size),
      fillColor: 'transparent',
      fillOpacity: 0,
      dash: stroke.tip === 'dashed' ? 'dashed' : 'solid',
    };
  }

  // Üçgen: üstte tek tepe, altta geniş taban veya çevre oranı üçgene yakınsa
  if (ratioRect >= 0.62 && ratioRect <= 0.86) {
    return {
      id: uid('shape'),
      type: 'shape',
      shapeKind: 'triangle',
      x1: minX,
      y1: minY,
      x2: maxX,
      y2: maxY,
      strokeColor: stroke.color,
      strokeWidth: Math.max(2, stroke.size),
      fillColor: 'transparent',
      fillOpacity: 0,
      dash: stroke.tip === 'dashed' ? 'dashed' : 'solid',
    };
  }

  return null;
}
