import { LatheGeometry, Vector2 } from 'three';
import { bodyMaterial, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const profile = [
    [0, 0],
    [0.15, 0],
    [0.15, 0.03],
    [0.1, 0.06],
    [0.08, 0.1],
    [0.06, 0.17],
    [0.09, 0.19],
    [0.06, 0.22],
    [0.075, 0.27],
    [0.05, 0.31],
    [0, 0.32],
  ].map(([x, y]) => new Vector2(x, y));
  part(g, new LatheGeometry(profile, 40), bodyMaterial(color));
  return g;
}
