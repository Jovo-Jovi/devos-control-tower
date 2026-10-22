export function metadataBase(raw: string | undefined): URL | undefined {
  if (raw === undefined) return undefined;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url;
  } catch {
    return undefined;
  }
}
