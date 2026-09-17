import { BoardScene } from './BoardScene';
import type { CreateBoardScene } from './types';

export const createBoardScene: CreateBoardScene = (canvas, options) => new BoardScene(canvas, options);
export type * from './types';
