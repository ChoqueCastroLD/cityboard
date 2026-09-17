import { ConeGeometry, CylinderGeometry } from 'three';
import { accentMaterial, bodyMaterial, GOLD, metalMaterial, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const stone = bodyMaterial(color, { metalness: 0.1, roughness: 0.55, clearcoat: 0.4 });
  const sand = accentMaterial('#d9c28f', { roughness: 0.9 });
  const gold = metalMaterial(GOLD, 0.25);
  part(g, new CylinderGeometry(0.13, 0.14, 0.02, 4), sand, { y: 0.01, ry: Math.PI / 4 });
  part(g, new ConeGeometry(0.125, 0.19, 4), stone, { y: 0.115, ry: Math.PI / 4 });
  for (const [y, r] of [
    [0.06, 0.098],
    [0.1, 0.075],
    [0.14, 0.051],
  ] as const) {
    part(g, new CylinderGeometry(r, r + 0.006, 0.004, 4), accentMaterial('#1b1b22', { roughness: 0.7, transparent: true, opacity: 0.25 }), { y, ry: Math.PI / 4 });
  }
  part(g, new ConeGeometry(0.03, 0.045, 4), gold, { y: 0.232, ry: Math.PI / 4 });
  return g;
}
