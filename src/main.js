const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Import new architecture
const DependencyContainer = require('./shared/DependencyContainer');
const LicenseHandler = require('./presentation/ipc/handlers/LicenseHandler');
const ConfigHandler = require('./presentation/ipc/handlers/ConfigHandler');
const ReportHandler = require('./presentation/ipc/handlers/ReportHandler');
const ProcessHandler = require('./presentation/ipc/handlers/ProcessHandler');
const Logger = require('./shared/utils/Logger');
const LicenseEvents = require('./shared/events/events/LicenseEvents');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

class Application {
  constructor() {
    this.logger = Logger.getInstance('Application');
    this.mainWindow = null;
    this.loadingWindow = null;
    this.licenseWindow = null;
    this.configWindow = null;
    this.dependencies = null;
    this.handlers = {};
  }

  async initialize() {
    try {
      this.logger.info('Initializing application');
      
      // Initialize dependency container
      this.dependencies = DependencyContainer.getInstance();
      
      // Initialize IPC handlers
      this.initializeHandlers();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.logger.info('Application initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing application', error);
      throw error;
    }
  }

  initializeHandlers() {
    const licenseService = this.dependencies.get('licenseService');
    const configRepository = this.dependencies.get('configRepository');
    const reportService = this.dependencies.get('reportService');
    const processingService = this.dependencies.get('processingService');
    const excelService = this.dependencies.get('excelService');
    const eventBus = this.dependencies.get('eventBus');

    this.handlers.license = new LicenseHandler(licenseService, eventBus);
    this.handlers.config = new ConfigHandler(configRepository);
    this.handlers.report = new ReportHandler(reportService);

    // Register application-specific handlers
    this.registerApplicationHandlers();

    this.logger.info('IPC handlers initialized');
    
    // Debug: Check if handlers are actually being set
    this.logger.info('Total IPC handle listeners registered:', ipcMain.listenerCount('dialog:openFile'));
  }

