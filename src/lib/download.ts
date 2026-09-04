/** Hands a generated file to the browser and releases the blob afterwards.
 *  Kept in one place so every export path behaves the same and none of them
 *  leaks an object URL. */
export function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  /* Give the browser a moment to start the download before revoking. */
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
