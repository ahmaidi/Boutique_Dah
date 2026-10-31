// Rebuild the native launch drawable using the same bundled Cairo font as the app.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const source = await readFile(
  path.join(
    root,
    "node_modules/@fontsource/cairo/files/cairo-arabic-700-normal.woff",
  ),
);
if (source.toString("ascii", 0, 4) !== "wOFF")
  throw new Error("Expected WOFF font");
const count = source.readUInt16BE(12);
const result = Buffer.alloc(source.readUInt32BE(16));
source.copy(result, 0, 4, 8);
result.writeUInt16BE(count, 4);
const exponent = Math.floor(Math.log2(count));
result.writeUInt16BE(16 * 2 ** exponent, 6);
result.writeUInt16BE(exponent, 8);
result.writeUInt16BE(count * 16 - 16 * 2 ** exponent, 10);
let offset = 12 + count * 16;
let head;
for (let i = 0; i < count; i++) {
  const input = 44 + 20 * i;
  const output = 12 + 16 * i;
  const start = source.readUInt32BE(input + 4);
  const compressed = source.readUInt32BE(input + 8);
  const length = source.readUInt32BE(input + 12);
  source.copy(result, output, input, input + 4);
  result.writeUInt32BE(source.readUInt32BE(input + 16), output + 4);
  result.writeUInt32BE(offset, output + 8);
  result.writeUInt32BE(length, output + 12);
  const bytes = source.subarray(start, start + compressed);
  (compressed < length ? inflateSync(bytes) : bytes).copy(result, offset);
  if (source.toString("ascii", input, input + 4) === "head") head = offset;
  offset += (length + 3) & ~3;
}
if (head === undefined) throw new Error("Missing font header");
result.writeUInt32BE(0, head + 8);
let checksum = 0;
for (let i = 0; i < result.length; i += 4)
  checksum = (checksum + result.readUInt32BE(i)) >>> 0;
result.writeUInt32BE((0xb1b0afba - checksum) >>> 0, head + 8);
const tools = path.join(root, ".android-tools");
await mkdir(tools, { recursive: true });
const font = path.join(tools, "Cairo-bold.ttf");
await writeFile(font, result);
const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, "bin/java.exe")
  : path.join(tools, "jdk/bin/java.exe");
const build = spawnSync(
  java,
  [
    "-Djava.awt.headless=true",
    path.join(root, "scripts/GenerateLaunchBrand.java"),
    font,
    path.join(root, "android/app/src/main/res/drawable/launch_brand.xml"),
    path.join(tools, "launch-preview.png"),
  ],
  { stdio: "inherit" },
);
if (build.error) throw build.error;
process.exit(build.status ?? 1);
