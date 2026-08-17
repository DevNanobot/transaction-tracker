import "dotenv/config";
import { pingSupabase, getSupabaseClient } from "../helpers/supabaseClient.js";

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const result = await supabase.from("swaps").select("id").limit(1);

  console.log("pingSupabase:", await pingSupabase());
  console.log("query error:", result.error?.message ?? null);
  console.log("query status:", result.status);
  console.log("row count:", result.data?.length ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
