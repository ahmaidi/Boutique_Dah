export const nativeBuild = process.env.NEXT_PUBLIC_NATIVE_APP === "true";

// Explicit HTML paths avoid Capacitor's single-page fallback on nested routes.
export function appHref(href: string, native = nativeBuild) {
  if (!native || !href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://localhost");
  if (!url.pathname.endsWith(".html")) {
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.pathname += "index.html";
  }
  return url.pathname + url.search + url.hash;
}
export function appPathname(pathname: string) {
  return pathname.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/";
}
