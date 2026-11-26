import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RiskCheck } from "./risk";

/*
 * The latest Cournot risk check per coin, saved to .data/risk-checks.json (gitignored) so a page view never spends a
 * Cournot call. Each saved check is also the integration proof: market id, probability, evidence and billing route.
 */

const FILE = join(process.cwd(), ".data", "risk-checks.json");

async function readAll(): Promise<Record<string, RiskCheck>> {
  try { return JSON.parse(await readFile(FILE, "utf8")); } catch { return {}; }
}

export async function loadCheck(coin: string): Promise<RiskCheck | null> {
  return (await readAll())[coin] ?? null;
}

export async function saveCheck(check: RiskCheck) {
  const all = await readAll();
  all[check.coin] = check;
  await mkdir(join(process.cwd(), ".data"), { recursive: true });
  await writeFile(FILE, JSON.stringify(all, null, 2));
}
