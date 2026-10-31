import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const stage = path.join(root, ".android-web");
// Only this generated directory is replaced; the working Next.js app stays intact.
if (path.dirname(stage) !== root || path.basename(stage) !== ".android-web")
  throw new Error("Unexpected Android staging directory");
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(path.join(root, "src"), path.join(stage, "src"), {
  recursive: true,
});
await cp(path.join(root, "public"), path.join(stage, "public"), {
  recursive: true,
});
for (const name of ["tsconfig.json", "postcss.config.mjs", "package.json"])
  await cp(path.join(root, name), path.join(stage, name));
await writeFile(
  path.join(stage, "next.config.mjs"),
  `export default {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root: ${JSON.stringify(root)} },
  env: { NEXT_PUBLIC_NATIVE_APP: "true" }
};\n`,
);
const result = spawnSync(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "build"],
  {
    cwd: stage,
    env: { ...process.env, NEXT_PUBLIC_NATIVE_APP: "true" },
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
for (const page of [
  "index.html",
  "lists/index.html",
  "lists/new/index.html",
  "commissions/index.html",
  "settings/index.html",
])
  await readFile(path.join(stage, "out", page));
console.log(
  "Bundled all five app screens for Android; no hosted server is required.",
);
