import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import type { SceneBackend } from './types';

export type AnyRenderer = WebGPURenderer | WebGLRenderer;

export interface RendererHandle {
  renderer: AnyRenderer;
  backend: SceneBackend;
}

export async function createRenderer(canvas: HTMLCanvasElement): Promise<RendererHandle> {
  try {
    const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
    await renderer.init();
    configure(renderer);
    const backend = renderer.backend as { isWebGPUBackend?: boolean };
    return { renderer, backend: backend.isWebGPUBackend ? 'webgpu' : 'webgl' };
  } catch (error) {
    console.warn('[scene] WebGPURenderer unavailable, using WebGLRenderer', error);
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    configure(renderer);
    return { renderer, backend: 'webgl' };
  }
}

function configure(renderer: AnyRenderer): void {
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 600;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, smallScreen ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
}
