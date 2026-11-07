#!/usr/bin/env node
// uika — Node entrypoint. The dispatcher owns the estate-root contract.
import process from "node:process";

const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor < 22) {
  console.error(`uika requires Node.js >= 22 (current: ${process.version}). Please upgrade Node.js.`);
  process.exit(1);
}

await import(new URL("../src/uika.mjs", import.meta.url).href);
