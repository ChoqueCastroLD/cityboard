import { CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { accentMaterial, bodyMaterial, part, piece, PINK, TERRACOTTA } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.55, clearcoat: 0.3 });
  const pot = accentMaterial(TERRACOTTA, { roughness: 0.8 });
  const flower = accentMaterial(PINK, { roughness: 0.5 });
  part(g, new CylinderGeometry(0.085, 0.065, 0.09, 18), pot, { y: 0.045 });
  part(g, new TorusGeometry(0.085, 0.014, 8, 20), pot, { y: 0.09, rx: Math.PI / 2 });
  part(g, new CylinderGeometry(0.055, 0.06, 0.24, 14), body, { y: 0.21 });
  part(g, new SphereGeometry(0.055, 14, 10), body, { y: 0.33 });
  part(g, new CylinderGeometry(0.03, 0.03, 0.08, 10), body, { x: -0.08, y: 0.2, rz: Math.PI / 2 });
  part(g, new CylinderGeometry(0.03, 0.03, 0.1, 10), body, { x: -0.11, y: 0.24 });
  part(g, new SphereGeometry(0.03, 10, 8), body, { x: -0.11, y: 0.29 });
  part(g, new CylinderGeometry(0.028, 0.028, 0.07, 10), body, { x: 0.075, y: 0.15, rz: Math.PI / 2 });
  part(g, new CylinderGeometry(0.028, 0.028, 0.09, 10), body, { x: 0.105, y: 0.19 });
  part(g, new SphereGeometry(0.028, 10, 8), body, { x: 0.105, y: 0.235 });
  part(g, new SphereGeometry(0.03, 10, 8), flower, { y: 0.38, sy: 0.7 });
  part(g, new SphereGeometry(0.012, 8, 6), accentMaterial('#ffe066'), { y: 0.395 });
  return g;
}
