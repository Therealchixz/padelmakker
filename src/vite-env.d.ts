/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_LANDING_TOUR_VIDEO_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
