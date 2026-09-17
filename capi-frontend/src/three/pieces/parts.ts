import {
  type BufferGeometry,
  Color,
  type ColorRepresentation,
  DoubleSide,
  Group,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
} from 'three';

export const IVORY = '#f3ead3';
export const DARK = '#1b1b22';
export const GOLD = '#f2c14e';
export const ORANGE = '#ff8a2b';
export const LAVA = '#ff4d1a';
export const WOOD = '#8a5a3c';
export const TERRACOTTA = '#c9683c';
export const SILVER = '#d7dbe3';
export const LEAF = '#3fa34d';
export const SKY = '#63b3ff';
export const PINK = '#ff6fa9';
export const WHITE = '#ffffff';

export interface Place {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  s?: number;
}

export function place(object: Object3D, at: Place = {}): void {
  object.position.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
  object.rotation.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
  const s = at.s ?? 1;
  object.scale.set(at.sx ?? s, at.sy ?? s, at.sz ?? s);
}

export function bodyMaterial(color: string, extra: Partial<{ metalness: number; roughness: number; clearcoat: number; emissiveIntensity: number }> = {}): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color,
    roughness: extra.roughness ?? 0.35,
    metalness: extra.metalness ?? 0.1,
    clearcoat: extra.clearcoat ?? 0.8,
    clearcoatRoughness: 0.25,
  });
  if (extra.emissiveIntensity) {
    material.emissive = new Color(color);
    material.emissiveIntensity = extra.emissiveIntensity;
  }
  material.userData.body = true;
  return material;
}

export interface AccentOptions {
  metalness?: number;
  roughness?: number;
  emissive?: ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

export function accentMaterial(color: ColorRepresentation, options: AccentOptions = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.5,
    metalness: options.metalness ?? 0.05,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

export function DoubleSideAccent(color: ColorRepresentation, options: AccentOptions = {}): MeshStandardMaterial {
  const material = accentMaterial(color, options);
  material.side = DoubleSide;
  return material;
}

export function metalMaterial(color: ColorRepresentation, roughness = 0.25): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color, metalness: 1, roughness, clearcoat: 0.6, clearcoatRoughness: 0.2 });
}

export function glowMaterial(color: ColorRepresentation, intensity = 1.6): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}

export function part(group: Group, geometry: BufferGeometry, material: Material, at: Place = {}): Mesh {
  const mesh = new Mesh(geometry, material);
  place(mesh, at);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

export function piece(): Group {
  return new Group();
}
