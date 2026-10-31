import { test } from "node:test";
import assert from "node:assert/strict";
import { seedStore } from "./fixtures/store";
import {
  nextNotification,
  notificationQueue,
} from "../src/lib/notification-queue";

test("arrival queue includes uncollected parcels in list order, even if paid", () => {
  const list = seedStore().lists[0];
  const queue = notificationQueue(list);
  assert.deepEqual(
    queue.parcelIds,
    list.parcels.filter((p) => !p.collected).map((p) => p.id),
  );
  assert.ok(list.parcels.some((p) => p.paid && queue.parcelIds.includes(p.id)));
  assert.equal(queue.index, 0);
});
test("moving to next customer never changes financial, collection, or delivery records", () => {
  const store = seedStore();
  const before = structuredClone(store);
  const queue = notificationQueue(store.lists[0]);
  queue.openedParcelId = queue.parcelIds[0];
  const next = nextNotification(queue);
  assert.equal(next.index, 1);
  assert.equal(next.openedParcelId, null);
  assert.equal(queue.index, 0);
  assert.deepEqual(store, before);
});
test("same-list session resumes progress without storing customer phones or messages", () => {
  const list = seedStore().lists[0];
  const queue = nextNotification(notificationQueue(list));
  queue.openedParcelId = queue.parcelIds[queue.index];
  const serialized = JSON.stringify(queue);
  assert.deepEqual(notificationQueue(list, serialized), queue);
  assert.ok(!serialized.includes("+212"));
  assert.ok(!serialized.includes("السلام"));
});
test("resume skips parcels collected since last visit and preserves the next eligible parcel", () => {
  const list = seedStore().lists[0];
  const queue = nextNotification(notificationQueue(list));
  const current = queue.parcelIds[queue.index];
  list.parcels.find((p) => p.id === queue.parcelIds[0])!.collected = true;
  const restored = notificationQueue(list, JSON.stringify(queue));
  assert.equal(restored.parcelIds[restored.index], current);
  assert.equal(restored.index, 0);
});
test("invalid caches, other lists, duplicate IDs and completed queues start cleanly", () => {
  const list = seedStore().lists[0];
  const fresh = notificationQueue(list);
  for (const saved of [
    "broken-json",
    JSON.stringify({ ...fresh, listId: "other" }),
    JSON.stringify({ ...fresh, index: 999 }),
    JSON.stringify({
      ...fresh,
      parcelIds: [fresh.parcelIds[0], fresh.parcelIds[0]],
    }),
    JSON.stringify({ ...fresh, index: fresh.parcelIds.length }),
  ])
    assert.deepEqual(notificationQueue(list, saved), fresh);
});
test("empty or fully collected list has no notifications; advancing never exceeds the queue", () => {
  const list = seedStore().lists[0];
  list.parcels.forEach((p) => (p.collected = true));
  const queue = notificationQueue(list);
  assert.deepEqual(queue.parcelIds, []);
  assert.equal(nextNotification(queue).index, 0);
});
