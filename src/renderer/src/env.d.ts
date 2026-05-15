/// <reference types="vite/client" />
import type { LoopbridgeApi } from '../../preload/index';

declare global {
  interface Window {
    api: LoopbridgeApi;
  }
}

export {};
