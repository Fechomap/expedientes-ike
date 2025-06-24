const ExcelExporter = require('./exporters/ExcelExporter');
const CSVExporter = require('./exporters/CSVExporter');
const HTMLExporter = require('./exporters/HTMLExporter');
const Logger = require('../../shared/utils/Logger');

class ExporterFactory {
  constructor() {
    this.exporters = new Map();
    this.logger = Logger.getInstance('ExporterFactory');
    this.registerDefaultExporters();
  }

  registerDefaultExporters() {
    this.register('excel', new ExcelExporter());
    this.register('xlsx', new ExcelExporter());
    this.register('csv', new CSVExporter());
    this.register('html', new HTMLExporter());
    
    this.logger.info('Default exporters registered');
  }

  register(format, exporter) {
    this.exporters.set(format.toLowerCase(), exporter);
    this.logger.debug('Exporter registered', { format });
  }

  getExporter(format) {
    const exporter = this.exporters.get(format.toLowerCase());
    
    if (!exporter) {
      throw new Error(`No exporter found for format: ${format}`);
    }
    
    return exporter;
  }

  getSupportedFormats() {
    return Array.from(this.exporters.keys());
  }

  isFormatSupported(format) {
    return this.exporters.has(format.toLowerCase());
  }

  getExporterStrategies() {
    const strategies = {};
    
    for (const [format, exporter] of this.exporters) {
      strategies[format] = exporter;
    }
    
    return strategies;
  }

  static getInstance() {
    if (!ExporterFactory.instance) {
      ExporterFactory.instance = new ExporterFactory();
    }
    
    return ExporterFactory.instance;
  }
}

module.exports = ExporterFactory;