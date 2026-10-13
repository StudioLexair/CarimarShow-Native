import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
const files = ["public/app", "api", "lib", "scripts", "tests"]
  .flatMap(walk)
  .filter((f) => /\.(mjs|cjs|js)$/.test(f));
for (const file of files)
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
console.log(`Sintaxis correcta: ${files.length} archivos JavaScript.`);
