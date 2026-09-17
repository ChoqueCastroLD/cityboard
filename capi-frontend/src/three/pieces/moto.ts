import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, metalMaterial, part, piece, SILVER } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { metalness: 0.4, roughness: 0.3, clearcoat: 1 });
  const rubber = accentMaterial(DARK, { roughness: 0.85 });
  const chrome = metalMaterial(SILVER, 0.3);
  const seat = accentMaterial('#2a2a33', { roughness: 0.7 });
  for (const z of [0.14, -0.14]) {
    part(g, new CylinderGeometry(0.07, 0.07, 0.035, 20), rubber, { y: 0.07, z, rz: Math.PI / 2 });
    part(g, new CylinderGeometry(0.038, 0.038, 0.038, 12), chrome, { y: 0.07, z, rz: Math.PI / 2 });
  }
  part(g, new BoxGeometry(0.05, 0.035, 0.22), body, { y: 0.12, z: 0 });
  part(g, new SphereGeometry(0.05, 16, 12), body, { y: 0.19, z: 0.03, sz: 1.5, sy: 0.85 });
  part(g, new BoxGeometry(0.06, 0.03, 0.1), seat, { y: 0.19, z: -0.075 });
  part(g, new BoxGeometry(0.06, 0.03, 0.06), body, { y: 0.16, z: -0.14, rx: 0.4 });
  part(g, new CylinderGeometry(0.008, 0.008, 0.18, 8), chrome, { y: 0.15, z: 0.12, rx: 0.5 });
  part(g, new CylinderGeometry(0.007, 0.007, 0.16, 8), chrome, { y: 0.235, z: 0.09, rz: Math.PI / 2 });
  part(g, new CylinderGeometry(0.012, 0.012, 0.03, 8), rubber, { x: -0.08, y: 0.235, z: 0.09, rz: Math.PI / 2 });
  part(g, new CylinderGeometry(0.012, 0.012, 0.03, 8), rubber, { x: 0.08, y: 0.235, z: 0.09, rz: Math.PI / 2 });
  part(g, new SphereGeometry(0.022, 12, 8), accentMaterial('#fff3c2', { emissive: '#ffe28a', emissiveIntensity: 0.8 }), { y: 0.17, z: 0.17 });
  part(g, new CylinderGeometry(0.012, 0.016, 0.2, 10), chrome, { x: 0.045, y: 0.09, z: -0.06, rx: Math.PI / 2 + 0.15 });
  part(g, new BoxGeometry(0.07, 0.05, 0.06), accentMaterial('#4a4a55', { roughness: 0.5, metalness: 0.6 }), { y: 0.1, z: 0.0 });
  return g;
}
