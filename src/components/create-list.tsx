"use client";
import { clientId } from "@/lib/client-id";
import { appHref } from "@/lib/app-href";
import Link from "./app-link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Info,
  LoaderCircle,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
} from "lucide-react";
import { createListSchema, needsManualPrice } from "@/lib/domain";
import { useApp, currency } from "./workspace";
import { PageHeading } from "./ui";
type DraftParcel = {
  key: string;
  reference: string;
  phone: string;
  items: {
    key: string;
    categoryId: string;
    quantity: number;
    unitPrice?: string;
  }[];
};
export function CreateList() {
  const { data, mutate } = useApp();
  const [driver, setDriver] = useState("");
  const [parcels, setParcels] = useState<DraftParcel[]>(() => [
    {
      key: clientId(),
      reference: "",
      phone: "",
      items: [{ key: clientId(), categoryId: "", quantity: 1 }],
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const transaction = useRef<string | null>(null);
  const submitting = useRef(false);
  if (!data) return null;
  const categories = data.categories.filter((c) => c.active);
  function addParcel() {
    setParcels((current) => [
      ...current,
      {
        key: clientId(),
        reference: "",
        phone: "",
        items: [
          {
            key: clientId(),
            categoryId: categories[0]?.id ?? "",
            quantity: 1,
          },
        ],
      },
    ]);
  }
  function update(key: string, fn: (p: DraftParcel) => DraftParcel) {
    setParcels((current) => current.map((p) => (p.key === key ? fn(p) : p)));
  }
  const itemPrice = (item: DraftParcel["items"][number]) => {
    const category = categories.find((c) => c.id === item.categoryId);
    return category && needsManualPrice(category)
      ? Number(item.unitPrice || 0)
      : (category?.price ?? 0);
  };
  const subtotal = (p: DraftParcel) =>
    p.items.reduce((s, item) => s + itemPrice(item) * item.quantity, 0);
  const total = parcels.reduce((s, p) => s + subtotal(p), 0);
  function draftInput(transactionId = "00000000-0000-4000-8000-000000000000") {
    return {
      transactionId,
      driver,
      parcels: parcels.map((p) => ({
        reference: p.reference,
        phone: p.phone,
        items: p.items.map((item) => ({
          categoryId: item.categoryId,
          quantity: item.quantity,
          ...(needsManualPrice(categories.find((c) => c.id === item.categoryId) ?? { name: "" })
            ? { unitPrice: item.unitPrice?.trim() ? Number(item.unitPrice) : undefined }
            : {}),
        })),
      })),
    };
  }
  function collectErrors() {
    const errors: Record<string, string> = {};
    const result = createListSchema.safeParse(draftInput());
    if (!result.success) for (const issue of result.error.issues)
      errors[issue.path.join(".")] ??= issue.message;
    const savedReferences = new Set(data!.lists.flatMap((list) => list.parcels.map((p) => p.reference)));
    const counts = new Map<string, number>();
    for (const parcel of parcels) counts.set(parcel.reference.trim(), (counts.get(parcel.reference.trim()) ?? 0) + 1);
    parcels.forEach((parcel, index) => {
      const reference = parcel.reference.trim();
      if (reference && (savedReferences.has(reference) || (counts.get(reference) ?? 0) > 1))
        errors[`parcels.${index}.reference`] = "كود الطرد مستعمل من قبل؛ أدخل كوداً مختلفاً";
      parcel.items.forEach((item, itemIndex) => {
        if (needsManualPrice(categories.find((c) => c.id === item.categoryId) ?? { name: "" }) && !item.unitPrice?.trim())
          errors[`parcels.${index}.items.${itemIndex}.unitPrice`] = "أدخل سعر شحن ديار لهذا الطرد";
      });
    });
    return errors;
  }
  const fieldErrors = attempted ? collectErrors() : {};
  const field = (name: string) => ({
    name,
    "aria-invalid": fieldErrors[name] ? true as const : undefined,
    "aria-describedby": fieldErrors[name] ? `error-${name}` : undefined,
  });
  const fieldMessage = (name: string) => fieldErrors[name]
    ? <p id={`error-${name}`} className="field-error">{fieldErrors[name]}</p> : null;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    setAttempted(true);
    const errors = collectErrors();
    if (Object.keys(errors).length) {
      setError("راجع الحقول المحددة بالأحمر وأكمل البيانات المطلوبة");
      const form = event.currentTarget as HTMLFormElement;
      const first = form.elements.namedItem(Object.keys(errors)[0]) as HTMLElement | null;
      first?.focus();
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    submitting.current = true;
    setBusy(true);
    transaction.current ??= clientId();
    try {
      const result = await mutate("lists", draftInput(transaction.current));
      const list = result.lists.find(
        (l) => l.transactionId === transaction.current,
      );
      window.location.assign(
        new URL(
          appHref("/lists?list=" + list?.id + "&created=1"),
          window.location.origin,
        ).href,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  return (
    <>
      <Link className="back-link" href="/lists">
        <ArrowRight size={16} />
        العودة إلى اللوائح
      </Link>
      <PageHeading
        title="إنشاء لائحة جديدة"
        description="أضف بيانات السائق والطرود، وسنتولى حساب الشحن."
        action={
          <span className="step-indicator">
            <span>١</span>بيانات اللائحة <i />{" "}
            <span className="inactive">٢</span>الحفظ والمتابعة
          </span>
        }
      />
      <form onSubmit={submit} noValidate className="create-layout">
        <div className="create-main">
          <section className="panel form-panel">
            <div className="form-section-title">
              <span className="section-icon">
                <Truck size={21} />
              </span>
              <div>
                <h2>بيانات السائق</h2>
                <p>من المسؤول عن توصيل هذه اللائحة؟</p>
              </div>
              <span className="required-note">* حقول مطلوبة</span>
            </div>
            <label className="field-label" htmlFor="driver">
              اسم السائق <em>*</em>
            </label>
            <div className="input-with-icon">
              <Truck size={18} />
              <input
                {...field("driver")}
                id="driver"
                placeholder="مثال: محمد الأمين"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
                minLength={2}
                maxLength={80}
                required
                disabled={busy}
              />
            </div>
            {fieldMessage("driver")}
          </section>
          <div className="section-heading parcel-section-heading">
            <h2>
              طرود اللائحة <span className="count-chip">{parcels.length}</span>
            </h2>
            <button
              type="button"
              className="button outline small"
              onClick={addParcel}
              disabled={
                busy || parcels.length >= 100 || categories.length === 0
              }
            >
              <Plus size={16} />
              إضافة طرد
            </button>
          </div>
          {parcels.map((parcel, index) => (
            <section key={parcel.key} className="panel parcel-form">
              <div className="parcel-form-heading">
                <span className="parcel-number">
                  <Package size={18} />
                  الطرد <bdi>{String(index + 1).padStart(2, "0")}</bdi>
                </span>
                <span className="parcel-form-total">
                  {currency(subtotal(parcel))} <small>د.م</small>
                </span>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`حذف الطرد ${index + 1}`}
                  onClick={() =>
                    setParcels((current) =>
                      current.filter((p) => p.key !== parcel.key),
                    )
                  }
                  disabled={busy || parcels.length === 1}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="parcel-form-body">
                <label
                  className="field-label"
                  htmlFor={`reference-${parcel.key}`}
                >
                  كود الطرد <em>*</em>
                </label>
                <input
                  {...field(`parcels.${index}.reference`)}
                  id={`reference-${parcel.key}`}
                  type="text"
                  dir="auto"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="مثال: DAH-00125"
                  value={parcel.reference}
                  onChange={(e) =>
                    update(parcel.key, (p) => ({
                      ...p,
                      reference: e.target.value,
                    }))
                  }
                  required
                  maxLength={100}
                  disabled={busy}
                />
                {fieldMessage(`parcels.${index}.reference`)}
                <p className="field-help">
                  أدخل الكود المكتوب على الطرد كما هو.
                </p>
                <label className="field-label" htmlFor={`phone-${parcel.key}`}>
                  رقم هاتف الزبون <em>*</em>
                </label>
                <div className="phone-input">
                  <input
                    {...field(`parcels.${index}.phone`)}
                    id={`phone-${parcel.key}`}
                    type="tel"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="0612345678"
                    value={parcel.phone}
                    onChange={(e) =>
                      update(parcel.key, (p) => ({
                        ...p,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    required
                    minLength={10}
                    maxLength={10}
                    pattern="0[67][0-9]{8}"
                    disabled={busy}
                  />
                </div>
                {fieldMessage(`parcels.${index}.phone`)}
                <p className="field-help">
                  ١٠ أرقام بالضبط تبدأ بـ 06 أو 07، دون إضافة +212.
                </p>
                <div className="item-labels">
                  <span>
                    محتوى الطرد <em>*</em>
                  </span>
                  <span>الكمية</span>
                  <span>المبلغ</span>
                  <span />
                </div>
                {parcel.items.map((item, itemIndex) => (
                  <div key={item.key} className="item-entry">
                    <div className="item-row">
                      <select
                        {...field(`parcels.${index}.items.${itemIndex}.categoryId`)}
                        aria-label={`فئة المحتوى للطرد ${index + 1}`}
                        required
                        value={item.categoryId}
                        onChange={(e) =>
                          update(parcel.key, (p) => ({
                            ...p,
                            items: p.items.map((v) =>
                              v.key === item.key
                                ? {
                                    ...v,
                                    categoryId: e.target.value,
                                    unitPrice: undefined,
                                  }
                                : v,
                            ),
                          }))
                        }
                        disabled={busy}
                      >
                        <option value="" disabled>
                          اختر فئة المحتوى
                        </option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ·{" "}
                            {needsManualPrice(c)
                              ? "سعر يدوي"
                              : `${currency(c.price)} د.م`}
                          </option>
                        ))}
                      </select>
                      <label className="item-quantity">
                        <span className="mobile-field-label">الكمية</span>
                        <input
                          {...field(`parcels.${index}.items.${itemIndex}.quantity`)}
                          aria-label={`كمية ${categories.find((c) => c.id === item.categoryId)?.name || "المحتوى"}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            update(parcel.key, (p) => ({
                              ...p,
                              items: p.items.map((v) =>
                                v.key === item.key
                                  ? {
                                      ...v,
                                      quantity:
                                        e.target.value === ""
                                          ? 0
                                          : Number(e.target.value),
                                    }
                                  : v,
                              ),
                            }))
                          }
                          disabled={busy}
                        />
                      </label>
                      <span className="item-amount">
                        <span className="mobile-field-label">المجموع</span>
                        {currency(itemPrice(item) * item.quantity)}{" "}
                        <small>د.م</small>
                      </span>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label="حذف الفئة"
                        disabled={busy || parcel.items.length === 1}
                        onClick={() =>
                          update(parcel.key, (p) => ({
                            ...p,
                            items: p.items.filter((v) => v.key !== item.key),
                          }))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {fieldMessage(`parcels.${index}.items.${itemIndex}.categoryId`)}
                    {fieldMessage(`parcels.${index}.items.${itemIndex}.quantity`)}
                    {needsManualPrice(
                      categories.find((c) => c.id === item.categoryId) ?? {
                        name: "",
                      },
                    ) && (
                      <label className="manual-item-price">
                        <span className="field-label">
                          سعر شحن ديار للقطعة (درهم) <em>*</em>
                        </span>
                        <input
                          {...field(`parcels.${index}.items.${itemIndex}.unitPrice`)}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={10000}
                          step="0.01"
                          required
                          placeholder="أدخل السعر لهذا الطرد"
                          value={item.unitPrice ?? ""}
                          disabled={busy}
                          onChange={(e) =>
                            update(parcel.key, (p) => ({
                              ...p,
                              items: p.items.map((v) =>
                                v.key === item.key
                                  ? { ...v, unitPrice: e.target.value }
                                  : v,
                              ),
                            }))
                          }
                        />
                        {fieldMessage(`parcels.${index}.items.${itemIndex}.unitPrice`)}
                        <span className="field-help">
                          يُضرب السعر في الكمية، ويُحفظ مع هذا الطرد فقط.
                        </span>
                      </label>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="text-link add-category"
                  disabled={busy || parcel.items.length >= 20}
                  onClick={() =>
                    update(parcel.key, (p) => ({
                      ...p,
                      items: [
                        ...p.items,
                        {
                          key: clientId(),
                          categoryId: categories[0]?.id ?? "",
                          quantity: 1,
                        },
                      ],
                    }))
                  }
                >
                  <Plus size={15} />
                  إضافة فئة أخرى لهذا الطرد
                </button>
              </div>
            </section>
          ))}
          <button
            type="button"
            className="add-parcel-large"
            disabled={busy || parcels.length >= 100 || categories.length === 0}
            onClick={addParcel}
          >
            <Plus size={20} />
            إضافة طرد جديد
          </button>
        </div>
        <aside className="create-summary">
          <section className="panel summary-panel">
            <div className="form-section-title">
              <span className="section-icon">
                <ClipboardList size={21} />
              </span>
              <h2>ملخص اللائحة</h2>
            </div>
            <div className="summary-line">
              <span>السائق</span>
              <strong>{driver || "لم يُحدد بعد"}</strong>
            </div>
            <div className="summary-line">
              <span>عدد الطرود</span>
              <strong>{parcels.length} طرود</strong>
            </div>
            <div className="summary-line">
              <span>عدد القطع</span>
              <strong>
                {parcels.reduce(
                  (s, p) => s + p.items.reduce((v, i) => v + i.quantity, 0),
                  0,
                )}{" "}
                قطع
              </strong>
            </div>
            <div className="summary-total">
              <span>إجمالي الشحن</span>
              <strong>
                {currency(total)} <small>درهم</small>
              </strong>
            </div>
            <div className="summary-info">
              <Info size={17} />
              <p>
                تُحسب الأسعار تلقائياً حسب الفئة والكمية، وتُحفظ السجلات على هذا
                الجهاز.
              </p>
            </div>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary submit-list"
              disabled={busy || categories.length === 0}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Check size={18} />
              )}{" "}
              {busy ? "جارٍ إنشاء اللائحة…" : "إنشاء اللائحة"}
              <ArrowLeft size={17} />
            </button>
            <p className="save-note">
              <ShieldCheck size={14} />
              محفوظ على هذا الجهاز
            </p>
          </section>
          <div className="price-note">
            <Package size={22} />
            <h3>سعر اليوم، محفوظ دائماً.</h3>
            <p>
              نحفظ نسخة من أسعار الفئات مع كل طرد. تعديل الأسعار لاحقاً لا يغيّر
              لوائحك السابقة.
            </p>
            <Link href="/settings">
              إدارة الفئات والأسعار <ArrowLeft size={14} />
            </Link>
          </div>
        </aside>
      </form>
    </>
  );
}
