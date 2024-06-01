import { contextBridge, ipcRenderer } from 'electron';
import * as createHTMLElements from './src/helpers/createHTMLElements.js';

contextBridge.exposeInMainWorld('electron', {
    getPath: (name: string) => ipcRenderer.invoke('getPath', name),
    getDirname: () => __dirname,
    createDirectory: (dirName: string) => ipcRenderer.invoke('createDirectory', dirName),
    send: (channel: string, data: any) => ipcRenderer.send(channel, data),
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) =>
        ipcRenderer.on(channel, (event, ...args) => func(...args)),
    once: (channel: string, func: (...args: any[]) => void) =>
        ipcRenderer.once(channel, (event, ...args) => func(...args)),
    removeListener: (channel: string, func: (...args: any[]) => void) =>
        ipcRenderer.removeListener(channel, func),
    sendSync: (channel: string, data: any) => ipcRenderer.sendSync(channel, data),
    showErrorDialog: (message: string) => ipcRenderer.send('show-error-dialog', message),
    createHTMLElements: createHTMLElements,
});