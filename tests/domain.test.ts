import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createList,
  closeList,
  complete,
  normalizePhone,
  outstanding,
  saveSettings,
  settle,
  updateParcel,
  whatsappUrl,
} from "../src/lib/domain";
import { seedStore } from "./fixtures/store";
const request = () => ({
  transactionId: crypto.randomUUID(),
  driver: "سائق الاختبار",
  parcels: [
    {
      reference: "SHIP-00125",
      phone: "0612345678",
      items: [
        { categoryId: "clothes", quantity: 2 },
        { categoryId: "shoes", quantity: 3 },
      ],
    },
  ],
});
test("server calculates prices, ignores browser totals, snapshots names, prices and commission rate", () => {
  const store = seedStore();
  const list = createList(store, { ...request(), total: 1 });
  assert.equal(list.total, 115);
  assert.equal(list.parcels[0].phone, "+212612345678");
  saveSettings(store, {
    ...store.settings,
    commissionRate: 20,
    categories: store.categories.map((c) => ({ ...c, price: 999 })),
  });
  assert.equal(list.total, 115);
  assert.equal(list.parcels[0].items[0].unitPrice, 20);
  assert.equal(list.commissionRate, 10);
});
test("list creation is idempotent with the same transaction ID", () => {
  const store = seedStore();
  const input = request();
  const first = createList(store, input);
  const size = store.lists.length;
  assert.equal(createList(store, input).id, first.id);
  assert.equal(store.lists.length, size);
});
test("Diyar prices vary per parcel and preserve shipping and commission snapshots", () => {
  const store = seedStore();
  store.categories.push({
    id: "diyar",
    name: " ديار ",
    price: 999,
    active: true,
  });
  const input = request();
  const list = createList(store, {
    ...input,
    parcels: [
      {
        ...input.parcels[0],
        items: [{ categoryId: "diyar", quantity: 2, unitPrice: 37.25 }],
      },
      {
        ...input.parcels[0],
        reference: "DI-2",
        items: [{ categoryId: "diyar", quantity: 1, unitPrice: 80 }],
      },
    ],
  });
  assert.equal(list.parcels[0].total, 74.5);
  assert.equal(list.parcels[1].total, 80);
  assert.equal(list.total, 154.5);
  store.categories.find((c) => c.id === "diyar")!.price = 500;
  assert.equal(list.parcels[0].items[0].unitPrice, 37.25);
  for (const parcel of list.parcels)
    updateParcel(store, { parcelId: parcel.id, paid: true, collected: true });
  assert.equal(
    store.commissions.some((c) => c.listId === list.id),
    false,
  );
  closeList(store, { listId: list.id });
  assert.equal(
    store.commissions.find((c) => c.listId === list.id)!.amount,
    15.45,
  );
});
test("Diyar requires a valid explicit price; ordinary categories keep their fixed price", () => {
  const store = seedStore();
  store.categories.push({ id: "diyar", name: "ديار", price: 99, active: true });
  for (const unitPrice of [undefined, "", -1, 1.999, 10001, NaN, Infinity]) {
    const input = request();
    assert.throws(() =>
      createList(store, {
        ...input,
        parcels: [
          {
            ...input.parcels[0],
            items: [{ categoryId: "diyar", quantity: 1, unitPrice }],
          },
        ],
      }),
    );
  }
  const input = request();
  const list = createList(store, {
    ...input,
    parcels: [
      {
        ...input.parcels[0],
        items: [{ categoryId: "clothes", quantity: 2, unitPrice: 1 }],
      },
    ],
  });
  assert.equal(list.total, 40);
});
test("manual parcel codes preserve leading zeros and appear in WhatsApp drafts", () => {
  const store = seedStore();
  const input = request();
  input.parcels[0].reference = "  000125-A  ";
  const parcel = createList(store, input).parcels[0];
  assert.equal(parcel.reference, "000125-A");
  const message = new URL(
    whatsappUrl(
      parcel.phone,
      parcel.reference,
      parcel.total,
      "https://maps.google.com/",
    ),
  ).searchParams.get("text")!;
  assert.ok(message.includes("000125-A"));
});
test("missing, blank and oversized parcel codes do not create records", () => {
  const store = seedStore();
  const before = structuredClone(store);
  for (const reference of [undefined, "   ", "x".repeat(101)]) {
    const input = request();
    assert.throws(() =>
      createList(store, {
        ...input,
        parcels: [{ ...input.parcels[0], reference }],
      }),
    );
    assert.deepEqual(store, before);
  }
});
test("commission waits for Done after all parcels are paid and collected; repeated Done never duplicates it", () => {
  const store = seedStore();
  const input = request();
  input.parcels.push({
    reference: "SHIP-00126",
    phone: "0712345678",
    items: [{ categoryId: "home", quantity: 1 }],
  });
  const list = createList(store, input);
  const count = store.commissions.length;
  const [a, b] = list.parcels;
  updateParcel(store, { parcelId: a.id, paid: true, collected: true });
  updateParcel(store, { parcelId: b.id, paid: true, collected: false });
  assert.equal(complete(list), false);
  assert.equal(store.commissions.length, count);
  assert.throws(() => closeList(store, { listId: list.id }));
  updateParcel(store, { parcelId: b.id, paid: true, collected: true });
  assert.equal(complete(list), true);
  assert.equal(store.commissions.length, count);
  closeList(store, { listId: list.id });
  assert.equal(store.commissions.length, count + 1);
  assert.equal(store.commissions.at(-1)?.amount, 15);
  updateParcel(store, { parcelId: b.id, paid: true, collected: true });
  closeList(store, { listId: list.id });
  assert.equal(store.commissions.length, count + 1);
  assert.throws(() =>
    updateParcel(store, { parcelId: b.id, paid: false, collected: true }),
  );
});
test("settlement preserves historical earned totals and retries do not charge twice", () => {
  const store = seedStore();
  const earned = structuredClone(store.commissions);
  const input = {
    transactionId: crypto.randomUUID(),
    expectedAmount: outstanding(store),
  };
  const first = settle(store, input);
  const length = store.settlements.length;
  assert.equal(outstanding(store), 0);
  assert.equal(settle(store, input).id, first.id);
  assert.equal(store.settlements.length, length);
  assert.deepEqual(store.commissions, earned);
  assert.throws(() =>
    settle(store, { transactionId: crypto.randomUUID(), expectedAmount: 10 }),
  );
});
test("settlement rejects stale balance rather than settling an unreviewed amount", () => {
  const store = seedStore();
  assert.throws(() =>
    settle(store, { transactionId: crypto.randomUUID(), expectedAmount: 1 }),
  );
});
test("Moroccan formats normalize and invalid/international foreign numbers are rejected", () => {
  for (const input of [
    "06 12 34 56 78",
    "+212612345678",
    "00212612345678",
    "212612345678",
  ])
    assert.equal(normalizePhone(input), "+212612345678");
  for (const input of ["123", "+33123456789", "0812345678", "06123456789"])
    assert.throws(() => normalizePhone(input));
  for (const input of ["0712345678", "07 12 34 56 78", "+212712345678", "00212712345678", "212712345678"])
    assert.equal(normalizePhone(input), "+212712345678");
  for (const input of ["0512345678", "+212512345678", "061234567", "07123456789"])
    assert.throws(() => normalizePhone(input));
});

