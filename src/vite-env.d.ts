/// <reference types="vite/client" />
// Both are needed: "client" declares virtual:pwa-register and the PWA env keys, "react" declares
// virtual:pwa-register/react. With only the first, tsc fails with TS2307 on UpdatePrompt's import.
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

// Injected by vite.config.ts at build time. Read only in src/ui/app/buildInfo.ts.
declare const __APP_BUILD_TIME__: string;
declare const __APP_COMMIT__: string;
declare const __APP_IS_CI__: boolean;
