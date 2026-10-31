import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import {
  readDeviceStore,
  mutateDeviceStore,
  replaceDeviceStore,
  readSafetyBackup,
  deviceBackupInfo,
  markBackupExported,
} from "../src/lib/device-store";
import { makeBackup, parseBackup, validateStore } from "../src/lib/backups";
import { seedStore } from "./fixtures/store";
import { emptyStore } from "../src/lib/empty-store";
import { clientId } from "../src/lib/client-id";
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
const input = () => ({
  transactionId: clientId(),
  driver: "سائق محلي",
  parcels: [
    {
      reference: "000125",
      phone: "0600000000",
      items: [{ categoryId: "clothes", quantity: 2 }],
    },
  ],
});
test("fresh phone starts empty, writes locally and survives reopening the database", async () => {
  const empty = await readDeviceStore();
  assert.equal(empty.lists.length, 0);
  const saved = await mutateDeviceStore("lists", input());
  assert.equal(saved.lists[0].total, 40);
  assert.equal(saved.lists[0].parcels[0].reference, "000125");
  const reopened = await readDeviceStore();
  assert.deepEqual(reopened, saved);
  assert.equal(
    parseBackup(JSON.stringify(makeBackup(reopened))).data.lists[0].parcels[0]
      .reference,
    "000125",
  );
});

test("duplicate references are rejected atomically within and across lists", async () => {
  const request = input();
  request.parcels.push(structuredClone(request.parcels[0]));
  await assert.rejects(mutateDeviceStore("lists", request), /مستعمل/);
  assert.equal((await readDeviceStore()).lists.length, 0);
  const saved = await mutateDeviceStore("lists", input());
  await assert.rejects(mutateDeviceStore("lists", input()), /مستعمل/);
  assert.deepEqual(await readDeviceStore(), saved);
  assert.equal(makeBackup(saved).data.lists.length, 1);
});

test("old records with repeated references can still be exported and restored without losing records", () => {
  const state = seedStore();
  const parcels = state.lists.flatMap((list) => list.parcels);
  assert.ok(parcels.length > 1);
  parcels[1].reference = parcels[0].reference;
  const restored = parseBackup(JSON.stringify(makeBackup(state)));
  assert.deepEqual(restored.data, state);
});

