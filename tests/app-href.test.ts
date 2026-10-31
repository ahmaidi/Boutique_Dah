import { test } from "node:test";
import assert from "node:assert/strict";
import { appHref, appPathname } from "../src/lib/app-href";

test("Android navigation addresses bundled HTML pages and preserves list queries", () => {
  assert.equal(appHref("/", true), "/index.html");
  assert.equal(appHref("/lists/new", true), "/lists/new/index.html");
  assert.equal(
    appHref("/lists?list=BD-TEST&created=1#parcel", true),
    "/lists/index.html?list=BD-TEST&created=1#parcel",
  );
  assert.equal(appHref("/settings/index.html", true), "/settings/index.html");
  assert.equal(appPathname("/lists/index.html"), "/lists");
  assert.equal(appPathname("/index.html"), "/");
  assert.equal(appPathname("/lists/"), "/lists");
});
test("web and external links keep their original destinations", () => {
  for (const href of [
    "https://wa.me/212600000000?text=test",
    "tel:+212600000000",
    "//example.com/page",
    "#details",
  ])
    assert.equal(appHref(href, true), href);
  assert.equal(appHref("/lists?list=BD-TEST", false), "/lists?list=BD-TEST");
});
