#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { PINNED_P5_VERSION } from "./p5-version.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve("./content");
const PACK_FILE = path.join(OUT_DIR, "pack.json");
const MANIFEST_FILE = path.join(OUT_DIR, "manifest.json");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readP5Source() {
  const srcPath = fs.existsSync(path.resolve("./p5Source.ts")) ? path.resolve("./p5Source.ts") : path.resolve("../p5Source.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  // New format uses _p array
  if (src.includes("export const p5Source")) {
    // Try to eval by extracting array
    const arrayMatch = src.match(/const _p: string\[\] = \[\];([\s\S]*?)export const p5Source/);
    if (arrayMatch) {
      const assignments = arrayMatch[1];
      const tmp = path.resolve("./p5-join.js");
      fs.writeFileSync(tmp, `const _p=[];${assignments}\nprocess.stdout.write(_p.join(""));`);
      const joined = execSync("node p5-join.js", { encoding: "utf8" });
      try { fs.unlinkSync(tmp); } catch {}
      return joined;
    }
  }
  throw new Error("Could not parse p5Source.ts");
}

async function main() {
  ensureDir(OUT_DIR);

  const p5SourcePath = fs.existsSync(path.resolve("./p5Source.ts")) ? path.resolve("./p5Source.ts") : path.resolve("../p5Source.ts");
  const refPath = fs.existsSync(path.resolve("./reference.generated.json")) ? path.resolve("./reference.generated.json") : path.resolve("../reference.generated.json");
  if (!fs.existsSync(p5SourcePath)) {
    run("node bundle-p5.mjs");
  }
  if (!fs.existsSync(refPath)) {
    run("node generate-reference.mjs");
  }

  const { loadAllCoursesFromFiles } = await import("./build-content-courses.mjs");
  const courses = loadAllCoursesFromFiles();
  const reference = JSON.parse(fs.readFileSync(refPath, "utf8"));
  const p5AssetsPath = fs.existsSync(path.resolve("./p5Assets.generated.json")) ? path.resolve("./p5Assets.generated.json") : path.resolve("../p5Assets.generated.json");
  const p5Assets = fs.existsSync(p5AssetsPath)
    ? JSON.parse(fs.readFileSync(p5AssetsPath, "utf8"))
    : {};
  const p5Source = readP5Source();

  const contentVersion =
    process.env.CONTENT_VERSION ||
    new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);

  const pack = {
    schemaVersion: 1,
    contentVersion,
    generatedAt: new Date().toISOString(),
    p5: { version: PINNED_P5_VERSION, source: p5Source },
    p5Assets,
    courses,
    reference: {
      byName: reference.byName,
      functionNames: reference.functionNames,
      metadata: reference.metadata,
    },
  };

  const packJson = JSON.stringify(pack);
  fs.writeFileSync(PACK_FILE, packJson, "utf8");

  const sha256 = crypto.createHash("sha256").update(packJson).digest("hex");
  const manifest = {
    schemaVersion: 1,
    contentVersion,
    generatedAt: pack.generatedAt,
    p5Version: PINNED_P5_VERSION,
    packUrl: "pack.json",
    packSize: Buffer.byteLength(packJson),
    packSha256: sha256,
    courseCount: Array.isArray(courses) ? courses.length : 0,
    symbolCount: reference.metadata?.symbolCount || 0,
  };

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Wrote ${PACK_FILE} (${manifest.packSize} bytes)`);
  console.log(`Wrote ${MANIFEST_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
