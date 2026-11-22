import type {
  HighlighterPreset,
  PageBackground,
  PagePattern,
  PenPreset,
  PenTip,
  ShapeKind,
} from '../types/notebook';

export interface PageThemePreset {
  id: string;
  name: string;
  swatch: string;
  background: PageBackground;
}

export const PAGE_THEMES: PageThemePreset[] = [
  {
    id: 'blue-notebook',
    name: 'Mavi Defter',
    swatch: '#dbeafe',
    background: {
      color: '#dbeafe',
      pattern: 'lined',
      patternColor: '#60a5fa',
      patternOpacity: 0.45,
      spacing: 34,
      textColor: '#0f172a',
      textFontSize: 16,
    },
  },
  {
    id: 'deep-blue-notebook',
    name: 'Koyu Mavi Defter',
    swatch: '#1e3a5f',
    background: {
      color: '#1e3a5f',
      pattern: 'grid',
      patternColor: '#60a5fa',
      patternOpacity: 0.28,
      spacing: 32,
      textColor: '#f8fafc',
      textFontSize: 16,
    },
  },
  {
    id: 'classic-white',
    name: 'Klasik Beyaz',
    swatch: '#ffffff',
    background: {
      color: '#ffffff',
      pattern: 'lined',
      patternColor: '#94a3b8',
      patternOpacity: 0.4,
      spacing: 34,
      textColor: '#0f172a',
      textFontSize: 16,
    },
  },
  {
    id: 'warm-cream',
    name: 'Krem Defter',
    swatch: '#fef9e7',
    background: {
      color: '#fef9e7',
      pattern: 'lined',
      patternColor: '#d4a373',
      patternOpacity: 0.45,
      spacing: 34,
      textColor: '#292524',
      textFontSize: 16,
    },
  },
  {
    id: 'mint-green',
    name: 'Yeşil Defter',
    swatch: '#dcfce7',
    background: {
      color: '#dcfce7',
      pattern: 'grid',
      patternColor: '#4ade80',
      patternOpacity: 0.4,
      spacing: 30,
      textColor: '#14532d',
      textFontSize: 16,
    },
  },
  {
    id: 'lavender',
    name: 'Lavanta',
    swatch: '#ede9fe',
    background: {
      color: '#ede9fe',
      pattern: 'dotted',
      patternColor: '#8b5cf6',
      patternOpacity: 0.45,
      spacing: 28,
      textColor: '#1e1b4b',
      textFontSize: 16,
    },
  },
  {
    id: 'chalkboard',
    name: 'Yeşil Tahta',
    swatch: '#1b4332',
    background: {
      color: '#1b4332',
      pattern: 'blank',
      patternColor: '#74c69d',
      patternOpacity: 0.25,
      spacing: 32,
      textColor: '#f8fafc',
      textFontSize: 16,
    },
  },
  {
    id: 'midnight',
    name: 'Gece Modu',
    swatch: '#0f172a',
    background: {
      color: '#0f172a',
      pattern: 'dotted',
      patternColor: '#64748b',
      patternOpacity: 0.4,
      spacing: 30,
      textColor: '#f1f5f9',
      textFontSize: 16,
    },
  },
];

export const PAGE_PATTERNS: { id: PagePattern; label: string }[] = [
  { id: 'blank', label: 'Düz' },
  { id: 'lined', label: 'Çizgili' },
  { id: 'grid', label: 'Kareli' },
  { id: 'dotted', label: 'Noktalı' },
  { id: 'isometric', label: 'İzometrik' },
  { id: 'music', label: 'Porte' },
];

export const PAGE_SIZES = [
  { id: 'a4-portrait', label: 'A4 Dikey', width: 794, height: 1123 },
  { id: 'a4-landscape', label: 'A4 Yatay', width: 1123, height: 794 },
  { id: 'widescreen', label: '16:9 Tahta', width: 1280, height: 720 },
  { id: 'square', label: 'Kare', width: 920, height: 920 },
];

