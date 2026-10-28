#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { PINNED_P5_VERSION } from "./p5-version.mjs";
import { P5_RUNTIME_COMPAT_MARKER } from "./p5-runtime-compat.mjs";

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
  const start = src.indexOf("const _p = [");
  const end = src.indexOf("\n];", start);
  if (start === -1 || end === -1) {
    throw new Error("Could not parse p5Source.ts");
  }
  const body = src.slice(start + "const _p = [".length, end);
  return JSON.parse(`[${body}]`).join("");
}

// p5 v1 curve helpers were renamed in v2. Course code must never use them.
const P5_V1_ONLY_SYMBOLS = new Map([
  ["curve", "spline"],
  ["curvePoint", "splinePoint"],
  ["curveTangent", "splineTangent"],
  ["curveTightness", "splineProperty"],
  ["curveVertex", "splineVertex"],
  ["curveDetail", "splineProperty"],
]);

function validateCourseCode(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateCourseCode(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if ((key === "startingCode" || key === "solution") && typeof child === "string") {
      for (const [name, replacement] of P5_V1_ONLY_SYMBOLS) {
        if (new RegExp(`\\b${name}\\s*\\(`).test(child)) {
          throw new Error(
            `${childLocation} uses p5 v1 ${name}(); use ${replacement}() instead`
          );
        }
      }
      continue;
    }
    validateCourseCode(child, childLocation);
  }
}

function validateP5Source(source) {
  if (!source.startsWith(`/*! p5.js v${PINNED_P5_VERSION}`)) {
    throw new Error(`p5 source does not match pinned version ${PINNED_P5_VERSION}`);
  }
  if (!source.includes(P5_RUNTIME_COMPAT_MARKER)) {
    throw new Error("p5 source is missing the ES5 compatibility shim");
  }
  if (!source.trimEnd().endsWith(");")) {
    throw new Error("p5 source is truncated");
  }
  if (source.length < 100_000) {
    throw new Error(`p5 source is incomplete (${source.length} chars)`);
  }
}

async function main() {
  ensureDir(OUT_DIR);

  if (!fs.existsSync(path.resolve("./p5Source.ts"))) {
    run("node bundle-p5.mjs");
  }
  if (!fs.existsSync(path.resolve("./reference.generated.json"))) {
    run("node generate-reference.mjs");
  }

  const p5SourcePath = fs.existsSync(path.resolve("./p5Source.ts"))
    ? path.resolve("./p5Source.ts")
    : path.resolve("../p5Source.ts");
  const refPath = fs.existsSync(path.resolve("./reference.generated.json"))
    ? path.resolve("./reference.generated.json")
    : path.resolve("../reference.generated.json");
  const p5AssetsPath = fs.existsSync(path.resolve("./p5Assets.generated.json"))
    ? path.resolve("./p5Assets.generated.json")
    : path.resolve("../p5Assets.generated.json");

  const { loadAllCoursesFromFiles } = await import("./build-content-courses.mjs");
  const courses = loadAllCoursesFromFiles();
  validateCourseCode(courses, "courses");
  const reference = JSON.parse(fs.readFileSync(refPath, "utf8"));
  const p5Assets = fs.existsSync(p5AssetsPath)
    ? JSON.parse(fs.readFileSync(p5AssetsPath, "utf8"))
    : {};
  const p5Source = readP5Source();
  validateP5Source(p5Source);

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