  registerApplicationHandlers() {
    ipcMain.handle('app:getVersion', () => app.getVersion());
    
    ipcMain.handle('app:openConfigWindow', async () => {
      try {
        await this.showConfigWindow();
        return { success: true };
      } catch (error) {
        this.logger.error('Error opening config window', error);
        return { success: false, error: error.message };
      }
    });
    
    this.logger.info('Registering dialog:openFile handler');
    ipcMain.handle('dialog:openFile', async () => {
      try {
        this.logger.info('DIALOG HANDLER CALLED - Opening file dialog');
        
        // Use current main window or the focused window
        const targetWindow = this.mainWindow || BrowserWindow.getFocusedWindow();
        
        const result = await dialog.showOpenDialog(targetWindow, {
          properties: ['openFile'],
          filters: [
            { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          this.logger.info('File selected', { filePath: result.filePaths[0] });
          return {
            success: true,
            filePath: result.filePaths[0]
          };
        }

        this.logger.info('No file selected');
        return {
          success: false,
          error: 'No file selected'
        };
      } catch (error) {
        this.logger.error('Error opening file dialog', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    this.logger.info('dialog:openFile handler registered successfully');

    // Handler para abrir archivos del sistema
    ipcMain.handle('system:openFile', async (event, filePath) => {
      try {
        this.logger.info('Opening file with system default application', { filePath });
        
        const { shell } = require('electron');
        await shell.openPath(filePath);
        
        return {
          success: true,
          message: 'File opened successfully'
        };
      } catch (error) {
        this.logger.error('Error opening file', { filePath, error: error.message });
        return {
          success: false,
          error: error.message
        };
      }
    });

    ipcMain.handle('app:exit', () => {
      app.quit();
    });

    ipcMain.handle('window:minimize', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });

    ipcMain.handle('window:close', () => {
      if (this.mainWindow) {
        this.mainWindow.close();
      }
    });
  }

  setupEventListeners() {
    const eventBus = this.dependencies.get('eventBus');

    // License events
    eventBus.subscribe(LicenseEvents.LICENSE_VALIDATED, (data) => {
      this.logger.info('License validated, showing main window');
      this.showMainWindow();
    });

    eventBus.subscribe(LicenseEvents.LICENSE_INVALID, (data) => {
      this.logger.warn('Invalid license, showing license window');
      this.showLicenseWindow();
    });

    eventBus.subscribe(LicenseEvents.LICENSE_EXPIRED, (data) => {
      this.logger.warn('License expired, showing license window');
      this.showLicenseWindow();
    });
  }

  async createMainWindow() {
    this.logger.info('Creating main window');

    this.mainWindow = new BrowserWindow({
      width: 850,
      height: 700,
      minWidth: 1200,
      minHeight: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    await this.mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));

    // DevTools can be opened manually with F12 or Ctrl+Shift+I in development

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Initialize ProcessHandler now that we have a mainWindow
    if (!this.handlers.process) {
      const processingService = this.dependencies.get('processingService');
      const excelService = this.dependencies.get('excelService');
      const eventBus = this.dependencies.get('eventBus');
      
      this.handlers.process = new ProcessHandler(processingService, excelService, eventBus, this.mainWindow);
      this.logger.info('ProcessHandler initialized with mainWindow');
    }

    return this.mainWindow;
  }

  async createLicenseWindow() {
    this.logger.info('Creating license window');

    this.licenseWindow = new BrowserWindow({
      width: 850,
      height: 700,
      show: false,
      resizable: true,
      minWidth: 500,
      minHeight: 400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    await this.licenseWindow.loadFile(path.join(__dirname, '..', 'ui', 'license.html'));

    this.licenseWindow.on('closed', () => {
      this.licenseWindow = null;
    });

    return this.licenseWindow;
  }

  async createLoadingWindow() {
    this.logger.info('Creating loading window');

    this.loadingWindow = new BrowserWindow({
      width: 400,
      height: 200,
      frame: false,
      transparent: true,
      resizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    await this.loadingWindow.loadFile(path.join(__dirname, '..', 'ui', 'loading.html'));

    this.loadingWindow.on('closed', () => {
      this.loadingWindow = null;
    });

    return this.loadingWindow;
  }

  async createConfigWindow() {
    this.logger.info('Creating config window');

    this.configWindow = new BrowserWindow({
      width: 420,
      height: 380,
      minWidth: 350,
      minHeight: 320,
      show: false,
      resizable: true,
      modal: true,
      parent: this.mainWindow,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    await this.configWindow.loadFile(path.join(__dirname, '..', 'ui', 'config.html'));

    this.configWindow.on('closed', () => {
      this.configWindow = null;
    });

    return this.configWindow;
  }

  async showMainWindow() {
    if (!this.mainWindow) {
      await this.createMainWindow();
    }

    if (this.loadingWindow) {
      this.loadingWindow.close();
      this.loadingWindow = null;
    }

    if (this.licenseWindow) {
      this.licenseWindow.close();
      this.licenseWindow = null;
    }

    this.mainWindow.show();
    this.mainWindow.focus();
  }

  async showLicenseWindow() {
    if (!this.licenseWindow) {
      await this.createLicenseWindow();
    }

    if (this.loadingWindow) {
      this.loadingWindow.close();
      this.loadingWindow = null;
    }

    if (this.mainWindow) {
      this.mainWindow.hide();
    }

    this.licenseWindow.show();
    this.licenseWindow.focus();
  }

  async showLoadingWindow() {
    if (!this.loadingWindow) {
      await this.createLoadingWindow();
    }

    this.loadingWindow.show();
    this.loadingWindow.focus();
  }

  async showConfigWindow() {
    if (!this.configWindow) {
      await this.createConfigWindow();
    }

    this.configWindow.show();
    this.configWindow.focus();
  }

  async start() {
    try {
      this.logger.info('Starting application');

      // Show loading window
      await this.showLoadingWindow();

      // Check license status with full validation
      const licenseService = this.dependencies.get('licenseService');
      const licenseCheck = await licenseService.checkInitialLicense();

      this.logger.info('License check result', licenseCheck);

      if (licenseCheck.valid) {
        this.logger.info('Valid license found, showing main window');
        await this.showMainWindow();
        
        // Emit license validated event
        if (licenseCheck.license) {
          this.dependencies.get('eventBus').publish('LICENSE_VALIDATED', { 
            license: licenseCheck.license 
          });
        }
      } else {
        this.logger.info('No valid license found, showing license window');
        await this.showLicenseWindow();
      }

    } catch (error) {
      this.logger.error('Error starting application', error);
      
      // Show license window as fallback
      await this.showLicenseWindow();
    }
  }

  dispose() {
    this.logger.info('Disposing application');

    // Dispose handlers
    Object.values(this.handlers).forEach(handler => {
      if (handler.dispose) {
        handler.dispose();
      }
    });

    // Remove all IPC listeners
    ipcMain.removeAllListeners();

    this.logger.info('Application disposed');
  }
}

// Global application instance
let application = null;

// App event handlers
app.whenReady().then(async () => {
  try {
    application = new Application();
    await application.initialize();
    await application.start();
  } catch (error) {
    console.error('Error starting application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (application) {
      await application.start();
    }
  }
});

app.on('before-quit', () => {
  if (application) {
    application.dispose();
  }
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available.');
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.');
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  log.info(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded');
  autoUpdater.quitAndInstall();
});

// Check for updates when ready
app.on('ready', () => {
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

module.exports = Application;