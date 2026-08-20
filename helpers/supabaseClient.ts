import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../config/supabase.js";
import type { SupabaseAcceleratedSwapRow, SupabaseSwapRow } from "../models/SwapTrade.js";

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

export async function upsertSwaps(rows: SupabaseSwapRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase.from("swaps").upsert(rows, {
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

export async function upsertAcceleratedSwaps(
  rows: SupabaseAcceleratedSwapRow[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase.from("swaps_accelerated").upsert(rows, {
    onConflict: "tx_hash,log_index,nonce",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(`Supabase accelerated upsert failed: ${error.message}`);
  }
}

export async function getAcceleratedSwaps(
  limit: number,
  offset: number
): Promise<SupabaseAcceleratedSwapRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("swaps_accelerated")
    .select("*")
    .order("block_number", { ascending: false })
    .order("log_index", { ascending: false })
    .order("nonce", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Supabase accelerated query failed: ${error.message}`);
  }

  return (data ?? []) as SupabaseAcceleratedSwapRow[];
}

export async function countAcceleratedSwaps(): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from("swaps_accelerated")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`Supabase accelerated count failed: ${error.message}`);
  }

  return count ?? 0;
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
