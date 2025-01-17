interface Window {
  electron: {
    ipcRenderer: {
      sendMessage(channel: string, args: unknown[]): void;
      on(
        channel: string,
        func: (...args: unknown[]) => void
      ): (() => void) | undefined;
      once(channel: string, func: (...args: unknown[]) => void): void;
    };
    windowControls: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
    };
  };
}

interface Service {
  name: string;
}
