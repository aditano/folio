/**
 * Shared LIVE-PREVIEW OAuth client (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker instead exposes ONE
 * shared "preview" client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`
 * (broker: `app-builder-deployer/auth/src/preview-oauth.ts`). When deployed the
 * deployer injects a per-app `GROK_AUTH_*` that overrides these (see `server.ts`).
 *
 * Client id/secret MUST come from environment variables — never commit secrets.
 * Prefer `GROK_PREVIEW_CLIENT_*` for the shared preview client; `GROK_AUTH_CLIENT_*`
 * is the deployer-injected per-app pair. Rotate the preview secret in the broker
 * console whenever it may have been exposed.
 */
function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

export const PREVIEW_CLIENT_ID =
  env("GROK_PREVIEW_CLIENT_ID") ?? env("GROK_AUTH_CLIENT_ID") ?? "grok_preview";

/** Empty when unset — callers must not fall back to a hardcoded secret. */
export const PREVIEW_CLIENT_SECRET =
  env("GROK_PREVIEW_CLIENT_SECRET") ?? env("GROK_AUTH_CLIENT_SECRET") ?? "";

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
