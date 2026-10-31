import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.boutiquedah.app",
  appName: "بوتيك الداه",
  webDir: ".android-web/out",
  backgroundColor: "#f5f8f6",
  android: { backgroundColor: "#f5f8f6" },
  plugins: { SystemBars: { insetsHandling: "native" } },
};
export default config;
