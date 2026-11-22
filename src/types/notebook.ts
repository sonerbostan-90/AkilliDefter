export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export type PenTip = 'ballpoint' | 'fountain' | 'pencil' | 'brush' | 'dashed';

export interface PenPreset {
  id: string;
  name: string;
  color: string;
  size: number;
  opacity: number;
  tip: PenTip;
}

export interface HighlighterPreset {
  id: string;
  name: string;
  color: string;
  size: number;
  opacity: number;
  straightLine: boolean;
}

export type ShapeKind =
  | 'line'
  | 'dashed-line'
  | 'arrow'
  | 'double-arrow'
  | 'rect'
  | 'rounded-rect'
  | 'ellipse'
  | 'triangle'
  | 'right-triangle'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'axes'
  | 'number-line'
  | 'callout';

export type RegionKind = 'box' | 'ellipse' | 'highlight-area';

export type ToolType =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'shape'
  | 'region'
  | 'laser'
  | 'lasso'
  | 'text'
  | 'sticky'
  | 'pan';

export type EraserMode = 'stroke' | 'partial';

export type PagePattern = 'blank' | 'lined' | 'grid' | 'dotted' | 'isometric' | 'music';

export type DashStyle = 'solid' | 'dashed' | 'dotted';

export type ToolbarDock = 'top' | 'left' | 'right';

export interface PageBackground {
  color: string;
  pattern: PagePattern;
  patternColor: string;
  patternOpacity: number;
  spacing: number;
  pdfImageDataUrl?: string;
  backgroundImageDataUrl?: string;
  textContent?: string;
  textColor?: string;
  textFontSize?: number;
}

export interface StrokeElement {
  id: string;
  type: 'stroke';
  isHighlighter?: boolean;
  tip: PenTip;
  color: string;
  size: number;
  opacity: number;
  points: Point[];
}

export interface ShapeElement {
  id: string;
  type: 'shape';
  shapeKind: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  dash: DashStyle;
  label?: string;
}

export interface RegionElement {
  id: string;
  type: 'region';
  regionKind: RegionKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  fillColor: string;
  fillOpacity: number;
  strokeWidth: number;
  badge?: string;
}

export interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  backgroundColor?: string;
  isSticky?: boolean;
}

export interface ImageElement {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
}

export type CanvasElement =
  | StrokeElement
  | ShapeElement
  | RegionElement
  | TextElement
  | ImageElement;

export interface NotebookPage {
  id: string;
  title?: string;
  width: number;
  height: number;
  background: PageBackground;
  elements: CanvasElement[];
}

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  defaultBackground: PageBackground;
  pages: NotebookPage[];
}

export interface RulerState {
  visible: boolean;
  x: number;
  y: number;
  angle: number; // degrees
  length: number;
}

export interface ProtractorState {
  visible: boolean;
  x: number;
  y: number;
  angle: number; // degrees
  radius: number;
}

export interface SpotlightState {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: 'rect' | 'ellipse';
  dimOpacity: number;
}

export interface ShapeSettings {
  shapeKind: ShapeKind;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  dash: DashStyle;
}

export interface RegionSettings {
  regionKind: RegionKind;
  strokeColor: string;
  fillColor: string;
  fillOpacity: number;
  strokeWidth: number;
  autoNumberBadge: boolean;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
