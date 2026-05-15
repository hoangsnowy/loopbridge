import type { LoopbridgeApi } from './index';

declare global {
  interface Window {
    api: LoopbridgeApi;
  }
}

export {};
