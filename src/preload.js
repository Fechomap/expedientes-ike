const { contextBridge, ipcRenderer } = require('electron');

// License API
const licenseAPI = {
  validate: async (token) => {
    return await ipcRenderer.invoke('license:validate', token);
  },
  getCurrent: async () => {
    return await ipcRenderer.invoke('license:getCurrent');
  },
  revoke: async (token) => {
    return await ipcRenderer.invoke('license:revoke', token);
  },
  refresh: async () => {
    return await ipcRenderer.invoke('license:refresh');
  },
  getInfo: async () => {
    return await ipcRenderer.invoke('license:getInfo');
  },
  hasValid: async () => {
    return await ipcRenderer.invoke('license:hasValid');
  }
};

// Config API
const configAPI = {
  saveCredentials: async (username, password) => {
    return await ipcRenderer.invoke('config:saveCredentials', { username, password });
  },
  getCredentials: async () => {
    return await ipcRenderer.invoke('config:getCredentials');
  },
  isConfigured: async () => {
    return await ipcRenderer.invoke('config:isConfigured');
  },
  save: async (key, value) => {
    return await ipcRenderer.invoke('config:save', { key, value });
  },
  get: async (key, defaultValue = null) => {
    return await ipcRenderer.invoke('config:get', { key, defaultValue });
  },
  delete: async (key) => {
    return await ipcRenderer.invoke('config:delete', { key });
  },
  getAll: async () => {
    return await ipcRenderer.invoke('config:getAll');
  },
  clear: async () => {
    return await ipcRenderer.invoke('config:clear');
  }
};

// Process API
const processAPI = {
  excel: async (filePath, options = {}) => {
    return await ipcRenderer.invoke('process:excel', { filePath, options });
  },
  expedientes: async (expedientes, options = {}) => {
    return await ipcRenderer.invoke('process:expedientes', { expedientes, options });
  },
  getStatus: async () => {
    return await ipcRenderer.invoke('process:status');
  }
};

// Excel API
const excelAPI = {
  validate: async (filePath) => {
    return await ipcRenderer.invoke('excel:validate', { filePath });
  },
  getInfo: async (filePath) => {
    return await ipcRenderer.invoke('excel:getInfo', { filePath });
  },
  read: async (filePath) => {
    return await ipcRenderer.invoke('excel:read', { filePath });
  }
};

// Report API
const reportAPI = {
  generate: async (expedientes, options = {}) => {
    return await ipcRenderer.invoke('report:generate', { expedientes, options });
  },
  export: async (reportId, format, saveDialog = true) => {
    return await ipcRenderer.invoke('report:export', { reportId, format, saveDialog });
  },
  getAll: async (filters = {}) => {
    return await ipcRenderer.invoke('report:getAll', filters);
  },
  getById: async (reportId) => {
    return await ipcRenderer.invoke('report:getById', { reportId });
  },
  delete: async (reportId) => {
    return await ipcRenderer.invoke('report:delete', { reportId });
  },
  getStatistics: async () => {
    return await ipcRenderer.invoke('report:getStatistics');
  },
  getSupportedFormats: async () => {
    return await ipcRenderer.invoke('report:getSupportedFormats');
  }
};

// Dialog API
const dialogAPI = {
  openFile: async () => {
    console.log('[PRELOAD] dialogAPI.openFile called');
    console.log('[PRELOAD] About to invoke dialog:openFile');
    try {
      const result = await ipcRenderer.invoke('dialog:openFile');
      console.log('[PRELOAD] dialog:openFile result:', result);
      return result;
    } catch (error) {
      console.error('[PRELOAD] dialog:openFile error:', error);
      throw error;
    }
  }
};

// App API
const appAPI = {
  getVersion: async () => {
    return await ipcRenderer.invoke('app:getVersion');
  },
  exit: async () => {
    return await ipcRenderer.invoke('app:exit');
  },
  openConfigWindow: async () => {
    return await ipcRenderer.invoke('app:openConfigWindow');
  }
};

// Window API
const windowAPI = {
  minimize: async () => {
    return await ipcRenderer.invoke('window:minimize');
  },
  close: async () => {
    return await ipcRenderer.invoke('window:close');
  }
};

// Event listeners
const eventAPI = {
  onLicenseValidated: (callback) => {
    ipcRenderer.on('license:validated', (event, data) => callback(data));
  },
  onLicenseInvalid: (callback) => {
    ipcRenderer.on('license:invalid', (event, data) => callback(data));
  },
  onLicenseExpired: (callback) => {
    ipcRenderer.on('license:expired', (event, data) => callback(data));
  },
  onProcessStarted: (callback) => {
    ipcRenderer.on('process:started', (event, data) => callback(data));
  },
  onProcessCompleted: (callback) => {
    ipcRenderer.on('process:completed', (event, data) => callback(data));
  },
  onProcessFailed: (callback) => {
    ipcRenderer.on('process:failed', (event, data) => callback(data));
  },
  onProcessProgress: (callback) => {
    ipcRenderer.on('process:progress', (event, data) => callback(data));
  },
  onExpedienteProcessed: (callback) => {
    ipcRenderer.on('expediente:processed', (event, data) => callback(data));
  },
  onReportGenerated: (callback) => {
    ipcRenderer.on('report:generated', (event, data) => callback(data));
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners();
  }
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  license: licenseAPI,
  config: configAPI,
  process: processAPI,
  excel: excelAPI,
  report: reportAPI,
  dialog: dialogAPI,
  app: appAPI,
  window: windowAPI,
  events: eventAPI,

  // Legacy compatibility methods
  selectFile: dialogAPI.openFile,
  openFile: (filePath) => ipcRenderer.invoke('system:openFile', filePath),
  startProcess: (filePath) => processAPI.excel(filePath),
  onProgress: eventAPI.onProcessProgress,
  verifyLicense: licenseAPI.validate,
  verifyToken: licenseAPI.validate,
  reloadApp: appAPI.exit,
  saveConfig: ({ username, password }) => configAPI.saveCredentials(username, password),
  getAppVersion: appAPI.getVersion,
  
  // Update functions (placeholders for now)
  checkForUpdates: async () => {
    console.log('[PRELOAD] checkForUpdates called - not implemented');
    return { success: false, message: 'Updates not implemented' };
  },
  onUpdateAvailable: (callback) => {
    console.log('[PRELOAD] onUpdateAvailable called - not implemented');
    // Do nothing for now
  },
  onUpdateProgress: (callback) => {
    console.log('[PRELOAD] onUpdateProgress called - not implemented');
    // Do nothing for now
  },
  onUpdateDownloaded: (callback) => {
    console.log('[PRELOAD] onUpdateDownloaded called - not implemented');
    // Do nothing for now
  }
});

// Console logging for debugging
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

console.log = (...args) => {
  originalConsole.log('[RENDERER]', ...args);
};

console.error = (...args) => {
  originalConsole.error('[RENDERER ERROR]', ...args);
};

console.warn = (...args) => {
  originalConsole.warn('[RENDERER WARN]', ...args);
};

console.info = (...args) => {
  originalConsole.info('[RENDERER INFO]', ...args);
};

console.log('Preload script loaded with new architecture API');
console.log('electronAPI exposed:', !!window.electronAPI);
console.log('selectFile method:', typeof window.electronAPI?.selectFile);