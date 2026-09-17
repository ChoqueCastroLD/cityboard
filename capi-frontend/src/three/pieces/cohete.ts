import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, glowMaterial, IVORY, LAVA, part, piece, SKY } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.3, clearcoat: 1 });
  const ivory = accentMaterial(IVORY, { roughness: 0.4 });
  const dark = accentMaterial(DARK, { roughness: 0.5, metalness: 0.4 });
  part(g, new CylinderGeometry(0.06, 0.07, 0.2, 18), body, { y: 0.15 });
  part(g, new ConeGeometry(0.06, 0.12, 18), ivory, { y: 0.31 });
  part(g, new CylinderGeometry(0.03, 0.03, 0.015, 14), dark, { y: 0.18, z: 0.06, rx: Math.PI / 2 });
  part(g, new SphereGeometry(0.022, 12, 10), accentMaterial(SKY, { emissive: SKY, emissiveIntensity: 0.4 }), { y: 0.18, z: 0.064 });
  for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    part(g, new BoxGeometry(0.02, 0.1, 0.07), ivory, { x: Math.sin(angle) * 0.085, y: 0.07, z: Math.cos(angle) * 0.085, ry: angle, rx: 0.35 });
  }
  part(g, new CylinderGeometry(0.045, 0.03, 0.03, 14), dark, { y: 0.035 });
  part(g, new ConeGeometry(0.03, 0.08, 12), glowMaterial(LAVA, 2), { y: 0.0, rx: Math.PI });
  return g;
}
