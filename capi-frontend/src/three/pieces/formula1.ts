import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, metalMaterial, part, piece, SILVER } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { metalness: 0.5, roughness: 0.25, clearcoat: 1 });
  const rubber = accentMaterial(DARK, { roughness: 0.9 });
  const carbon = accentMaterial('#23232b', { roughness: 0.4, metalness: 0.5 });
  const chrome = metalMaterial(SILVER, 0.3);
  const visor = accentMaterial('#1a1a22', { roughness: 0.2, metalness: 0.7 });
  part(g, new BoxGeometry(0.075, 0.045, 0.2), body, { y: 0.055, z: -0.02 });
  part(g, new BoxGeometry(0.11, 0.035, 0.12), body, { y: 0.05, z: -0.05 });
  part(g, new ConeGeometry(0.03, 0.15, 12), body, { y: 0.05, z: 0.15, rx: Math.PI / 2, sx: 1.2 });
  part(g, new BoxGeometry(0.2, 0.012, 0.045), body, { y: 0.03, z: 0.2 });
  part(g, new BoxGeometry(0.012, 0.03, 0.045), carbon, { x: -0.1, y: 0.04, z: 0.2 });
  part(g, new BoxGeometry(0.012, 0.03, 0.045), carbon, { x: 0.1, y: 0.04, z: 0.2 });
  part(g, new BoxGeometry(0.19, 0.012, 0.05), body, { y: 0.12, z: -0.14 });
  part(g, new BoxGeometry(0.012, 0.06, 0.05), carbon, { x: -0.09, y: 0.09, z: -0.14 });
  part(g, new BoxGeometry(0.012, 0.06, 0.05), carbon, { x: 0.09, y: 0.09, z: -0.14 });
  part(g, new BoxGeometry(0.03, 0.05, 0.08), body, { y: 0.1, z: -0.07 });
  part(g, new SphereGeometry(0.028, 14, 10), accentMaterial('#f4f4ff', { roughness: 0.3, clearcoat: 1 } as never), { y: 0.1, z: 0.02 });
  part(g, new SphereGeometry(0.03, 14, 10, 0, Math.PI * 2, 0.9, 0.7), visor, { y: 0.1, z: 0.02 });
  part(g, new TorusGeometry(0.038, 0.006, 8, 20, Math.PI), chrome, { y: 0.1, z: 0.0, rx: 0, ry: 0, rz: 0 });
  for (const [x, z, w] of [
    [-0.085, 0.12, 0.04],
    [0.085, 0.12, 0.04],
    [-0.09, -0.1, 0.05],
    [0.09, -0.1, 0.05],
  ] as const) {
    part(g, new CylinderGeometry(0.042, 0.042, w, 20), rubber, { x, y: 0.042, z, rz: Math.PI / 2 });
    part(g, new CylinderGeometry(0.02, 0.02, w + 0.004, 12), chrome, { x, y: 0.042, z, rz: Math.PI / 2 });
    part(g, new CylinderGeometry(0.008, 0.008, Math.abs(x) - 0.04, 6), carbon, { x: x / 2, y: 0.045, z, rz: Math.PI / 2 });
  }
  return g;
}
