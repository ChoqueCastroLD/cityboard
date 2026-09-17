import { CylinderGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { accentMaterial, bodyMaterial, metalMaterial, part, piece, SILVER } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { metalness: 0.25, roughness: 0.2, clearcoat: 1 });
  const base = accentMaterial('#2a2a33', { roughness: 0.5, metalness: 0.4 });
  const chrome = metalMaterial(SILVER, 0.2);
  part(g, new CylinderGeometry(0.1, 0.11, 0.02, 24), base, { y: 0.01 });
  part(g, new RoundedBoxGeometry(0.17, 0.17, 0.17, 4, 0.025), body, { y: 0.105, ry: Math.PI / 4 });
  part(g, new RoundedBoxGeometry(0.06, 0.06, 0.06, 3, 0.012), chrome, { y: 0.225, ry: Math.PI / 4 + 0.5 });
  return g;
}
