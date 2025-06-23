const { ipcMain } = require('electron');
const Logger = require('../../../shared/utils/Logger');
const ProcessEvents = require('../../../shared/events/events/ProcessEvents');

class ProcessHandler {
  constructor(processingService, excelService, eventBus, mainWindow) {
    this.processingService = processingService;
    this.excelService = excelService;
    this.eventBus = eventBus;
    this.mainWindow = mainWindow;
    this.logger = Logger.getInstance('ProcessHandler');
    this.currentStats = { totalRevisados: 0, totalConCosto: 0, totalAceptados: 0 };
    this.registerHandlers();
    this.setupEventBridging();
  }

  registerHandlers() {
    ipcMain.handle('process:excel', this.handleProcessExcel.bind(this));
    ipcMain.handle('process:expedientes', this.handleProcessExpedientes.bind(this));
    ipcMain.handle('process:status', this.handleGetProcessStatus.bind(this));
    ipcMain.handle('excel:validate', this.handleValidateExcel.bind(this));
    ipcMain.handle('excel:getInfo', this.handleGetExcelInfo.bind(this));
    ipcMain.handle('excel:read', this.handleReadExcel.bind(this));

    this.logger.info('Process IPC handlers registered');
  }

  setupEventBridging() {
    // Bridge EventBus events to IPC for the renderer
    this.eventBus.subscribe(ProcessEvents.PROCESS_PROGRESS_UPDATED, (data) => {
      if (this.mainWindow && this.mainWindow.webContents) {
        // Transform to legacy format for compatibility
        // Update current stats
        this.currentStats.totalRevisados = data.current;
        
        const progressData = {
          message: `Revisando expediente ${data.current} de ${data.total} (${data.percentage}%)`,
          detail: `Expediente: ${data.currentExpediente}`,
          progress: data.percentage,
          stats: { ...this.currentStats }
        };
        
        this.mainWindow.webContents.send('process:progress', progressData);
        this.logger.debug('Progress event sent to renderer', progressData);
      }
    });

    this.eventBus.subscribe(ProcessEvents.EXPEDIENTE_PROCESSED, (data) => {
      if (this.mainWindow && this.mainWindow.webContents) {
        // Get real stats from automation service via processing service
        const automationService = this.processingService.automationService;
        if (automationService) {
          this.currentStats = automationService.getStats();
        }
        
        // Additional detail for each processed expediente
        const detailData = {
          detail: `✓ ${data.numeroExpediente} procesado`,
          result: data.result,
          stats: { ...this.currentStats }
        };
        
        this.mainWindow.webContents.send('expediente:processed', detailData);
      }
    });

    this.eventBus.subscribe(ProcessEvents.PROCESS_COMPLETED, (data) => {
      if (this.mainWindow && this.mainWindow.webContents) {
        // Get final stats from automation service
        const automationService = this.processingService.automationService;
        let finalStats = this.currentStats;
        
        if (automationService) {
          finalStats = automationService.getStats();
        }
        
        // Send final event with stats for modal
        const finalData = {
          message: `Proceso finalizado. Se revisaron ${data.processedCount} expedientes.`,
          progress: 100,
          final: true,
          stats: finalStats
        };
        
        this.mainWindow.webContents.send('process:progress', finalData);
        this.logger.info('Final progress event sent to renderer', finalData);
      }
    });

    this.logger.info('Event bridging setup completed');
  }

  async handleProcessExcel(event, { filePath, releaseLogicConfig, options = {} }) {
    try {
      this.logger.info('Handling process Excel request', { filePath, releaseLogicConfig });

      if (!filePath) {
        throw new Error('File path is required');
      }

      // Configurar las lógicas de liberación si se proporcionan
      if (releaseLogicConfig) {
        await this.processingService.setReleaseLogicConfig(releaseLogicConfig);
      }

      const result = await this.processingService.processExcelFile(filePath, options);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      this.logger.error('Error processing Excel file', error);

      // Check if the error is due to missing credentials
      if (error.message === 'CREDENTIALS_NOT_CONFIGURED') {
        return {
          success: false,
          error: 'Credenciales no configuradas. Configure sus credenciales en la configuración.',
          code: 'CREDENTIALS_NOT_CONFIGURED'
        };
      }

      // Check if the error is due to login failure
      if (error.message === 'Login failed' || error.message.includes('Login failed')) {
        return {
          success: false,
          error: 'Error de login. Verifique sus credenciales e intente nuevamente.',
          code: 'LOGIN_FAILED'
        };
      }

      return {
        success: false,
        error: error.message,
        code: 'PROCESS_EXCEL_ERROR'
      };
    }
  }

  async handleProcessExpedientes(event, { expedientes, options = {} }) {
    try {
      this.logger.info('Handling process expedientes request', { 
        count: expedientes?.length || 0 
      });

      if (!expedientes || !Array.isArray(expedientes)) {
        throw new Error('Expedientes array is required');
      }

      const result = await this.processingService.processExpedientesList(expedientes, options);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      this.logger.error('Error processing expedientes', error);

      return {
        success: false,
        error: error.message,
        code: 'PROCESS_EXPEDIENTES_ERROR'
      };
    }
  }

  async handleGetProcessStatus(event) {
    try {
      const isProcessing = this.processingService.isCurrentlyProcessing();
      const currentProcess = this.processingService.getCurrentProcessInfo();

      return {
        success: true,
        data: {
          isProcessing,
          currentProcess
        }
      };

    } catch (error) {
      this.logger.error('Error getting process status', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_STATUS_ERROR'
      };
    }
  }

  async handleValidateExcel(event, { filePath }) {
    try {
      this.logger.debug('Handling validate Excel request', { filePath });

      if (!filePath) {
        throw new Error('File path is required');
      }

      const validation = await this.excelService.validateExcelFile(filePath);

      return {
        success: true,
        data: validation
      };

    } catch (error) {
      this.logger.error('Error validating Excel file', error);

      return {
        success: false,
        error: error.message,
        code: 'VALIDATE_EXCEL_ERROR'
      };
    }
  }

  async handleGetExcelInfo(event, { filePath }) {
    try {
      this.logger.debug('Handling get Excel info request', { filePath });

      if (!filePath) {
        throw new Error('File path is required');
      }

      const info = await this.excelService.getFileInfo(filePath);

      return {
        success: true,
        data: info
      };

    } catch (error) {
      this.logger.error('Error getting Excel file info', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_EXCEL_INFO_ERROR'
      };
    }
  }

  async handleReadExcel(event, { filePath }) {
    try {
      this.logger.debug('Handling read Excel request', { filePath });

      if (!filePath) {
        throw new Error('File path is required');
      }

      const expedientes = await this.excelService.readExpedientesFromFile(filePath);

      return {
        success: true,
        data: {
          expedientes: expedientes.map(exp => exp.toJSON()),
          count: expedientes.length
        }
      };

    } catch (error) {
      this.logger.error('Error reading Excel file', error);

      return {
        success: false,
        error: error.message,
        code: 'READ_EXCEL_ERROR'
      };
    }
  }

  dispose() {
    ipcMain.removeAllListeners('process:excel');
    ipcMain.removeAllListeners('process:expedientes');
    ipcMain.removeAllListeners('process:status');
    ipcMain.removeAllListeners('excel:validate');
    ipcMain.removeAllListeners('excel:getInfo');
    ipcMain.removeAllListeners('excel:read');

    this.logger.info('Process IPC handlers disposed');
  }
}

module.exports = ProcessHandler;