const Logger = require('../../shared/utils/Logger');
const ProcessEvents = require('../../shared/events/events/ProcessEvents');

class ProcessingService {
  constructor(automationService, excelService, reportService, eventBus, configRepository) {
    this.automationService = automationService;
    this.excelService = excelService;
    this.reportService = reportService;
    this.eventBus = eventBus;
    this.configRepository = configRepository;
    this.logger = Logger.getInstance('ProcessingService');
    this.isProcessing = false;
    this.currentProcess = null;
  }

  async processExcelFile(filePath, options = {}) {
    if (this.isProcessing) {
      throw new Error('Another processing operation is already running');
    }

    try {
      this.isProcessing = true;
      this.logger.info('Starting Excel file processing', { filePath });

      // Check if credentials are configured
      const credentials = await this.configRepository.getCredentials();
      if (!credentials || !credentials.username || !credentials.password) {
        throw new Error('CREDENTIALS_NOT_CONFIGURED');
      }

      this.eventBus.publish(ProcessEvents.PROCESS_STARTED, {
        filePath,
        timestamp: new Date()
      });

      // Read expedientes from Excel file
      const expedientes = await this.excelService.readExpedientesFromFile(filePath);
      
      if (expedientes.length === 0) {
        throw new Error('No expedientes found in Excel file');
      }

      this.logger.info('Found expedientes to process', { count: expedientes.length });

      // Initialize browser and login
      await this.automationService.initializeBrowser();
      await this.automationService.login();

      // Process each expediente
      const processedExpedientes = [];
      const errors = [];

      for (let i = 0; i < expedientes.length; i++) {
        const expediente = expedientes[i];
        
        try {
          this.logger.debug('Processing expediente', { 
            numero: expediente.numero, 
            progress: `${i + 1}/${expedientes.length}` 
          });

          // Search expediente with saved cost for comparison
          const searchResult = await this.automationService.searchExpediente(expediente.numero, expediente.costoGuardado);
          
          // Update expediente with results
          if (searchResult.isSuccessful()) {
            expediente.markAsProcessed({
              success: true,
              costo: searchResult.costo,
              estatus: searchResult.estatus,
              notas: searchResult.notas,
              fechaRegistro: searchResult.fechaRegistro,
              servicio: searchResult.servicio,
              subservicio: searchResult.subservicio,
              validacion: searchResult.validacion,
              logicUsed: searchResult.logicUsed,
              validationDate: searchResult.validationDate,
              fechaInicio: searchResult.fechaInicio,
              fechaTermino: searchResult.fechaTermino,
              procedimiento: searchResult.procedimiento,
              abogado: searchResult.abogado
            });
          } else {
            expediente.markAsFailed(searchResult.error);
            errors.push({
              numero: expediente.numero,
              error: searchResult.error
            });
          }

          processedExpedientes.push(expediente);

          // Update progress
          this.eventBus.publish(ProcessEvents.PROCESS_PROGRESS_UPDATED, {
            current: i + 1,
            total: expedientes.length,
            percentage: Math.round(((i + 1) / expedientes.length) * 100),
            currentExpediente: expediente.numero
          });

          // Add delay between requests to avoid overwhelming the server
          if (i < expedientes.length - 1) {
            await this.delay(options.delayBetweenRequests || 2000);
          }

        } catch (error) {
          this.logger.error('Error processing expediente', error, { numero: expediente.numero });
          
          expediente.markAsFailed(error.message);
          processedExpedientes.push(expediente);
          errors.push({
            numero: expediente.numero,
            error: error.message
          });
        }
      }

      // Update Excel file with results
      await this.excelService.updateExpedientesInFile(filePath, processedExpedientes);

      // Generate report
      let report = null;
      if (options.generateReport !== false) {
        report = await this.reportService.generateReport(processedExpedientes, {
          type: options.reportType || 'summary',
          metadata: {
            sourceFile: filePath,
            processingStarted: new Date(),
            totalErrors: errors.length
          }
        });
      }

      // Close browser
      await this.automationService.closeBrowser();

      const result = {
        success: true,
        processedCount: processedExpedientes.length,
        successCount: processedExpedientes.filter(exp => exp.isProcessed()).length,
        errorCount: errors.length,
        errors: errors,
        stats: this.automationService.getStats(),
        report: report ? report.toJSON() : null,
        filePath
      };

      this.eventBus.publish(ProcessEvents.PROCESS_COMPLETED, result);

      this.logger.info('Excel file processing completed successfully', {
        filePath,
        processedCount: result.processedCount,
        successCount: result.successCount,
        errorCount: result.errorCount
      });

      return result;

    } catch (error) {
      this.logger.error('Error processing Excel file', error);

      // Ensure browser is closed
      try {
        if (this.automationService.isInitialized()) {
          await this.automationService.closeBrowser();
        }
      } catch (cleanupError) {
        this.logger.error('Error cleaning up browser', cleanupError);
      }

      this.eventBus.publish(ProcessEvents.PROCESS_FAILED, {
        filePath,
        error: error.message,
        timestamp: new Date()
      });

      throw error;
    } finally {
      this.isProcessing = false;
      this.currentProcess = null;
    }
  }

