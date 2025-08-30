// frontend/src/vite-env.d.ts

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_ORG_NAME: string;
  readonly VITE_ORG_WEBSITE: string;
  readonly VITE_OFFICE_PHONE_OPTIONS: string;
  readonly VITE_VISUAL_DEBUG: string;
  readonly VITE_LOGOS_CONFIG: string;
  readonly VITE_PRESETS_CONFIG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
