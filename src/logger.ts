export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type Meta = Record<string, unknown>;

/**
 * Minimal JSON-lines logger. Callers must never pass secrets, tokens,
 * invitation codes or message text.
 */
export function createLogger(level: LogLevel) {
  const threshold = ORDER[level];

  const write = (current: LogLevel, message: string, meta?: Meta): void => {
    if (ORDER[current] < threshold) {
      return;
    }

    const line = JSON.stringify({
      time: new Date().toISOString(),
      level: current,
      message,
      ...meta,
    });

    if (current === "warn" || current === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (message: string, meta?: Meta): void =>
      write("debug", message, meta),
    info: (message: string, meta?: Meta): void => write("info", message, meta),
    warn: (message: string, meta?: Meta): void => write("warn", message, meta),
    error: (message: string, meta?: Meta): void =>
      write("error", message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
