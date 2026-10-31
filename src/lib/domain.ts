import { z } from "zod";
import { clientId } from "./client-id";
import type { Store, ParcelList } from "./types";

export function normalizePhone(input: string, allowLegacyLandline = false) {
  const digits = input.replace(/[\s().-]/g, "").replace(/^00/, "+");
  const normalized = /^0[5-7]\d{8}$/.test(digits)
    ? "+212" + digits.slice(1)
    : /^212[5-7]\d{8}$/.test(digits)
      ? "+" + digits
      : digits;
  if (!/^\+212[5-7]\d{8}$/.test(normalized))
    throw new Error("أدخل رقم هاتف من ١٠ أرقام يبدأ بـ 06 أو 07، مثل 0612345678");
  if (!allowLegacyLandline && !/^\+212[67]\d{8}$/.test(normalized))
    throw new Error("رقم الهاتف يجب أن يبدأ بـ 06 أو 07");
  return normalized;
}
export const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
export const complete = (list: ParcelList) =>
  list.parcels.length > 0 && list.parcels.every((p) => p.paid && p.collected);
const transactionId = z.string().uuid();
const twoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
export const needsManualPrice = (category: { name: string }) =>
  category.name.trim().normalize("NFC") === "ديار";
export const createListSchema = z.object({
  transactionId,
  driver: z.string().trim().min(2, "أدخل اسم السائق (حرفان على الأقل)").max(80),
  parcels: z
    .array(
      z.object({
        reference: z.string().trim().min(1, "أدخل كود الطرد").max(100),
        phone: z.string().regex(/^0[67]\d{8}$/, "أدخل ١٠ أرقام بالضبط تبدأ بـ 06 أو 07"),
        items: z
          .array(
            z.object({
              categoryId: z.string().min(1, "اختر فئة المحتوى").max(80),
              quantity: z.number().int("أدخل كمية صحيحة").min(1, "الكمية من ١ إلى ١٠٠").max(100, "الكمية من ١ إلى ١٠٠"),
              unitPrice: z
                .number()
                .min(0)
                .max(10000)
                .refine(twoDecimals)
                .optional(),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(100),
});
const statusSchema = z
  .object({
    parcelId: z.string().max(100),
    paid: z.boolean().optional(),
    collected: z.boolean().optional(),
  })
  .refine((v) => v.paid !== undefined || v.collected !== undefined);
const settlementSchema = z.object({
  transactionId,
  expectedAmount: z.number().positive().max(10000000),
});
export const settingsSchema = z.object({
  backupEmail: z.union([z.literal(""), z.email().max(254)]).optional(),
  shopName: z.string().trim().min(2).max(80),
  mapsUrl: z.union([
    z.literal(""),
    z
      .url()
      .refine(
        (v) => /^https:\/\//.test(v),
        "يجب أن يبدأ رابط الموقع بـ https://",
      ),
  ]),
  logo: z
    .string()
    .max(45000)
    .refine(
      (v) =>
        !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    ),
  commissionRate: z.number().min(0).max(100).refine(twoDecimals),
  categories: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().trim().min(1).max(60),
        price: z.number().min(0).max(10000).refine(twoDecimals),
        active: z.boolean(),
      }),
    )
    .min(1)
    .max(50)
    .refine((v) => new Set(v.map((c) => c.id)).size === v.length),
});
function audit(store: Store, action: string, entityId: string) {
  store.audit.push({
    id: clientId(),
    action,
    entityId,
    createdAt: new Date().toISOString(),
  });
}
export function createList(store: Store, input: unknown) {
  const data = createListSchema.parse(input);
  const existing = store.lists.find(
    (l) => l.transactionId === data.transactionId,
  );
  if (existing) return existing;
  const references = new Set(
    store.lists.flatMap((list) => list.parcels.map((parcel) => parcel.reference)),
  );
  for (const parcel of data.parcels) {
    if (references.has(parcel.reference))
      throw new Error(`كود الطرد ${parcel.reference} مستعمل من قبل`);
    references.add(parcel.reference);
  }
  let id: string;
  do {
    id = "BD-" + clientId().slice(0, 8).toUpperCase();
  } while (store.lists.some((list) => list.id === id));
  const parcels = data.parcels.map((p) => {
    const items = p.items.map((item) => {
      const category = store.categories.find(
        (c) => c.id === item.categoryId && c.active,
      );
      if (!category)
        throw new Error("إحدى الفئات غير متاحة. حدّث الصفحة وحاول مجدداً.");
      if (needsManualPrice(category) && item.unitPrice === undefined)
        throw new Error("أدخل سعر الشحن لفئة ديار");
      return {
        categoryId: category.id,
        name: category.name,
        quantity: item.quantity,
        unitPrice: needsManualPrice(category)
          ? item.unitPrice!
          : category.price,
      };
    });
    return {
      id: clientId(),
      reference: p.reference,
      phone: normalizePhone(p.phone),
      items,
      total: money(items.reduce((s, v) => s + v.unitPrice * v.quantity, 0)),
      paid: false,
      collected: false,
    };
  });
  const list: ParcelList = {
    id,
    driver: data.driver,
    createdAt: new Date().toISOString(),
    parcels,
    total: money(parcels.reduce((s, p) => s + p.total, 0)),
    commissionRate: store.settings.commissionRate,
    transactionId: data.transactionId,
  };
  store.lists.unshift(list);
  audit(store, "list.created", id);
  return list;
}
export function updateParcel(store: Store, input: unknown) {
  const data = statusSchema.parse(input);
  const list = store.lists.find((l) =>
    l.parcels.some((p) => p.id === data.parcelId),
  );
  if (!list) throw new Error("الطرد غير موجود");
  const parcel = list.parcels.find((p) => p.id === data.parcelId)!;
  const paid = data.paid ?? parcel.paid,
    collected = data.collected ?? parcel.collected;
  if (
    (list.closedAt || store.commissions.some((c) => c.listId === list.id)) &&
    (!paid || !collected)
  )
    throw new Error(
      "تم احتساب نسبة هذه اللائحة. التصحيح المالي يتطلب قيد تسوية منفصلاً.",
    );
  parcel.paid = paid;
  parcel.collected = collected;
  audit(store, "parcel.status.updated", parcel.id);
  return parcel;
}
export function closeList(store: Store, input: unknown) {
  const { listId } = z
    .object({ listId: z.string().min(1).max(100) })
    .parse(input);
  const list = store.lists.find((l) => l.id === listId);
  if (!list) throw new Error("اللائحة غير موجودة");
  if (!complete(list)) throw new Error("أكمل دفع واستلام جميع الطرود أولاً");
  if (list.closedAt) return list;
  list.closedAt = new Date().toISOString();
  if (!store.commissions.some((c) => c.listId === list.id))
    store.commissions.push({
      id: clientId(),
      listId: list.id,
      amount: money((list.total * list.commissionRate) / 100),
      earnedAt: list.closedAt,
    });
  audit(store, "list.closed", list.id);
  return list;
}
export function outstanding(store: Store) {
  return money(
    store.commissions.reduce((s, c) => s + c.amount, 0) -
      store.settlements.reduce((s, v) => s + v.amount, 0),
  );
}
export function settle(store: Store, input: unknown) {
  const data = settlementSchema.parse(input);
  const existing = store.settlements.find(
    (s) => s.transactionId === data.transactionId,
  );
  if (existing) return existing;
  const amount = outstanding(store);
  if (amount <= 0) throw new Error("لا توجد نسبة مستحقة حالياً");
  if (amount !== data.expectedAmount)
    throw new Error(
      "تغيّر الرصيد المستحق. حدّث البيانات وراجع المبلغ قبل التأكيد.",
    );
  const settlement = {
    id: clientId(),
    amount,
    createdAt: new Date().toISOString(),
    transactionId: data.transactionId,
  };
  store.settlements.unshift(settlement);
  audit(store, "commission.settled", settlement.id);
  return settlement;
}
export function saveSettings(store: Store, input: unknown) {
  const { categories, ...settings } = settingsSchema.parse(input);
  store.settings = settings;
  store.categories = categories;
  audit(store, "settings.updated", "shop");
}
export function whatsappUrl(
  phone: string,
  reference: string,
  total: number,
  mapsUrl: string,
) {
  if (!mapsUrl) throw new Error("أضف رابط موقع المتجر في الإعدادات أولاً");
  const message = `السلام عليكم ورحمة الله وبركاته،\n\n📦 نخبركم أن طردكم رقم ${reference} قد وصل وأصبح جاهزاً للاستلام.\n\n💰 ثمن الشحن الإجمالي المستحق: ${total} درهم\n\n📍 بوتيك الداه – بوجدور، قبالة الضمان الاجتماعي.\n\n🗺️ الموقع: ${mapsUrl}\n\nشكراً لثقتكم وتعاملكم معنا.`;
  return `https://wa.me/${normalizePhone(phone, true).slice(1)}?text=${encodeURIComponent(message)}`;
}
