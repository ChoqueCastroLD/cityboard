import { BoxGeometry, CapsuleGeometry, ConeGeometry, Shape, ShapeGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, DoubleSideAccent, glowMaterial, IVORY, part, piece } from './parts';

function wing(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(0.12, 0.1);
  s.lineTo(0.2, 0.05);
  s.lineTo(0.17, 0.14);
  s.lineTo(0.22, 0.19);
  s.lineTo(0.09, 0.19);
  s.lineTo(0.02, 0.16);
  s.closePath();
  return new ShapeGeometry(s);
}

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const scales = bodyMaterial(color, { roughness: 0.3, clearcoat: 1, metalness: 0.35 });
  const membrane = DoubleSideAccent(color, { roughness: 0.6, transparent: true, opacity: 0.8 });
  membrane.userData.body = true;
  const horn = accentMaterial(IVORY, { roughness: 0.4 });
  const eye = glowMaterial('#ffd60a', 1.8);
  const dark = accentMaterial(DARK, { roughness: 0.5 });
  part(g, new CapsuleGeometry(0.065, 0.16, 8, 14), scales, { y: 0.16, z: -0.02, rx: Math.PI / 2 - 0.3 });
  part(g, new BoxGeometry(0.09, 0.08, 0.13), scales, { y: 0.29, z: 0.1, rx: 0.15 });
  part(g, new BoxGeometry(0.06, 0.04, 0.07), dark, { y: 0.27, z: 0.19 });
  part(g, new ConeGeometry(0.014, 0.06, 6), horn, { x: -0.03, y: 0.35, z: 0.06, rx: -0.5 });
  part(g, new ConeGeometry(0.014, 0.06, 6), horn, { x: 0.03, y: 0.35, z: 0.06, rx: -0.5 });
  part(g, new SphereGeometry(0.012, 8, 6), eye, { x: -0.032, y: 0.31, z: 0.16 });
  part(g, new SphereGeometry(0.012, 8, 6), eye, { x: 0.032, y: 0.31, z: 0.16 });
  part(g, wing(), membrane, { x: 0.05, y: 0.22, z: -0.02, ry: -1.2, rz: 0.4 });
  part(g, wing(), membrane, { x: -0.05, y: 0.22, z: -0.02, ry: 1.2 + Math.PI, rz: -0.4, sx: -1 });
  part(g, new ConeGeometry(0.04, 0.22, 8), scales, { y: 0.08, z: -0.2, rx: -Math.PI / 2 + 0.6 });
  for (const [y, z] of [
    [0.24, 0.02],
    [0.22, -0.04],
    [0.19, -0.1],
  ]) {
    part(g, new ConeGeometry(0.016, 0.045, 5), horn, { y, z, rx: -0.3 });
  }
  for (const x of [-0.04, 0.04]) {
    part(g, new BoxGeometry(0.035, 0.07, 0.04), scales, { x, y: 0.045, z: 0.03 });
  }
  return g;
}
