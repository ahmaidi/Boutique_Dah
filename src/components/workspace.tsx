"use client";
import { appPathname } from "@/lib/app-href";
import Link from "./app-link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Check,
  ChevronLeft,
  LayoutDashboard,
  ListFilter,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import type { Store } from "@/lib/types";
import { ZodError } from "zod";
import { syncAutomaticBackup } from "@/lib/automatic-backups";
import {
  mutateDeviceStore,
  readDeviceStore,
  replaceDeviceStore,
} from "@/lib/device-store";

type ContextValue = {
  data: Store | null;
  mutate: (action: string, body: unknown) => Promise<Store>;
  restore: (state: unknown, expectedRevision: number) => Promise<void>;
  notify: (text: string) => void;
};
const AppContext = createContext<ContextValue | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("App context missing");
  return context;
}
export const currency = (amount: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-MA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Casablanca",
  }).format(new Date(value));
const navigation = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/lists", label: "لوائح الطرود", icon: ListFilter },
  { href: "/lists/new", label: "إنشاء لائحة جديدة", icon: Plus },
  { href: "/commissions", label: "إدارة النسب", icon: Wallet },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];
export function Workspace({ children }: { children: React.ReactNode }) {
  const pathname = appPathname(usePathname());
  const [data, setData] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [backupError, setBackupError] = useState("");
  const syncBackup = useCallback(async () => {
    try { await syncAutomaticBackup(); setBackupError(""); }
    catch { setBackupError("السجلات محفوظة على الهاتف، لكن تعذّر تحديث النسخة التلقائية. افتح الإعدادات وتحقق من النسخ الاحتياطي."); }
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await readDeviceStore());
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "تعذّر فتح تخزين الجهاز. تحقق من إعدادات المتصفح ومساحة الهاتف."
          : (e as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  useEffect(() => {
    if (data) void Promise.resolve().then(syncBackup);
  }, [data, syncBackup]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  async function mutate(action: string, body: unknown) {
    try {
      const result = await mutateDeviceStore(action, body);
      setData(result);
      await syncBackup();
      return result;
    } catch (error) {
      if (error instanceof ZodError)
        throw new Error("تحقق من الحقول المطلوبة والقيم المدخلة");
      throw error;
    }
  }
  async function restore(state: unknown, expectedRevision: number) {
    setData(await replaceDeviceStore(state, expectedRevision));
    await syncBackup();
    try {
      sessionStorage.removeItem("boutique.whatsapp-queue.v1");
    } catch {}
  }
  return (
    <AppContext.Provider
      value={{
        data,
        mutate,
        restore,
        notify: setToast,
      }}
    >
      <div className="app-shell" onInvalidCapture={(event) => {
        const input = event.target;
        if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)
          input.dataset.invalid = "true";
      }} onInputCapture={(event) => {
        const input = event.target;
        if ((input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) && input.validity.valid)
          delete input.dataset.invalid;
      }}>
        {menu && (
          <button
            className="sidebar-overlay"
            aria-label="إغلاق القائمة"
            onClick={() => setMenu(false)}
          />
        )}
        <aside className={`sidebar ${menu ? "is-open" : ""}`}>
          <Link href="/" className="brand" onClick={() => setMenu(false)}>
            <span className="brand-icon">
              <Package size={29} strokeWidth={1.7} />
            </span>
            <span>
              <strong>{data?.settings.shopName || "بوتيك الداه"}</strong>
              <small>BOUTIQUE DAH</small>
            </span>
          </Link>
          <div className="sidebar-divider" />
          <span className="nav-heading">مساحة العمل</span>
          <nav>
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenu(false)}
                className={`nav-item ${pathname === item.href ? "active" : ""}`}
              >
                <item.icon size={20} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.href === "/lists" && (
                  <span className="nav-count">{data?.lists.length ?? "—"}</span>
                )}
                {pathname === item.href && <span className="nav-active-dot" />}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="فتح القائمة"
                onClick={() => setMenu(true)}
              >
                <Menu size={22} />
              </button>
              <span>مساحة العمل</span>
              <ChevronLeft size={14} />
              <strong>
                {navigation.find((n) => n.href === pathname)?.label ||
                  "لوحة التحكم"}
              </strong>
            </div>
            <div className="topbar-actions">
              <span className="location-label">بوجدور، المغرب</span>
            </div>
          </header>
          <main className="main-content">
            {backupError && <div className="error-banner" role="alert">{backupError}</div>}
            {error && (
              <div role="alert" className="error-banner">
                {error}
                <button onClick={() => void refresh()}>
                  <RefreshCw size={16} />
                  إعادة المحاولة
                </button>
              </div>
            )}
            {!data && loading ? (
              <div className="loading-state">
                <RefreshCw className="spin" size={28} />
                <p>جارٍ تحميل مساحة العمل…</p>
              </div>
            ) : data ? (
              children
            ) : null}
          </main>
          <footer className="app-footer">
            <span>
              بوتيك الداه <span>·</span> إدارة بسيطة، خدمة أفضل
            </span>
            <span>
              <span className="live-dot" />
              تخزين محلي
            </span>
          </footer>
        </div>
      </div>
      {toast && (
        <div role="status" className="toast">
          <span className="toast-icon">
            <Check size={17} />
          </span>
          {toast}
          <button aria-label="إغلاق" onClick={() => setToast("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