  async processExpedientesList(expedientes, options = {}) {
    if (this.isProcessing) {
      throw new Error('Another processing operation is already running');
    }

    try {
      this.isProcessing = true;
      this.logger.info('Starting expedientes list processing', { count: expedientes.length });

      this.eventBus.publish(ProcessEvents.PROCESS_STARTED, {
        expedientesCount: expedientes.length,
        timestamp: new Date()
      });

      // Initialize browser and login
      await this.automationService.initializeBrowser();
      await this.automationService.login();

      // Process each expediente
      const processedExpedientes = [];
      const errors = [];

      for (let i = 0; i < expedientes.length; i++) {
        const expediente = expedientes[i];
        
        try {
          const searchResult = await this.automationService.searchExpediente(expediente.numero);
          
          if (searchResult.isSuccessful()) {
            expediente.markAsProcessed({
              success: true,
              costo: searchResult.costo,
              estatus: searchResult.estatus,
              notas: searchResult.notas,
              fechaRegistro: searchResult.fechaRegistro,
              servicio: searchResult.servicio,
              subservicio: searchResult.subservicio,
              validacion: searchResult.validacion,
              logicUsed: searchResult.logicUsed,
              validationDate: searchResult.validationDate,
              fechaInicio: searchResult.fechaInicio,
              fechaTermino: searchResult.fechaTermino,
              procedimiento: searchResult.procedimiento,
              abogado: searchResult.abogado
            });
          } else {
            expediente.markAsFailed(searchResult.error);
            errors.push({
              numero: expediente.numero,
              error: searchResult.error
            });
          }

          processedExpedientes.push(expediente);

          // Update progress
          this.eventBus.publish(ProcessEvents.PROCESS_PROGRESS_UPDATED, {
            current: i + 1,
            total: expedientes.length,
            percentage: Math.round(((i + 1) / expedientes.length) * 100),
            currentExpediente: expediente.numero
          });

          // Add delay between requests
          if (i < expedientes.length - 1) {
            await this.delay(options.delayBetweenRequests || 2000);
          }

        } catch (error) {
          this.logger.error('Error processing expediente', error, { numero: expediente.numero });
          
          expediente.markAsFailed(error.message);
          processedExpedientes.push(expediente);
          errors.push({
            numero: expediente.numero,
            error: error.message
          });
        }
      }

      // Close browser
      await this.automationService.closeBrowser();

      const result = {
        success: true,
        processedCount: processedExpedientes.length,
        successCount: processedExpedientes.filter(exp => exp.isProcessed()).length,
        errorCount: errors.length,
        errors: errors,
        stats: this.automationService.getStats(),
        expedientes: processedExpedientes.map(exp => exp.toJSON())
      };

      this.eventBus.publish(ProcessEvents.PROCESS_COMPLETED, result);

      this.logger.info('Expedientes list processing completed successfully', {
        processedCount: result.processedCount,
        successCount: result.successCount,
        errorCount: result.errorCount
      });

      return result;

    } catch (error) {
      this.logger.error('Error processing expedientes list', error);

      // Ensure browser is closed
      try {
        if (this.automationService.isInitialized()) {
          await this.automationService.closeBrowser();
        }
      } catch (cleanupError) {
        this.logger.error('Error cleaning up browser', cleanupError);
      }

      this.eventBus.publish(ProcessEvents.PROCESS_FAILED, {
        expedientesCount: expedientes.length,
        error: error.message,
        timestamp: new Date()
      });

      throw error;
    } finally {
      this.isProcessing = false;
      this.currentProcess = null;
    }
  }

  isCurrentlyProcessing() {
    return this.isProcessing;
  }

  getCurrentProcessInfo() {
    return this.currentProcess;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Método para configurar las lógicas de liberación
  async setReleaseLogicConfig(config) {
    this.logger.info('Setting release logic config', config);
    this.automationService.setReleaseLogicConfig(config);
  }
}

module.exports = ProcessingService;