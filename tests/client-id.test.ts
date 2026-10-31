import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { clientId } from "../src/lib/client-id";
test("LAN preview creates valid unique UUID v4 keys without randomUUID", () => {
  const original = Object.getOwnPropertyDescriptor(
    globalThis.crypto,
    "randomUUID",
  );
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: undefined,
    configurable: true,
  });
  try {
    const ids = Array.from({ length: 100 }, () => clientId());
    assert.equal(new Set(ids).size, 100);
    for (const id of ids) assert.equal(z.uuid().parse(id), id);
  } finally {
    if (original)
      Object.defineProperty(globalThis.crypto, "randomUUID", original);
    else Reflect.deleteProperty(globalThis.crypto, "randomUUID");
  }
});
