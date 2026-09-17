import { CylinderGeometry, TorusGeometry } from 'three';
import { accentMaterial, bodyMaterial, GOLD, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.7, clearcoat: 0.2 });
  const band = accentMaterial(GOLD, { roughness: 0.5, metalness: 0.3 });
  part(g, new CylinderGeometry(0.2, 0.2, 0.014, 32), body, { y: 0.04 });
  part(g, new TorusGeometry(0.2, 0.02, 10, 40), body, { y: 0.05, rx: Math.PI / 2 });
  part(g, new CylinderGeometry(0.075, 0.09, 0.15, 24), body, { y: 0.12 });
  part(g, new CylinderGeometry(0.075, 0.075, 0.03, 24), body, { y: 0.2, sx: 0.85, sz: 0.85 });
  part(g, new TorusGeometry(0.088, 0.012, 8, 32), band, { y: 0.07, rx: Math.PI / 2 });
  part(g, new TorusGeometry(0.16, 0.006, 6, 40), band, { y: 0.048, rx: Math.PI / 2 });
  return g;
}
