import { BrowserWindow } from 'electron';

declare const mainWindow: BrowserWindow | null;

export { mainWindow };

declare global {
  interface Window {
    electron: {
      removeAllListeners(arg0: string): unknown;
      createHTMLElements: any;
      getPath(name: string): Promise<string>;
      getDirname(): string;
      createDirectory(dirName: string): Promise<string | "Error">;
      send(channel: string, data: any): void;
      invoke(channel: string, ...args: any[]): Promise<any>;
      on(channel: string, func: (...args: any[]) => void): void;
      once(channel: string, func: (...args: any[]) => void): void;
      removeListener(channel: string, func: (...args: any[]) => void): void;
      sendSync(channel: string, data: any): any;
      showErrorDialog(message: string): void;
    };
  }
}
