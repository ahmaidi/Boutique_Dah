"use client";
import { clientId } from "@/lib/client-id";
import { useState } from "react";
import Image from "next/image";
import {
  Check,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Settings2,
  Store,
  Tag,
  Trash2,
} from "lucide-react";
import type { Category, Settings } from "@/lib/types";
import { needsManualPrice, settingsSchema } from "@/lib/domain";
import { useApp } from "./workspace";
import { PageHeading } from "./ui";
import { DeviceBackups } from "./device-backups";
export function SettingsPage() {
  const { data } = useApp();
  return data ? (
    <>
      <SettingsForm
        key={data.revision}
        initialSettings={data.settings}
        initialCategories={data.categories}
      />
      <DeviceBackups />
    </>
  ) : null;
}
function SettingsForm({
  initialSettings,
  initialCategories,
}: {
  initialSettings: Settings;
  initialCategories: Category[];
}) {
  const { data, mutate, notify } = useApp();
  const [settings, setSettings] = useState<Settings>(() => ({
    ...initialSettings,
  }));
  const [categories, setCategories] = useState<Category[]>(() =>
    initialCategories.map((c) => ({ ...c })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [logoError, setLogoError] = useState(false);
  if (!data || !settings) return null;
  const edit = (key: keyof Settings, value: string | number) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  const check = () => settingsSchema.safeParse({ ...settings, categories });
  const validation = attempted ? check() : null;
  const invalid = new Set(validation && !validation.success ? validation.error.issues.map((issue) => issue.path.join(".")) : []);
  const field = (name: string) => ({ name, "aria-invalid": invalid.has(name) ? true as const : undefined });
  async function logo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("اختر صورة PNG أو JPEG أو WebP");
      setLogoError(true);
      return;
    }
    if (file.size > 30000) {
      setError("اختر شعاراً أصغر من ٣٠ كيلوبايت");
      setLogoError(true);
      return;
    }
    const reader = new FileReader();
    setLogoError(false);
    setError("");
    reader.onload = () => edit("logo", reader.result as string);
    reader.readAsDataURL(file);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setAttempted(true);
    const result = check();
    if (!result.success) {
      setError("راجع الحقول المحددة بالأحمر ثم احفظ الإعدادات");
      const form = e.currentTarget as HTMLFormElement;
      const first = form.elements.namedItem(result.error.issues[0].path.join(".")) as HTMLElement | null;
      first?.focus(); first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate("settings", { ...settings, categories });
      notify("تم حفظ إعدادات المتجر بنجاح");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="إعدادات المتجر"
        description="تفاصيل متجرك، وأسعار شحن تناسب عملك."
      />
      <form className="settings-layout" onSubmit={submit} noValidate>
        <div className="settings-main">
          <section className="panel form-panel">
            <div className="form-section-title">
              <span className="section-icon">
                <Store size={21} />
              </span>
              <div>
                <h2>هوية المتجر</h2>
                <p>معلومات بوتيك الداه الأساسية</p>
              </div>
            </div>
            <div className="logo-upload">
              <div className="logo-preview">
                {settings.logo ? (
                  <Image
                    src={settings.logo}
                    width={66}
                    height={66}
                    unoptimized
                    alt="شعار المتجر"
                  />
                ) : (
                  <Store size={30} />
                )}
              </div>
              <div>
                <label className="button outline small upload-label" data-invalid={logoError ? "true" : undefined}>
                  <ImagePlus size={16} />
                  رفع شعار
                  <input
                    aria-invalid={logoError || undefined}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void logo(e.target.files?.[0])}
                    disabled={busy}
                  />
                </label>
                <p className="field-help">
                  PNG أو JPG أو WebP · حتى ٣٠ كيلوبايت
                </p>
              </div>
              {settings.logo && (
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label="إزالة الشعار"
                  onClick={() => edit("logo", "")}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
            <label className="field-label" htmlFor="shop-name">
              اسم المتجر
            </label>
            <input
              {...field("shopName")}
              id="shop-name"
              required
              minLength={2}
              maxLength={80}
              value={settings.shopName}
              onChange={(e) => edit("shopName", e.target.value)}
              disabled={busy}
            />
            <label className="field-label spaced-label" htmlFor="maps-url">
              رابط موقع Google Maps
            </label>
            <div className="input-with-icon">
              <MapPin size={18} />
              <input
                {...field("mapsUrl")}
                id="maps-url"
                type="url"
                dir="ltr"
                placeholder="https://maps.google.com/..."
                value={settings.mapsUrl}
                onChange={(e) => edit("mapsUrl", e.target.value)}
                disabled={busy}
              />
            </div>
            <p className="field-help">
              يُضاف هذا الرابط إلى رسالة إشعار وصول الطرد.
            </p>
            <label className="field-label spaced-label" htmlFor="backup-email">
              بريد النسخ الاحتياطية
            </label>
            <input
              {...field("backupEmail")}
              id="backup-email"
              type="email"
              inputMode="email"
              dir="ltr"
              autoCapitalize="off"
              spellCheck={false}
              autoComplete="email"
              placeholder="yourname@gmail.com"
              maxLength={254}
              value={settings.backupEmail ?? ""}
              disabled={busy}
              onChange={(e) => edit("backupEmail", e.target.value)}
            />
            <p className="field-help">
              بريدك لاستلام النسخ. يُفتح Gmail بالمرفق، وتضغط إرسال بنفسك.
            </p>
          </section>
          <section className="panel form-panel categories-panel">
            <div className="form-section-title">
              <span className="section-icon">
                <Tag size={21} />
              </span>
              <div>
                <h2>فئات الطرود وأسعار الشحن</h2>
                <p>السعر بالدرهم لكل قطعة من الفئة</p>
              </div>
            </div>
            <div className="category-labels">
              <span>اسم الفئة</span>
              <span>سعر الشحن (د.م)</span>
              <span>مفعّلة</span>
              <span />
            </div>
            {categories.map((c, i) => (
              <div key={c.id} className="category-setting-row">
                <label className="category-name-field">
                  <span className="mobile-field-label">اسم الفئة</span>
                  <input
                    {...field(`categories.${i}.name`)}
                    aria-label={`اسم الفئة ${i + 1}`}
                    value={c.name}
                    maxLength={60}
                    required
                    onChange={(e) =>
                      setCategories((v) =>
                        v.map((item) =>
                          item.id === c.id
                            ? { ...item, name: e.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={busy}
                  />
                </label>
                <label className="category-price-field">
                  <span className="mobile-field-label">الشحن (درهم)</span>
                  {needsManualPrice(c) ? (
                    <span className="field-help">يُدخل السعر مع كل طرد</span>
                  ) : (
                    <input
                      {...field(`categories.${i}.price`)}
                      type="number"
                      inputMode="decimal"
                      aria-label={`سعر شحن ${c.name}`}
                      min={0}
                      max={10000}
                      step="0.01"
                      required
                      value={c.price}
                      onChange={(e) =>
                        setCategories((v) =>
                          v.map((item) =>
                            item.id === c.id
                              ? { ...item, price: Number(e.target.value) }
                              : item,
                          ),
                        )
                      }
                      disabled={busy}
                    />
                  )}
                </label>
                <label className="category-toggle">
                  <input
                    type="checkbox"
                    aria-label={`تفعيل ${c.name}`}
                    checked={c.active}
                    onChange={(e) =>
                      setCategories((v) =>
                        v.map((item) =>
                          item.id === c.id
                            ? { ...item, active: e.target.checked }
                            : item,
                        ),
                      )
                    }
                    disabled={busy}
                  />
                  <span className="mobile-field-label">مفعّلة</span>
                </label>
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label={`حذف فئة ${c.name}`}
                  disabled={busy || categories.length === 1}
                  onClick={() =>
                    setCategories((v) => v.filter((item) => item.id !== c.id))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-link add-category"
              disabled={busy || categories.length >= 50}
              onClick={() =>
                setCategories((v) => [
                  ...v,
                  {
                    id: clientId(),
                    name: "",
                    price: 20,
                    active: true,
                  },
                ])
              }
            >
              <Plus size={16} />
              إضافة فئة جديدة
            </button>
          </section>
          <section className="panel form-panel">
            <div className="form-section-title">
              <span className="section-icon">
                <Settings2 size={21} />
              </span>
              <div>
                <h2>نسبة العمولة</h2>
                <p>تُطبق على اللوائح الجديدة فقط</p>
              </div>
            </div>
            <div className="commission-input">
              <input
                {...field("commissionRate")}
                aria-label="نسبة العمولة"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                value={settings.commissionRate}
                onChange={(e) => edit("commissionRate", Number(e.target.value))}
                required
                disabled={busy}
              />
              <span>%</span>
            </div>
            <p className="field-help">
              تُكتسب العمولة بعد تأكيد دفع اللائحة بزر «خلصت».
            </p>
          </section>
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Save size={18} />
            )}
            حفظ الإعدادات
          </button>
        </div>
        <aside>
          <div className="settings-note">
            <span className="section-icon">
              <Check size={22} />
            </span>
            <h3>سجلاتك السابقة محفوظة</h3>
            <p>
              تغييرات الأسعار والفئات ونسبة العمولة تسري على اللوائح الجديدة.
              تبقى القيم المحفوظة مع كل لائحة كما هي.
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
