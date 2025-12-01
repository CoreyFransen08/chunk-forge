const isDevelopment = import.meta.env.MODE === 'development';

class Logger {
  log(...args: any[]) {
    if (isDevelopment) {
      console.log(...args);
    }
  }

  info(...args: any[]) {
    if (isDevelopment) {
      console.info(...args);
    }
  }

  warn(...args: any[]) {
    if (isDevelopment) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    if (isDevelopment) {
      console.error(...args);
    }
  }

  debug(...args: any[]) {
    if (isDevelopment) {
      console.debug(...args);
    }
  }

  table(data: any) {
    if (isDevelopment) {
      console.table(data);
    }
  }

  group(label: string) {
    if (isDevelopment) {
      console.group(label);
    }
  }

  groupEnd() {
    if (isDevelopment) {
      console.groupEnd();
    }
  }
}

export const logger = new Logger();
