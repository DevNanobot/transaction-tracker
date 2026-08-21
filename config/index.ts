import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

function stripEnv(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^["']|["']$/g, "");
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    ALCHEMY_KEY: z.preprocess(stripEnv, z.string().min(1)),
    UNIVERSAL_ROUTER: z.preprocess(
      stripEnv,
      z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .transform((v) => v as `0x${string}`)
    ),
    SUPABASE_URL: z.preprocess(stripEnv, z.string().url()),
    SUPABASE_SECRET_KEY: z.preprocess(stripEnv, z.string().min(1)).optional(),
    SUPABASE_KEY: z.preprocess(stripEnv, z.string().min(1)).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(stripEnv, z.string().min(1)).optional(),
    KAFKA_BROKERS: z.preprocess(stripEnv, z.string()).optional(),
    KAFKA_CLIENT_ID: z.string().min(1).default("transaction-tracker"),
    HOST: z.string().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGIN: z.string().min(1).default("*"),
  })
  .transform((data) => {
    const supabaseSecretKey =
      data.SUPABASE_SECRET_KEY ??
      data.SUPABASE_KEY ??
      data.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseSecretKey) {
      throw new Error("SUPABASE_SECRET_KEY is required");
    }

    const kafkaBrokers = data.KAFKA_BROKERS?.trim()
      ? data.KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean)
      : [];

    return {
      ...data,
      HOST: listenHost(data.NODE_ENV, data.HOST),
      supabaseSecretKey,
      kafkaEnabled: kafkaBrokers.length > 0,
      kafkaBrokers,
      isProduction: data.NODE_ENV === "production",
    };
  });

export type Env = z.infer<typeof envSchema>;

function listenHost(nodeEnv: string, host: string): string {
  if (
    nodeEnv === "production" &&
    (host === "127.0.0.1" || host === "localhost")
  ) {
    return "0.0.0.0";
  }

  return host;
}

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
