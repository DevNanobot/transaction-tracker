import { env } from "./index.js";

export const supabaseConfig = {
  url: env.SUPABASE_URL,
  secretKey: env.supabaseSecretKey,
} as const;
