import { BoxGeometry, CylinderGeometry } from 'three';
import { accentMaterial, bodyMaterial, part, piece, SILVER } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.35, metalness: 0.2 });
  const base = accentMaterial('#3a3a46', { roughness: 0.7 });
  const windows = accentMaterial('#9fc4ff', { roughness: 0.3, metalness: 0.2, emissive: '#6f9bff', emissiveIntensity: 0.35 });
  const antenna = accentMaterial(SILVER, { roughness: 0.4, metalness: 0.8 });
  part(g, new BoxGeometry(0.3, 0.02, 0.16), base, { y: 0.01 });
  for (const x of [-0.075, 0.075]) {
    part(g, new BoxGeometry(0.1, 0.4, 0.1), body, { x, y: 0.22 });
    for (let i = 0; i < 9; i++) {
      const y = 0.06 + i * 0.04;
      part(g, new BoxGeometry(0.102, 0.006, 0.07), windows, { x, y });
      part(g, new BoxGeometry(0.07, 0.006, 0.102), windows, { x, y });
    }
    part(g, new BoxGeometry(0.104, 0.012, 0.104), accentMaterial('#22222c', { roughness: 0.6 }), { x, y: 0.415 });
  }
  part(g, new CylinderGeometry(0.006, 0.004, 0.1, 8), antenna, { x: -0.075, y: 0.47 });
  return g;
}
