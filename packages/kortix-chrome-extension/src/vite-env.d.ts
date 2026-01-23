/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly NEXT_PUBLIC_URL: string;
    readonly NEXT_PUBLIC_BACKEND_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
