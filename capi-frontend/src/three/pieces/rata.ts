import { CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, part, piece, PINK } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const fur = bodyMaterial(color, { roughness: 0.75, clearcoat: 0.2 });
  const skin = accentMaterial(PINK, { roughness: 0.6 });
  const dark = accentMaterial(DARK, { roughness: 0.4 });
  const whisker = accentMaterial('#e8e8f0', { roughness: 0.5 });
  part(g, new SphereGeometry(0.085, 20, 14), fur, { y: 0.085, z: -0.03, sz: 1.5, sy: 0.9 });
  part(g, new SphereGeometry(0.06, 18, 12), fur, { y: 0.1, z: 0.11, sz: 1.35, sy: 0.85 });
  part(g, new SphereGeometry(0.014, 10, 8), skin, { y: 0.095, z: 0.19 });
  for (const x of [-0.045, 0.045]) {
    part(g, new SphereGeometry(0.03, 14, 10), fur, { x, y: 0.15, z: 0.08, sz: 0.5 });
    part(g, new SphereGeometry(0.019, 12, 8), skin, { x, y: 0.15, z: 0.087, sz: 0.4 });
    part(g, new SphereGeometry(0.011, 10, 8), dark, { x: x * 0.65, y: 0.115, z: 0.16 });
    for (const dy of [-0.008, 0.008]) part(g, new CylinderGeometry(0.0025, 0.0025, 0.09, 5), whisker, { x: x * 1.4, y: 0.095 + dy, z: 0.175, rz: Math.PI / 2, ry: x > 0 ? -0.25 : 0.25 });
  }
  for (const [x, z] of [
    [-0.045, 0.06],
    [0.045, 0.06],
    [-0.05, -0.08],
    [0.05, -0.08],
  ] as const) {
    part(g, new SphereGeometry(0.02, 10, 8), skin, { x, y: 0.02, z, sz: 1.4, sy: 0.7 });
  }
  part(g, new TorusGeometry(0.09, 0.009, 8, 24, Math.PI * 0.9), skin, { y: 0.04, z: -0.2, rx: Math.PI / 2, rz: Math.PI / 2 });
  return g;
}
