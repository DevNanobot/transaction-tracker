import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../config/supabase.js";
import type { SupabaseSwapRow } from "../models/SwapTrade.js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseConfig.url, supabaseConfig.secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return client;
}

export async function upsertSwap(row: SupabaseSwapRow): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("swaps").upsert(row, {
    onConflict: "tx_hash,log_index",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

export async function getSwaps(
  limit: number,
  offset: number
): Promise<SupabaseSwapRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("swaps")
    .select("*")
    .order("block_number", { ascending: false })
    .order("log_index", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  return (data ?? []) as SupabaseSwapRow[];
}

export async function countSwaps(): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from("swaps")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`Supabase count failed: ${error.message}`);
  }

  return count ?? 0;
}

/** @deprecated use getSwaps */
export async function getRecentSwaps(limit: number): Promise<SupabaseSwapRow[]> {
  return getSwaps(limit, 0);
}

export async function pingSupabase(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("swaps").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
