type LogLevel = "info" | "warn" | "error" | "debug";

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  return JSON.stringify(entry);
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(formatMessage("info", message, meta));
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(formatMessage("warn", message, meta));
  },

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(formatMessage("error", message, meta));
  },

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(formatMessage("debug", message, meta));
  },
};
