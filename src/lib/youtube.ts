/** La chiave di un video YouTube da un indirizzo `watch?v=…`, `youtu.be/…` o `embed/…`. */
export function youtubeKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1) || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const embed = u.pathname.match(/\/embed\/([\w-]{6,})/);
    return embed ? embed[1] : null;
  } catch {
    return null;
  }
}
