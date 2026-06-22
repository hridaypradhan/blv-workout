const isDev = process.env.NODE_ENV === "development";

export const devLogger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    // Keep error logging visible in production as well for debuggability,
    // but centralize it through the logger.
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  }
};
