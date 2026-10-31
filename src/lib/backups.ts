import { z } from "zod";
import { complete, money, normalizePhone, settingsSchema } from "./domain";
import type { Store } from "./types";
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const id = z.string().min(1).max(100);
const amount = z
  .number()
  .min(0)
  .max(1e12)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-5);
const timestamp = z.iso.datetime();
const item = z.object({
  categoryId: id,
  name: z.string().min(1).max(60),
  quantity: z.number().int().min(1).max(100),
  unitPrice: amount,
});
const parcel = z.object({
  id,
  reference: id,
  phone: z.string().refine((v) => {
    try {
      return normalizePhone(v, true) === v;
    } catch {
      return false;
    }
  }),
  items: z.array(item).min(1).max(20),
  total: amount,
  paid: z.boolean(),
  collected: z.boolean(),
});
const config = settingsSchema.shape;
const storeSchema = z.object({
  revision: z.number().int().min(0),
  lists: z
    .array(
      z.object({
        id,
        driver: z.string().trim().min(2).max(80),
        createdAt: timestamp,
        closedAt: timestamp.optional(),
        parcels: z.array(parcel).min(1).max(100),
        total: amount,
        commissionRate: config.commissionRate,
        transactionId: id,
      }),
    )
    .max(100000),
  categories: config.categories,
  settings: z.object({
    backupEmail: config.backupEmail,
    shopName: config.shopName,
    mapsUrl: config.mapsUrl,
    logo: config.logo,
    commissionRate: config.commissionRate,
  }),
  commissions: z
    .array(z.object({ id, listId: id, amount, earnedAt: timestamp }))
    .max(100000),
  settlements: z
    .array(
      z.object({
        id,
        amount: amount.refine((v) => v > 0),
        createdAt: timestamp,
        transactionId: id,
      }),
    )
    .max(100000),
  audit: z
    .array(
      z.object({
        id,
        action: z.string().min(1).max(100),
        entityId: id,
        createdAt: timestamp,
      }),
    )
    .max(500000),
});
const backupSchema = z.object({
  format: z.literal("boutique-dah-backup"),
  version: z.literal(1),
  exportedAt: timestamp,
  data: storeSchema,
});
export type Backup = z.infer<typeof backupSchema>;

function unique(values: string[]) {
  return new Set(values).size === values.length;
}
export function validateStore(input: unknown): Store {
  const state = storeSchema.parse(input);
  const parcels = state.lists.flatMap((l) => l.parcels);
  if (
    ![
      state.lists.map((l) => l.id),
      state.lists.map((l) => l.transactionId),
      parcels.map((p) => p.id),
      // Older app versions allowed repeated business references. Preserve these
      // records in backups; stable parcel IDs remain unique. New entries reject repeats.
      state.commissions.map((c) => c.id),
      state.commissions.map((c) => c.listId),
      state.settlements.map((s) => s.id),
      state.settlements.map((s) => s.transactionId),
      state.audit.map((a) => a.id),
    ].every(unique)
  )
    throw new Error("تحتوي النسخة على سجلات مكررة");
  for (const list of state.lists) {
    if (list.closedAt && !complete(list))
      throw new Error("تحتوي النسخة على لائحة مغلقة غير مكتملة");
    if (
      list.parcels.some(
        (p) =>
          money(
            p.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
          ) !== p.total,
      ) ||
      money(list.parcels.reduce((sum, p) => sum + p.total, 0)) !== list.total
    )
      throw new Error("مبالغ الشحن في النسخة غير متطابقة");
    const commission = state.commissions.find((c) => c.listId === list.id);
    if (
      (list.closedAt && !commission) ||
      (commission && !complete(list)) ||
      (commission &&
        money((list.total * list.commissionRate) / 100) !== commission.amount)
    )
      throw new Error("سجل النسب في النسخة غير متطابق");
  }
  if (
    state.commissions.some(
      (c) => !state.lists.some((l) => l.id === c.listId),
    ) ||
    money(state.settlements.reduce((sum, s) => sum + s.amount, 0)) >
      money(state.commissions.reduce((sum, c) => sum + c.amount, 0))
  )
    throw new Error("الرصيد المالي في النسخة غير صالح");
  return state;
}
export function makeBackup(state: Store): Backup {
  const backup: Backup = {
    format: "boutique-dah-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: validateStore(state),
  };
  if (
    new TextEncoder().encode(JSON.stringify(backup)).length > MAX_BACKUP_BYTES
  )
    throw new Error("حجم النسخة أكبر من ٢٠ ميغابايت");
  return backup;
}
export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("حجم النسخة أكبر من ٢٠ ميغابايت");
  try {
    const backup = backupSchema.parse(JSON.parse(text));
    return { ...backup, data: validateStore(backup.data) };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError)
      throw new Error(
        "الملف ليس نسخة احتياطية صالحة لبوتيك الداه، أو إصداره غير مدعوم",
      );
    throw error;
  }
}
