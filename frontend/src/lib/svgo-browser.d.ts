// frontend/src/svgo-browser.d.ts
declare module 'svgo/dist/svgo.browser.js' {
  import { optimize as optimizeFunction } from 'svgo';
  export const optimize: typeof optimizeFunction;
}
