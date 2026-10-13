declare module '*next.config.mjs' {
  export const PRODUCTION_SUPABASE_PROJECT_ID: string;
  export interface ImageRemotePattern {
    protocol: 'http' | 'https';
    hostname: string;
    port?: string;
    pathname?: string;
  }
  export function buildImageRemotePatterns(
    env?: Record<string, string | undefined>
  ): ImageRemotePattern[];
}