test("invalid mobile numbers identify their parcel field and never create a list", () => {
  const store = seedStore();
  const before = structuredClone(store);
  const input = request(); input.parcels[0].phone = "0512345678";
  try { createList(store, input); assert.fail("Expected mobile validation to fail"); }
  catch (error) {
    assert.ok(error && typeof error === "object" && "issues" in error);
    assert.deepEqual((error as { issues: { path: unknown[] }[] }).issues[0].path, ["parcels", 0, "phone"]);
  }
  assert.deepEqual(store, before);
});

test("new parcel phone input requires exactly ten local digits", () => {
  for (const phone of ["0612345678", "0712345678"]) {
    const store = seedStore();
    const input = request(); input.parcels[0].phone = phone;
    assert.equal(createList(store, input).parcels[0].phone, "+212" + phone.slice(1));
  }
  for (const phone of ["061234567", "06123456789", "+212612345678", "212612345678", "06 12 34 56 78"]) {
    const input = request(); input.parcels[0].phone = phone;
    assert.throws(() => createList(seedStore(), input));
  }
});
test("unknown category, invalid quantity, empty parcels and duplicate category IDs are rejected", () => {
  const store = seedStore();
  const input = request();
  input.parcels[0].items[0].categoryId = "no-category";
  assert.throws(() => createList(store, input));
  assert.throws(() => createList(store, { ...request(), parcels: [] }));
  const bad = request();
  bad.parcels[0].items[0].quantity = -2;
  assert.throws(() => createList(store, bad));
  assert.throws(() =>
    saveSettings(store, {
      ...store.settings,
      categories: [store.categories[0], store.categories[0]],
    }),
  );
});
test("WhatsApp uses international number and total only, with no itemized content", () => {
  const url = new URL(
    whatsappUrl("0612345678", "BD-TEST-001", 115, "https://maps.google.com/"),
  );
  assert.equal(url.pathname, "/212612345678");
  const message = url.searchParams.get("text")!;
  assert.ok(message.includes("BD-TEST-001"));
  assert.ok(message.includes("115 درهم"));
  assert.ok(message.includes("https://maps.google.com/"));
  assert.ok(!message.includes("ملابس"));
  assert.throws(() => whatsappUrl("0612345678", "BD-TEST-001", 115, ""));
});
test("partial status updates preserve the other field and category prices use cent precision", () => {
  const store = seedStore();
  const list = createList(store, request());
  const parcel = list.parcels[0];
  updateParcel(store, { parcelId: parcel.id, paid: true });
  updateParcel(store, { parcelId: parcel.id, collected: true });
  assert.equal(complete(list), true);
  assert.equal(store.commissions.filter((c) => c.listId === list.id).length, 0);
  closeList(store, { listId: list.id });
  assert.equal(store.commissions.filter((c) => c.listId === list.id).length, 1);
  assert.throws(() =>
    saveSettings(store, {
      ...store.settings,
      categories: store.categories.map((c) => ({ ...c, price: 1.999 })),
    }),
  );
});
