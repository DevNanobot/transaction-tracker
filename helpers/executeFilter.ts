import { EXECUTE_SELECTORS } from "../config/alchemy.js";

export function isExecuteTransaction(input: string | undefined | null): boolean {
  if (!input || input.length < 10) {
    return false;
  }

  const selector = input.slice(0, 10).toLowerCase();
  return (EXECUTE_SELECTORS as readonly string[]).includes(selector);
}
