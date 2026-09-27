/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API; defaults to the same-origin `/api/v1`. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
