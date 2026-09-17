import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, IVORY, ORANGE, part, piece, WOOD } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.5 });
  const beak = accentMaterial(ORANGE, { roughness: 0.4 });
  const beakTip = accentMaterial(DARK, { roughness: 0.4 });
  const chest = accentMaterial(IVORY, { roughness: 0.7 });
  const dark = accentMaterial(DARK, { roughness: 0.6 });
  part(g, new CylinderGeometry(0.02, 0.02, 0.24, 8), accentMaterial(WOOD, { roughness: 0.9 }), { y: 0.02, rz: Math.PI / 2 });
  part(g, new CylinderGeometry(0.008, 0.008, 0.07, 6), dark, { x: -0.03, y: 0.06 });
  part(g, new CylinderGeometry(0.008, 0.008, 0.07, 6), dark, { x: 0.03, y: 0.06 });
  part(g, new SphereGeometry(0.085, 16, 12), body, { y: 0.15, sx: 0.95, sy: 1.15, sz: 0.9 });
  part(g, new SphereGeometry(0.055, 14, 10), chest, { y: 0.14, z: 0.05, sx: 0.8, sy: 1, sz: 0.6 });
  part(g, new SphereGeometry(0.062, 16, 12), body, { y: 0.27, z: 0.03 });
  part(g, new ConeGeometry(0.038, 0.19, 14), beak, { y: 0.265, z: 0.16, rx: Math.PI / 2, sy: 1, sx: 1 });
  part(g, new SphereGeometry(0.02, 10, 8), beakTip, { y: 0.262, z: 0.255 });
  part(g, new SphereGeometry(0.016, 10, 8), chest, { x: -0.04, y: 0.29, z: 0.055 });
  part(g, new SphereGeometry(0.016, 10, 8), chest, { x: 0.04, y: 0.29, z: 0.055 });
  part(g, new SphereGeometry(0.008, 8, 6), dark, { x: -0.045, y: 0.292, z: 0.068 });
  part(g, new SphereGeometry(0.008, 8, 6), dark, { x: 0.045, y: 0.292, z: 0.068 });
  part(g, new BoxGeometry(0.05, 0.02, 0.12), dark, { y: 0.14, z: -0.12, rx: -0.5 });
  return g;
}
