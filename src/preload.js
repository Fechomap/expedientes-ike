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
    console.log(`verifyToken invocado con token: ${token}`);
    const result = await ipcRenderer.invoke('token:verify', token);
    console.log(`Resultado de verificación: ${JSON.stringify(result)}`);
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
  },
  // Nuevas funciones para actualizaciones
  checkForUpdates: async () => {
    console.log('checkForUpdates invoked');
    const result = await ipcRenderer.invoke('check-for-updates');
    return result;
  },
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => {
      callback(info);
    });
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, progressObj) => {
      callback(progressObj);
    });
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => {
      callback(info);
    });
  }
});