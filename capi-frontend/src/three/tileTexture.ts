import type { Currency, Tile, TileGroup } from 'capi-core';
import { icons } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { CanvasTexture, Color, SRGBColorSpace } from 'three';

export type IconNode = [string, Record<string, string>][];

const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = imageCache.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`cannot load ${url}`));
      img.src = url;
    });
    imageCache.set(url, pending);
  }
  return pending;
}

const iconCache = new Map<string, Promise<IconNode | null>>();
type IconModule = { __iconNode?: IconNode };
type IconComponent = { render?: (props: object, ref: null) => { props?: { iconNode?: IconNode } } | null };
const iconComponents = icons as unknown as Record<string, IconComponent | undefined>;
const iconImports = dynamicIconImports as unknown as Record<string, (() => Promise<IconModule>) | undefined>;

const toKebab = (name: string) =>
  name
    .replace(/([a-z])([A-Z0-9])/g, '$1-$2')
    .replace(/([0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

function iconNodeSync(name: string): IconNode | null {
  try {
    const element = iconComponents[name]?.render?.({}, null);
    return element?.props?.iconNode ?? null;
  } catch {
    return null;
  }
}

export function loadIconNode(name: string): Promise<IconNode | null> {
  let pending = iconCache.get(name);
  if (!pending) {
    const sync = iconNodeSync(name);
    const importer = iconImports[toKebab(name)];
    pending = sync
      ? Promise.resolve(sync)
      : importer
        ? importer()
            .then((m) => m.__iconNode ?? null)
            .catch((e: unknown) => {
              console.warn(`[scene] icon ${name} failed to load`, e);
              return null;
            })
        : Promise.resolve(null);
    if (!sync && !importer) console.warn(`[scene] unknown icon ${name}`);
    iconCache.set(name, pending);
  }
  return pending;
}

const num = (attrs: Record<string, string>, key: string) => Number(attrs[key] ?? 0);

export function drawIconNode(ctx: CanvasRenderingContext2D, node: IconNode, cx: number, cy: number, size: number, color: string): void {
  const scale = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [tag, attrs] of node) {
    switch (tag) {
      case 'path':
        ctx.stroke(new Path2D(attrs['d'] ?? ''));
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(num(attrs, 'cx'), num(attrs, 'cy'), num(attrs, 'r'), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(num(attrs, 'cx'), num(attrs, 'cy'), num(attrs, 'rx'), num(attrs, 'ry'), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'rect': {
        ctx.beginPath();
        ctx.roundRect(num(attrs, 'x'), num(attrs, 'y'), num(attrs, 'width'), num(attrs, 'height'), num(attrs, 'rx'));
        ctx.stroke();
        break;
      }
      case 'line':
        ctx.beginPath();
        ctx.moveTo(num(attrs, 'x1'), num(attrs, 'y1'));
        ctx.lineTo(num(attrs, 'x2'), num(attrs, 'y2'));
        ctx.stroke();
        break;
      case 'polyline':
      case 'polygon': {
        const pts = (attrs['points'] ?? '').trim().split(/[\s,]+/).map(Number);
        ctx.beginPath();
        for (let i = 0; i + 1 < pts.length; i += 2) {
          if (i === 0) ctx.moveTo(pts[i]!, pts[i + 1]!);
          else ctx.lineTo(pts[i]!, pts[i + 1]!);
        }
        if (tag === 'polygon') ctx.closePath();
        ctx.stroke();
        break;
      }
    }
  }
  ctx.restore();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function roundedImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

const mixHex = (a: string, b: string, t: number) => `#${new Color(a).lerp(new Color(b), t).getHexString()}`;
const lighten = (hex: string, t: number) => mixHex(hex, '#ffffff', t);

export interface TileDrawSpec {
  tile: Tile;
  group: TileGroup | undefined;
  currency: Currency;
  corner: boolean;
  accent: string;
  image: HTMLImageElement | null;
  groupImage: HTMLImageElement | null;
  icon: IconNode | null;
  ownerColor: string | null;

  monopoly: boolean;
  mortgaged: boolean;
  rentLabel: string | null;

  notes: string[];
}

const BG = '#1b1b27';
const TEXT = '#f4f4f8';
const MUTED = '#b9b9c9';
const FONT = '"Nunito Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DISPLAY_FONT = '"Fredoka Variable", "Nunito Variable", system-ui, sans-serif';

function fitLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, sizes: number[], maxLines: number, weight = 700): { size: number; lines: string[] } {
  for (const size of sizes) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const lines = wrapLines(ctx, text, maxWidth, maxLines);
    if (lines.join(' ') === text) return { size, lines };
  }
  const size = sizes[sizes.length - 1]!;
  ctx.font = `${weight} ${size}px ${FONT}`;
  return { size, lines: wrapLines(ctx, text, maxWidth, maxLines) };
}

export class TileCard {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(corner: boolean) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = corner ? 256 : 384;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.flipY = false;
    this.texture.anisotropy = 4;
  }

  draw(spec: TileDrawSpec, turns = 0): void {
    const { ctx } = this;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const sideways = turns % 2 === 1 && cw !== ch;
    const w = sideways ? ch : cw;
    const h = sideways ? cw : ch;
    const tint = spec.group?.color ?? spec.accent;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    ctx.translate(0, ch);
    ctx.scale(1, -1);
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = spec.ownerColor && spec.monopoly ? mixHex(BG, spec.ownerColor, 0.45) : BG;
    ctx.fillRect(0, 0, w, h);

    const ownable = spec.tile.type === 'property' || spec.tile.type === 'transport' || spec.tile.type === 'utility';
    if (ownable && sideways) this.drawOwnableWide(spec, tint, w, h, turns === 1);
    else if (ownable) this.drawOwnable(spec, tint, w, h);
    else this.drawSpecial(spec, tint, w, h);

    if (spec.ownerColor) this.drawOwnerBorder(spec.monopoly ? lighten(spec.ownerColor, 0.3) : spec.ownerColor, w, h);
    else {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    }
    if (spec.mortgaged) this.drawMortgage(w, h);
    this.texture.needsUpdate = true;
  }

  private drawOwnableWide(spec: TileDrawSpec, tint: string, w: number, h: number, bandRight: boolean): void {
    const { ctx } = this;
    const band = 34;
    const bandX = bandRight ? w - band : 0;
    ctx.fillStyle = tint;
    ctx.fillRect(bandX, 0, band, h);
    const x0 = bandRight ? 0 : band;
    const cw = w - band;
    const cx = x0 + cw / 2;
    const imgH = 112;
    const imgW = Math.min(cw - 36, 200);
    if (spec.image) roundedImage(ctx, spec.image, cx - imgW / 2, 14, imgW, imgH, 12);
    else {
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.roundRect(cx - imgW / 2, 14, imgW, imgH, 12);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (spec.groupImage) {
      const flagW = 44;
      const flagH = Math.round((flagW * 2) / 3);
      const fx = bandRight ? w - band + (band - flagW) / 2 : (band - flagW) / 2;
      const fy = h - flagH - 10;
      roundedImage(ctx, spec.groupImage, fx, fy, flagW, flagH, 4);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(fx, fy, flagW, flagH, 4);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const fit = fitLines(ctx, spec.tile.name, cw - 28, [24, 21, 18], 2);
    let y = 14 + imgH + 10;
    for (const line of fit.lines) {
      ctx.fillText(line, cx, y);
      y += fit.size + 3;
    }
    if (spec.rentLabel) {
      ctx.fillStyle = TEXT;
      ctx.font = `700 21px ${FONT}`;
      ctx.fillText(spec.rentLabel, cx, h - 34);
    } else if ('price' in spec.tile) {
      ctx.fillStyle = spec.monopoly ? TEXT : MUTED;
      ctx.font = `500 21px ${FONT}`;
      ctx.fillText(`${spec.currency.symbol}${spec.tile.price}`, cx, h - 34);
    }
  }

  private drawOwnable(spec: TileDrawSpec, tint: string, w: number, h: number): void {
    const { ctx } = this;
    const pad = 20;
    const imgTop = 28;
    const imgH = Math.round(h * 0.48);
    if (spec.image) roundedImage(ctx, spec.image, pad, imgTop, w - pad * 2, imgH, 14);
    else {
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.roundRect(pad, imgTop, w - pad * 2, imgH, 14);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = tint;
    ctx.fillRect(0, h - 40, w, 40);
    if (spec.groupImage) this.drawFlag(spec.groupImage, w, h);

    ctx.fillStyle = TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const fit = fitLines(ctx, spec.tile.name, w - pad * 2, [26, 23, 20], 2);
    let y = imgTop + imgH + 14;
    for (const line of fit.lines) {
      ctx.fillText(line, w / 2, y);
      y += fit.size + 4;
    }
    if (spec.rentLabel) {
      ctx.fillStyle = TEXT;
      ctx.font = `700 23px ${FONT}`;
      ctx.fillText(spec.rentLabel, w / 2, h - 40 - 32);
    } else if ('price' in spec.tile) {
      ctx.fillStyle = spec.monopoly ? TEXT : MUTED;
      ctx.font = `500 24px ${FONT}`;
      ctx.fillText(`${spec.currency.symbol}${spec.tile.price}`, w / 2, h - 40 - 32);
    }
  }

  private drawFlag(flag: HTMLImageElement, w: number, h: number): void {
    const { ctx } = this;
    const flagW = Math.round(w * 0.22);
    const flagH = Math.round((flagW * 2) / 3);
    const x = 10;
    const y = h - 20 - flagH / 2;
    roundedImage(ctx, flag, x, y, flagW, flagH, 4);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, flagW, flagH, 4);
    ctx.stroke();
    ctx.restore();
  }

  private drawSpecial(spec: TileDrawSpec, tint: string, w: number, h: number): void {
    const { ctx } = this;
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (spec.corner) {
      const iconSize = 112;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 4);
      if (spec.icon) drawIconNode(ctx, spec.icon, 0, -34, iconSize, tint);
      const fit = fitLines(ctx, spec.tile.name, w * 1.12, [28, 25, 22, 20], 3);
      let y = -34 + iconSize / 2 + 12;
      for (const line of fit.lines) {
        ctx.fillText(line, 0, y);
        y += fit.size + 3;
      }
      this.drawNotes(spec.notes, 0, y + 2, 22);
      ctx.restore();
      return;
    }
    const iconSize = 96;
    const cy = h * 0.4;
    if (spec.icon) drawIconNode(ctx, spec.icon, w / 2, cy, iconSize, tint);
    const fit = fitLines(ctx, spec.tile.name, w - 24, [24, 22, 20], 3);
    let y = cy + iconSize / 2 + 16;
    for (const line of fit.lines) {
      ctx.fillText(line, w / 2, y);
      y += fit.size + 4;
    }
    if (spec.tile.type === 'tax') {
      ctx.fillStyle = MUTED;
      ctx.font = `500 22px ${FONT}`;
      ctx.fillText(`${spec.currency.symbol}${spec.tile.amount}`, w / 2, y + 4);
      y += 30;
    }
    this.drawNotes(spec.notes, w / 2, y + 2, 20);
  }

  private drawNotes(notes: string[], x: number, y: number, size: number): void {
    const { ctx } = this;
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${size}px ${FONT}`;
    for (const note of notes) {
      ctx.fillText(note, x, y);
      y += size + 6;
    }
  }

  private drawOwnerBorder(color: string, w: number, h: number): void {
    const { ctx } = this;
    const lw = Math.round(w * 0.06);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(lw / 2, lw / 2, w - lw, h - lw, lw);
    ctx.stroke();
    ctx.restore();
  }

  private drawMortgage(w: number, h: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,16,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 6;
    for (let x = -h; x < w + h; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  dispose(): void {
    this.texture.dispose();
  }
}

export function makeLabelTexture(text: string, subtitle: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  let size = 132;
  ctx.font = `600 ${size}px ${DISPLAY_FONT}`;
  while (ctx.measureText(text).width > 940 && size > 60) {
    size -= 6;
    ctx.font = `600 ${size}px ${DISPLAY_FONT}`;
  }
  ctx.fillText(text, 512, 220);
  ctx.font = `500 44px ${DISPLAY_FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(subtitle, 512, 330);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
