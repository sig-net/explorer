/**
 * The URL of a file in `public`, under the base path the app is served from. `path` is relative to
 * `public`, with no leading slash: `icons/Solana.svg`.
 */
export function publicAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}
