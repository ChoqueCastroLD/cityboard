import { BoxGeometry, CapsuleGeometry, ConeGeometry, Shape, ShapeGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, DoubleSideAccent, glowMaterial, GOLD, ORANGE, part, piece } from './parts';

function wing(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(0.14, 0.12);
  s.lineTo(0.2, 0.24);
  s.lineTo(0.12, 0.2);
  s.lineTo(0.1, 0.27);
  s.lineTo(0.05, 0.17);
  s.lineTo(0.02, 0.24);
  s.lineTo(0, 0.1);
  s.closePath();
  return new ShapeGeometry(s);
}

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const plumage = bodyMaterial(color, { roughness: 0.3, clearcoat: 1, emissiveIntensity: 0.25 });
  const feather = DoubleSideAccent(color, { roughness: 0.5, emissive: ORANGE, emissiveIntensity: 0.35 });
  feather.userData.body = true;
  const ember = glowMaterial(ORANGE, 1.6);
  const gold = accentMaterial(GOLD, { metalness: 0.7, roughness: 0.3 });
  const dark = accentMaterial(DARK, { roughness: 0.5 });
  part(g, new CapsuleGeometry(0.05, 0.11, 8, 14), plumage, { y: 0.19, rx: 0.35 });
  part(g, new SphereGeometry(0.045, 14, 12), plumage, { y: 0.31, z: 0.05 });
  part(g, new ConeGeometry(0.016, 0.06, 8), gold, { y: 0.305, z: 0.11, rx: Math.PI / 2 });
  part(g, new SphereGeometry(0.009, 8, 6), dark, { x: -0.022, y: 0.325, z: 0.08 });
  part(g, new SphereGeometry(0.009, 8, 6), dark, { x: 0.022, y: 0.325, z: 0.08 });
  part(g, new ConeGeometry(0.012, 0.06, 6), ember, { y: 0.37, z: 0.02, rx: -0.6 });
  part(g, new ConeGeometry(0.01, 0.05, 6), ember, { x: 0.02, y: 0.36, z: 0.0, rx: -0.9, rz: -0.4 });
  part(g, wing(), feather, { x: 0.04, y: 0.18, z: -0.01, ry: -1.15, rz: 0.35 });
  part(g, wing(), feather, { x: -0.04, y: 0.18, z: -0.01, ry: 1.15 + Math.PI, rz: -0.35, sx: -1 });
  const tailFeathers: Array<[number, number]> = [
    [0, 0],
    [0.04, 0.35],
    [-0.04, -0.35],
  ];
  for (const [x, rz] of tailFeathers) {
    part(g, new BoxGeometry(0.02, 0.2, 0.004), feather, { x, y: 0.05, z: -0.09, rx: 0.9, rz });
    part(g, new SphereGeometry(0.014, 8, 6), ember, { x: x * 2.2, y: 0.0 + 0.02, z: -0.2 });
  }
  part(g, new BoxGeometry(0.02, 0.03, 0.02), dark, { x: -0.02, y: 0.06, z: 0.04 });
  part(g, new BoxGeometry(0.02, 0.03, 0.02), dark, { x: 0.02, y: 0.06, z: 0.04 });
  return g;
}
