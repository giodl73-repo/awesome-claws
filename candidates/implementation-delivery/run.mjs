import { readFile } from "node:fs/promises";
import { acceptance } from "./acceptance.mjs";
const intake = JSON.parse(await readFile(new URL("intake.json", import.meta.url), "utf8"));
console.log(JSON.stringify(acceptance(intake)));