export const DEFAULT_PEN_PRESETS: PenPreset[] = [
  {
    id: 'pen-1',
    name: 'Siyah Kalem',
    color: '#0f172a',
    size: 3.5,
    opacity: 1,
    tip: 'ballpoint',
  },
  {
    id: 'pen-2',
    name: 'Lacivert Dolma',
    color: '#1d4ed8',
    size: 4.5,
    opacity: 1,
    tip: 'fountain',
  },
  {
    id: 'pen-3',
    name: 'Kırmızı İşaret',
    color: '#dc2626',
    size: 4,
    opacity: 1,
    tip: 'ballpoint',
  },
  {
    id: 'pen-4',
    name: 'Yeşil İnce',
    color: '#15803d',
    size: 3,
    opacity: 1,
    tip: 'pencil',
  },
  {
    id: 'pen-5',
    name: 'Turuncu Fırça',
    color: '#ea580c',
    size: 7.5,
    opacity: 0.95,
    tip: 'brush',
  },
  {
    id: 'pen-6',
    name: 'Beyaz Tebeşir',
    color: '#ffffff',
    size: 5,
    opacity: 0.95,
    tip: 'pencil',
  },
];

export const DEFAULT_HIGHLIGHTER_PRESETS: HighlighterPreset[] = [
  {
    id: 'hl-1',
    name: 'Sarı Fosfor',
    color: '#fde047',
    size: 24,
    opacity: 0.45,
    straightLine: false,
  },
  {
    id: 'hl-2',
    name: 'Yeşil Fosfor',
    color: '#86efac',
    size: 24,
    opacity: 0.45,
    straightLine: false,
  },
  {
    id: 'hl-3',
    name: 'Pembe Fosfor',
    color: '#f9a8d4',
    size: 24,
    opacity: 0.45,
    straightLine: false,
  },
  {
    id: 'hl-4',
    name: 'Mavi Fosfor',
    color: '#7dd3fc',
    size: 24,
    opacity: 0.45,
    straightLine: false,
  },
];

export const PEN_TIP_LABELS: { id: PenTip; label: string }[] = [
  { id: 'ballpoint', label: 'Tükenmez' },
  { id: 'fountain', label: 'Dolma / Kaligrafi' },
  { id: 'pencil', label: 'Kurşun Kalem' },
  { id: 'brush', label: 'Fırça' },
  { id: 'dashed', label: 'Kesik Çizgi' },
];

export const QUICK_COLORS = [
  '#0f172a',
  '#1e3a8a',
  '#1d4ed8',
  '#0284c7',
  '#0f766e',
  '#15803d',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#64748b',
  '#facc15',
  '#ffffff',
];

export const STICKY_COLORS = [
  '#fef08a',
  '#bbf7d0',
  '#bfdbfe',
  '#fbcfe8',
  '#fed7aa',
  '#e9d5ff',
];

export const SHAPE_CATALOG: { id: ShapeKind; label: string; group: 'basic' | 'math' }[] = [
  { id: 'line', label: 'Doğru', group: 'basic' },
  { id: 'dashed-line', label: 'Kesik Doğru', group: 'basic' },
  { id: 'arrow', label: 'Ok', group: 'basic' },
  { id: 'double-arrow', label: 'Çift Ok', group: 'basic' },
  { id: 'rect', label: 'Dikdörtgen', group: 'basic' },
  { id: 'rounded-rect', label: 'Yuvarlatılmış', group: 'basic' },
  { id: 'ellipse', label: 'Daire / Elips', group: 'basic' },
  { id: 'triangle', label: 'Üçgen', group: 'basic' },
  { id: 'right-triangle', label: 'Dik Üçgen', group: 'basic' },
  { id: 'pentagon', label: 'Beşgen', group: 'basic' },
  { id: 'hexagon', label: 'Altıgen', group: 'basic' },
  { id: 'star', label: 'Yıldız', group: 'basic' },
  { id: 'callout', label: 'Açıklama', group: 'basic' },
  { id: 'axes', label: 'Koordinat X-Y', group: 'math' },
  { id: 'number-line', label: 'Sayı Doğrusu', group: 'math' },
];

export function isDarkColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.48;
}
