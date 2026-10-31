import {
  closeList,
  createList,
  saveSettings,
  settle,
  updateParcel,
} from "./domain";
import { clientId } from "./client-id";
import { emptyStore } from "./empty-store";
import { makeBackup, validateStore } from "./backups";
import type { Store } from "./types";
const DATABASE = "boutique-dah-device";
const TABLE = "records";
export type BackupInfo = {
  lastExportedAt: string | null;
  safetyAvailable: boolean;
};
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("التخزين على الجهاز غير متاح في هذا المتصفح"));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(TABLE))
        request.result.createObjectStore(TABLE);
    };
    request.onerror = () =>
      reject(
        new Error(
          "تعذّر فتح تخزين الجهاز. تحقق من مساحة الهاتف وإعدادات المتصفح.",
        ),
      );
    request.onblocked = () =>
      reject(new Error("أغلق النوافذ الأخرى للتطبيق ثم أعد المحاولة"));
    request.onsuccess = () => resolve(request.result);
  });
}
// Every read/modify/write happens in one IndexedDB transaction, even across browser tabs.
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (table: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let result: T;
    let failure: unknown;
    const tx = db.transaction(TABLE, mode, { durability: "strict" });
    const done = (value: T) => {
      result = value;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      failure ??= new Error(
        "لم يتم الحفظ على الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.",
      );
    };
    tx.onabort = () => {
      db.close();
      reject(failure ?? new Error("لم يتم تأكيد الحفظ على الجهاز"));
    };
    abortErrors.set(tx, (error) => {
      failure = error;
      tx.abort();
    });
    try {
      run(tx.objectStore(TABLE), done);
    } catch (error) {
      failure = error;
      tx.abort();
    }
  });
}
const abortErrors = new WeakMap<IDBTransaction, (error: unknown) => void>();
function readRequest<T>(
  table: IDBObjectStore,
  key: IDBValidKey,
  callback: (value: T | undefined) => void,
) {
  const request = table.get(key);
  request.onsuccess = () => {
    try {
      callback(request.result);
    } catch (error) {
      abortErrors.get(table.transaction)?.(error);
    }
  };
}
export async function readDeviceStore(): Promise<Store> {
  return transaction("readwrite", (table, done) => {
    readRequest<Store>(table, "state", (state) => {
      const value = state ?? emptyStore();
      if (!state) table.put(value, "state");
      done(value);
    });
  });
}
export async function mutateDeviceStore(
  action: string,
  input: unknown,
): Promise<Store> {
  return transaction("readwrite", (table, done) => {
    readRequest<Store>(table, "state", (saved) => {
      const state = saved ?? emptyStore();
      if (action === "lists") createList(state, input);
      else if (action === "close-list") closeList(state, input);
      else if (action === "parcel-status") updateParcel(state, input);
      else if (action === "settlements") settle(state, input);
      else if (action === "settings") saveSettings(state, input);
      else throw new Error("عملية غير معروفة");
      state.revision++;
      table.put(state, "state");
      done(state);
    });
  });
}
export async function replaceDeviceStore(
  input: unknown,
  expectedRevision: number,
): Promise<Store> {
  const incoming = validateStore(input);
  return transaction("readwrite", (table, done) => {
    readRequest<Store>(table, "state", (saved) => {
      const previous = saved ?? emptyStore();
      if (previous.revision !== expectedRevision)
        throw new Error(
          "تغيّرت البيانات منذ فتح التأكيد. راجع النسخة ثم أعد المحاولة.",
        );
      table.put(makeBackup(previous), "restore-safety");
      incoming.revision = previous.revision + 1;
      incoming.audit.push({
        id: clientId(),
        action: "backup.restored",
        entityId: "device",
        createdAt: new Date().toISOString(),
      });
      table.put(incoming, "state");
      done(incoming);
    });
  });
}
export async function deviceBackupInfo(): Promise<BackupInfo> {
  return transaction("readonly", (table, done) => {
    readRequest<string>(table, "last-export", (last) => {
      readRequest(table, "restore-safety", (safety) =>
        done({ lastExportedAt: last ?? null, safetyAvailable: !!safety }),
      );
    });
  });
}
export async function markBackupExported() {
  return transaction<void>("readwrite", (table, done) => {
    table.put(new Date().toISOString(), "last-export");
    done();
  });
}
export async function readSafetyBackup() {
  return transaction<ReturnType<typeof makeBackup> | undefined>(
    "readonly",
    (table, done) =>
      readRequest<ReturnType<typeof makeBackup>>(table, "restore-safety", done),
  );
}
