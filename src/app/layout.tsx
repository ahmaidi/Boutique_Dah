import type { Metadata, Viewport } from "next";
import "@fontsource/cairo/arabic-400.css";
import "@fontsource/cairo/arabic-500.css";
import "@fontsource/cairo/arabic-600.css";
import "@fontsource/cairo/arabic-700.css";
import "@fontsource/cairo/arabic-800.css";
import "./globals.css";
import { nativeBuild } from "@/lib/app-href";
export const metadata: Metadata = {
  title: {
    default: "بوتيك الداه | إدارة الطرود",
    template: "%s | بوتيك الداه",
  },
  description: "إدارة الطرود والشحنات والنسب في بوتيك الداه، بوجدور.",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#145b47",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {nativeBuild && (
          <meta
            httpEquiv="Content-Security-Policy"
            content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
          />
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