test("legacy 05 phone records remain recoverable after new entries require 06 or 07", () => {
  const state = seedStore();
  state.lists[0].parcels[0].phone = "+212512345678";
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(state))).data, state);
});
test("Done permanently marks a completed list, survives reopening and backups, and is idempotent", async () => {
  let state = await mutateDeviceStore("lists", input());
  const list = state.lists[0];
  await assert.rejects(mutateDeviceStore("close-list", { listId: list.id }));
  assert.equal((await readDeviceStore()).lists[0].closedAt, undefined);
  await mutateDeviceStore("parcel-status", {
    parcelId: list.parcels[0].id,
    paid: true,
  });
  await assert.rejects(mutateDeviceStore("close-list", { listId: list.id }));
  state = await mutateDeviceStore("parcel-status", {
    parcelId: list.parcels[0].id,
    collected: true,
  });
  const financials = {
    commissions: structuredClone(state.commissions),
    settlements: structuredClone(state.settlements),
  };
  state = await mutateDeviceStore("close-list", { listId: list.id });
  const closedAt = state.lists[0].closedAt;
  assert.ok(closedAt);
  state = await mutateDeviceStore("close-list", { listId: list.id });
  assert.equal(state.lists[0].closedAt, closedAt);
  assert.equal(state.audit.filter((a) => a.action === "list.closed").length, 1);
  assert.equal(financials.commissions.length, 0);
  assert.equal(state.commissions.length, 1);
  assert.equal(state.commissions[0].amount, 4);
  assert.deepEqual(state.settlements, financials.settlements);
  const reopened = await readDeviceStore();
  assert.equal(reopened.lists[0].closedAt, closedAt);
  const backup = parseBackup(JSON.stringify(makeBackup(reopened)));
  await replaceDeviceStore(backup.data, reopened.revision);
  assert.equal((await readDeviceStore()).lists[0].closedAt, closedAt);
});
test("backups reject a closed list with unfinished parcels", () => {
  const state = seedStore();
  state.lists[0].closedAt = new Date().toISOString();
  assert.throws(() => validateStore(state));
});
test("completed lists can be backed up before Done without earning a commission", async () => {
  let state = await mutateDeviceStore("lists", input());
  state = await mutateDeviceStore("parcel-status", {
    parcelId: state.lists[0].parcels[0].id,
    paid: true,
    collected: true,
  });
  assert.equal(state.commissions.length, 0);
  const backup = parseBackup(JSON.stringify(makeBackup(state)));
  await replaceDeviceStore(backup.data, state.revision);
  state = await readDeviceStore();
  assert.equal(state.commissions.length, 0);
  assert.equal(state.lists[0].closedAt, undefined);
  await mutateDeviceStore("close-list", { listId: state.lists[0].id });
  assert.equal((await readDeviceStore()).commissions[0].amount, 4);
});
test("old commissions and settlements remain unchanged when confirming a legacy paid list", async () => {
  const old = seedStore();
  await replaceDeviceStore(old, 0);
  const before = await readDeviceStore();
  const listId = before.commissions[0].listId;
  const after = await mutateDeviceStore("close-list", { listId });
  assert.deepEqual(after.commissions, before.commissions);
  assert.deepEqual(after.settlements, before.settlements);
});
test("backup email settings survive local saves and backup restore", async () => {
  const state = await readDeviceStore();
  const saved = await mutateDeviceStore("settings", {
    ...state.settings,
    backupEmail: "warehouse@example.com",
    categories: state.categories,
  });
  const backup = parseBackup(JSON.stringify(makeBackup(saved)));
  assert.equal(backup.data.settings.backupEmail, "warehouse@example.com");
  await replaceDeviceStore(backup.data, saved.revision);
  assert.equal(
    (await readDeviceStore()).settings.backupEmail,
    "warehouse@example.com",
  );
  await assert.rejects(
    mutateDeviceStore("settings", {
      ...saved.settings,
      backupEmail: "invalid",
      categories: saved.categories,
    }),
  );
});
test("failed validation rolls back without modifying any saved records", async () => {
  await mutateDeviceStore("lists", input());
  const before = await readDeviceStore();
  await assert.rejects(
    mutateDeviceStore("lists", {
      ...input(),
      parcels: [
        { phone: "invalid", items: [{ categoryId: "clothes", quantity: 1 }] },
      ],
    }),
  );
  assert.deepEqual(await readDeviceStore(), before);
});
test("manual Diyar prices survive local storage, backup export and restore", async () => {
  const empty = await readDeviceStore();
  await mutateDeviceStore("settings", {
    ...empty.settings,
    categories: [
      ...empty.categories,
      { id: "diyar", name: "ديار", price: 0, active: true },
    ],
  });
  const request = input();
  const saved = await mutateDeviceStore("lists", {
    ...request,
    parcels: [
      {
        ...request.parcels[0],
        items: [{ categoryId: "diyar", quantity: 2, unitPrice: 42.75 }],
      },
    ],
  });
  const backup = parseBackup(JSON.stringify(makeBackup(saved)));
  const parcel = backup.data.lists[0].parcels[0];
  assert.equal(parcel.items[0].unitPrice, 42.75);
  assert.equal(parcel.total, 85.5);
  await replaceDeviceStore(backup.data, saved.revision);
  assert.equal((await readDeviceStore()).lists[0].parcels[0].total, 85.5);
});
test("concurrent retries serialize in IndexedDB and never duplicate lists or settlements", async () => {
  const request = input();
  await Promise.all([
    mutateDeviceStore("lists", request),
    mutateDeviceStore("lists", request),
  ]);
  let state = await readDeviceStore();
  assert.equal(state.lists.length, 1);
  const p = state.lists[0].parcels[0];
  await mutateDeviceStore("parcel-status", {
    parcelId: p.id,
    paid: true,
    collected: true,
  });
  await mutateDeviceStore("close-list", { listId: state.lists[0].id });
  const settlement = { transactionId: clientId(), expectedAmount: 4 };
  await Promise.all([
    mutateDeviceStore("settlements", settlement),
    mutateDeviceStore("settlements", settlement),
  ]);
  state = await readDeviceStore();
  assert.equal(state.commissions.length, 1);
  assert.equal(state.settlements.length, 1);
  assert.equal(state.settlements[0].amount, 4);
});
test("export and import round-trip every snapshot and financial record", () => {
  const state = seedStore();
  const backup = makeBackup(state);
  assert.deepEqual(parseBackup(JSON.stringify(backup)).data, state);
  assert.deepEqual(
    parseBackup(JSON.stringify(makeBackup(emptyStore()))).data,
    emptyStore(),
  );
});
test("malformed files, newer versions, duplicate IDs and invalid financial totals are rejected", () => {
  assert.throws(() => parseBackup("{"));
  assert.throws(() =>
    parseBackup(
      JSON.stringify({ format: "other", version: 1, data: emptyStore() }),
    ),
  );
  const backup = makeBackup(seedStore());
  assert.throws(() => parseBackup(JSON.stringify({ ...backup, version: 2 })));
  const invalid = structuredClone(backup.data);
  invalid.lists[0].total = 1;
  assert.throws(() => validateStore(invalid));
  const duplicate = structuredClone(backup.data);
  duplicate.commissions.push({ ...duplicate.commissions[0], id: clientId() });
  assert.throws(() => validateStore(duplicate));
  const overpaid = structuredClone(backup.data);
  overpaid.settlements[0].amount = 99999;
  assert.throws(() => validateStore(overpaid));
});
test("restore atomically saves a safety copy, preserves original references and rejects stale confirmations", async () => {
  const prior = await mutateDeviceStore("lists", input());
  const backup = makeBackup(seedStore());
  const restored = await replaceDeviceStore(backup.data, prior.revision);
  assert.equal(restored.lists[0].id, backup.data.lists[0].id);
  assert.equal(restored.audit.at(-1)?.action, "backup.restored");
  assert.deepEqual(
    (await readSafetyBackup())?.data,
    parseBackup(JSON.stringify(makeBackup(prior))).data,
  );
  const before = await readDeviceStore();
  await assert.rejects(replaceDeviceStore(backup.data, prior.revision));
  assert.deepEqual(await readDeviceStore(), before);
});
test("invalid restore never overwrites current state or its safety copy", async () => {
  const state = await mutateDeviceStore("lists", input());
  await assert.rejects(replaceDeviceStore({ broken: true }, state.revision));
  assert.deepEqual(await readDeviceStore(), state);
  assert.equal(await readSafetyBackup(), undefined);
});
test("backup metadata records export preparation and safety copy availability", async () => {
  assert.deepEqual(await deviceBackupInfo(), {
    lastExportedAt: null,
    safetyAvailable: false,
  });
  await markBackupExported();
  assert.ok((await deviceBackupInfo()).lastExportedAt);
  const state = await readDeviceStore();
  await replaceDeviceStore(emptyStore(), state.revision);
  assert.equal((await deviceBackupInfo()).safetyAvailable, true);
});
test("a storage write failure aborts both restore and safety-copy changes", async () => {
  const state = await mutateDeviceStore("lists", input());
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    if (key === "state")
      throw new DOMException("Storage full", "QuotaExceededError");
    return original.call(this, value, key);
  };
  try {
    await assert.rejects(replaceDeviceStore(emptyStore(), state.revision));
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  assert.deepEqual(await readDeviceStore(), state);
  assert.equal(await readSafetyBackup(), undefined);
});
