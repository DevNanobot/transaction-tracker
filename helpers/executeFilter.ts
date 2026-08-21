import { EXECUTE_SELECTORS } from "../config/alchemy.js";

export function isExecuteTransaction(input?: string | null): boolean {
  if (!input || input.length < 10) {
    return false;
  }

  return EXECUTE_SELECTORS.includes(input.slice(0, 10).toLowerCase());
}
