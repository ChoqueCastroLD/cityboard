import { ConeGeometry, OctahedronGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, glowMaterial, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.25, clearcoat: 1, emissiveIntensity: 0.35 });
  const tail = accentMaterial('#fff2b3', { emissive: '#ffd66b', emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.6 });
  const tailFar = accentMaterial('#fff2b3', { emissive: '#ffd66b', emissiveIntensity: 0.6, transparent: true, opacity: 0.3, roughness: 0.6 });
  part(g, new SphereGeometry(0.085, 20, 16), body, { y: 0.12, z: 0.06 });
  part(g, new ConeGeometry(0.075, 0.28, 16, 1, true), tail, { y: 0.2, z: -0.05, rx: -0.93 });
  part(g, new ConeGeometry(0.045, 0.36, 12, 1, true), tailFar, { y: 0.23, z: -0.08, rx: -0.93 });
  part(g, new OctahedronGeometry(0.018), glowMaterial('#ffffff', 1.5), { x: 0.09, y: 0.3, z: -0.14 });
  part(g, new OctahedronGeometry(0.014), glowMaterial('#ffffff', 1.5), { x: -0.08, y: 0.36, z: -0.2 });
  part(g, new OctahedronGeometry(0.012), glowMaterial('#ffffff', 1.5), { x: 0.03, y: 0.42, z: -0.24 });
  return g;
}
