/// <reference types="astro/client" />

declare module 'virtual:paperwhite/config' {
  import type { SerializedConfig, ThemeManifest } from '@paperwhite/core/types';
  export const config: SerializedConfig;
  export const theme: ThemeManifest;
  /** merged UI strings (core → theme → site) per locale */
  export const strings: Record<string, Record<string, string>>;
}

declare module '@pw/components/*' {
  const C: (props: Record<string, unknown>) => unknown;
  export default C;
}
declare module '@pw/layouts/*' {
  const C: (props: Record<string, unknown>) => unknown;
  export default C;
}
declare module '@pw/styles.css';
