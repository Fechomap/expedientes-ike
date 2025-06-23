const ElectronStore = require('../infrastructure/persistence/storage/ElectronStore');
const LicenseRepository = require('../infrastructure/persistence/repositories/LicenseRepository');
const ConfigRepository = require('../infrastructure/persistence/repositories/ConfigRepository');
const ReportRepository = require('../infrastructure/persistence/repositories/ReportRepository');
const LicenseService = require('../core/services/LicenseService');
const ReportService = require('../core/services/ReportService');
const AutomationService = require('../core/services/AutomationService');
const ExcelService = require('../core/services/ExcelService');
const ProcessingService = require('../core/services/ProcessingService');
const LicenseAPI = require('../infrastructure/api/endpoints/LicenseAPI');
const EventBus = require('../shared/events/EventBus');
const ExporterFactory = require('../infrastructure/reports/ExporterFactory');
const Logger = require('../shared/utils/Logger');

class DependencyContainer {
  constructor() {
    this.dependencies = new Map();
    this.logger = Logger.getInstance('DependencyContainer');
    this.initializeDependencies();
  }

  initializeDependencies() {
    try {
      this.logger.info('Initializing dependencies');

      const eventBus = EventBus.getInstance();
      this.register('eventBus', eventBus);

      // Initialize storage with error handling
      let licenseStorage, configStorage, reportStorage;
      
      try {
        licenseStorage = new ElectronStore({ name: 'license' });
        configStorage = new ElectronStore({ name: 'config' });
        reportStorage = new ElectronStore({ name: 'reports' });
      } catch (storageError) {
        this.logger.warn('Storage initialization failed, using memory fallback', storageError);
        // Create minimal fallback storage
        const fallbackStorage = {
          get: (key, defaultValue) => defaultValue,
          set: () => {},
          delete: () => {},
          clear: () => {},
          has: () => false
        };
        licenseStorage = fallbackStorage;
        configStorage = fallbackStorage;
        reportStorage = fallbackStorage;
      }

      this.register('licenseStorage', licenseStorage);
      this.register('configStorage', configStorage);
      this.register('reportStorage', reportStorage);

      const licenseRepository = new LicenseRepository(licenseStorage);
      const configRepository = new ConfigRepository(configStorage);
      const reportRepository = new ReportRepository(reportStorage);

      this.register('licenseRepository', licenseRepository);
      this.register('configRepository', configRepository);
      this.register('reportRepository', reportRepository);

      const apiBaseURL = process.env.API_BASE_URL || 'https://web-production-917a7.up.railway.app';
      const licenseAPI = new LicenseAPI(apiBaseURL);
      this.register('licenseAPI', licenseAPI);

      const licenseService = new LicenseService(licenseRepository, licenseAPI, eventBus);
      this.register('licenseService', licenseService);

      const exporterFactory = ExporterFactory.getInstance();
      const exportStrategies = exporterFactory.getExporterStrategies();
      const reportService = new ReportService(reportRepository, exportStrategies, eventBus);
      this.register('reportService', reportService);

      const automationService = new AutomationService(eventBus, configRepository);
      this.register('automationService', automationService);

      const excelService = new ExcelService(eventBus);
      this.register('excelService', excelService);

      const processingService = new ProcessingService(automationService, excelService, reportService, eventBus, configRepository);
      this.register('processingService', processingService);

      this.logger.info('Dependencies initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing dependencies', error);
      throw error;
    }
  }

  register(name, dependency) {
    this.dependencies.set(name, dependency);
    this.logger.debug('Dependency registered', { name });
  }

  get(name) {
    const dependency = this.dependencies.get(name);
    
    if (!dependency) {
      throw new Error(`Dependency '${name}' not found`);
    }
    
    return dependency;
  }

  has(name) {
    return this.dependencies.has(name);
  }

  getAll() {
    return Object.fromEntries(this.dependencies);
  }

  static getInstance() {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    
    return DependencyContainer.instance;
  }
}

module.exports = DependencyContainer;