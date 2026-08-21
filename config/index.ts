import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    ALCHEMY_KEY: z.string().min(1).transform((v) => v.trim()),
    UNIVERSAL_ROUTER: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .transform((v) => v as `0x${string}`),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    SUPABASE_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    KAFKA_BROKERS: z.string().optional(),
    KAFKA_CLIENT_ID: z.string().min(1).default("transaction-tracker"),
    HOST: z.string().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGIN: z.string().min(1).default("*"),
    API_KEY: z.string().optional(),
  })
  .transform((data) => {
    const supabaseSecretKey =
      data.SUPABASE_SECRET_KEY ??
      data.SUPABASE_KEY ??
      data.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseSecretKey) {
      throw new Error(
        "Invalid environment configuration:\n  SUPABASE_SECRET_KEY: Required (or SUPABASE_KEY / legacy SUPABASE_SERVICE_ROLE_KEY)"
      );
    }

    const kafkaBrokers = data.KAFKA_BROKERS?.trim()
      ? data.KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean)
      : [];

    const apiKey = data.API_KEY?.trim() || undefined;

    if (data.NODE_ENV === "production" && !apiKey) {
      throw new Error(
        "Invalid environment configuration:\n  API_KEY: Required when NODE_ENV=production"
      );
    }

    if (data.NODE_ENV === "production" && data.CORS_ORIGIN === "*") {
      throw new Error(
        "Invalid environment configuration:\n  CORS_ORIGIN: Set explicit frontend origin(s) in production (not *)"
      );
    }

    return {
      ...data,
      supabaseSecretKey,
      kafkaEnabled: kafkaBrokers.length > 0,
      kafkaBrokers,
      apiKey,
      isProduction: data.NODE_ENV === "production",
    };
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  return result.data;
}

export const env = loadEnv();
