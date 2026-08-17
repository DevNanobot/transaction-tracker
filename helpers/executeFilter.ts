import { EXECUTE_SELECTOR } from "../config/alchemy.js";

export function isExecuteTransaction(input: string | undefined | null): boolean {
  if (!input || input.length < 10) {
    return false;
  }

  const normalized = input.toLowerCase();
  return normalized.startsWith(EXECUTE_SELECTOR);
}
