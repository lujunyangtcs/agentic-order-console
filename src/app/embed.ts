/**
 * Whether this document is the phone preview.
 *
 * Read once at module load from `?embed=1`, so it survives every in-app
 * navigation (links do not carry the query string) and never leaks into the
 * parent document — the parent and the iframe share sessionStorage, so a
 * stored flag would flip both.
 */
export const isEmbed: boolean = (() => {
  try {
    return new URLSearchParams(location.search).get('embed') === '1'
  } catch {
    return false
  }
})()
