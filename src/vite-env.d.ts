/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_LANDING_TOUR_VIDEO_ID?: string
  /** Valgfri base-URL til `/api/matchi-slots` (fx absolut URL i preview). */
  readonly VITE_MATCHI_SLOTS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
