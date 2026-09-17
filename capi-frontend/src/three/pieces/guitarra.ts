import { BoxGeometry, CylinderGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, part, piece, SILVER, WOOD } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.3, clearcoat: 1 });
  const wood = accentMaterial(WOOD, { roughness: 0.7 });
  const dark = accentMaterial(DARK, { roughness: 0.6 });
  const string = accentMaterial(SILVER, { metalness: 0.8, roughness: 0.3 });
  const tilt = -0.18;
  part(g, new CylinderGeometry(0.105, 0.105, 0.045, 24), body, { y: 0.11, rx: Math.PI / 2, rz: tilt });
  part(g, new CylinderGeometry(0.08, 0.08, 0.045, 24), body, { x: -0.03, y: 0.22, rx: Math.PI / 2, rz: tilt });
  part(g, new CylinderGeometry(0.03, 0.03, 0.005, 16), dark, { x: -0.005, y: 0.16, z: 0.024, rx: Math.PI / 2 });
  part(g, new BoxGeometry(0.03, 0.2, 0.02), wood, { x: -0.07, y: 0.33, z: 0.006, rz: tilt });
  part(g, new BoxGeometry(0.04, 0.05, 0.02), dark, { x: -0.093, y: 0.44, z: 0.006, rz: tilt });
  part(g, new BoxGeometry(0.05, 0.012, 0.012), dark, { x: 0.01, y: 0.09, z: 0.028, rz: tilt });
  for (const offset of [-0.012, -0.004, 0.004, 0.012]) {
    part(g, new BoxGeometry(0.002, 0.34, 0.002), string, { x: -0.04 + offset * 0.5 + offset, y: 0.26, z: 0.03, rz: tilt });
  }
  for (const [x, y] of [
    [-0.108, 0.425],
    [-0.088, 0.435],
    [-0.108, 0.455],
    [-0.088, 0.462],
  ]) {
    part(g, new CylinderGeometry(0.006, 0.006, 0.02, 6), string, { x, y, z: 0.006, rz: Math.PI / 2 });
  }
  return g;
}
