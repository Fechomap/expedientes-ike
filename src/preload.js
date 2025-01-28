// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: async () => {
    const result = await ipcRenderer.invoke('dialog:openFile');
    return result;
  },
  startProcess: async (filePath) => {
    console.log(`startProcess invoked with filePath: ${filePath}`);
    const result = await ipcRenderer.invoke('process:start', filePath);
    return result;
  },
  onProgress: (callback) => {
    ipcRenderer.on('process:progress', (event, data) => {
      console.log(`onProgress event received with data: ${JSON.stringify(data)}`);
      callback(data);
    });
  },
  verifyLicense: async (token) => {
    console.log(`verifyLicense invoked with token: ${token}`);
    const result = await ipcRenderer.invoke('license:verify', token);
    return result;
  },
  verifyToken: async (token) => {
    console.log(`verifyToken invoked with token: ${token}`);
    const result = await ipcRenderer.invoke('token:verify', token);
    return result;
  },
  reloadApp: async () => {
    console.log('reloadApp invoked');
    const result = await ipcRenderer.invoke('app:reload');
    return result;
  },
  saveConfig: async (credentials) => {
    console.log(`saveConfig invoked with credentials: ${JSON.stringify(credentials)}`);
    const result = await ipcRenderer.invoke('save-config', credentials);
    return result;
  }
});