const Report = require('../domain/entities/Report');
const Logger = require('../../shared/utils/Logger');
const ProcessEvents = require('../../shared/events/events/ProcessEvents');

class ReportService {
  constructor(reportRepository, exportStrategies, eventBus) {
    this.reportRepository = reportRepository;
    this.exportStrategies = exportStrategies || {};
    this.eventBus = eventBus;
    this.logger = Logger.getInstance('ReportService');
  }

  async generateReport(expedientes, options = {}) {
    try {
      this.logger.info('Generating report', { 
        expedientesCount: expedientes.length, 
        type: options.type 
      });

      const report = this.createReportByType(expedientes, options);
      
      const savedReport = await this.reportRepository.save(report);
      
      this.eventBus.publish(ProcessEvents.REPORT_GENERATED, { 
        reportId: savedReport.id,
        type: savedReport.type,
        expedientesCount: expedientes.length
      });
      
      this.logger.info('Report generated successfully', { 
        reportId: savedReport.id,
        type: savedReport.type
      });
      
      return savedReport;
    } catch (error) {
      this.logger.error('Error generating report', error);
      throw error;
    }
  }

  createReportByType(expedientes, options) {
    const { type = 'summary', metadata = {} } = options;
    
    const reportMetadata = {
      ...metadata,
      generatedBy: 'system',
      reportVersion: '1.0',
      totalProcessed: expedientes.length,
      generationTime: new Date().toISOString()
    };

    switch (type) {
      case 'detailed':
        return Report.createDetailedReport(expedientes, reportMetadata);
      case 'summary':
      default:
        return Report.createSummaryReport(expedientes, reportMetadata);
    }
  }

  async exportReport(reportId, format) {
    try {
      this.logger.info('Exporting report', { reportId, format });
      
      const report = await this.reportRepository.findById(reportId);
      if (!report) {
        throw new Error(`Report with id ${reportId} not found`);
      }
      
      const strategy = this.exportStrategies[format.toLowerCase()];
      if (!strategy) {
        throw new Error(`Export format '${format}' not supported`);
      }
      
      const exportedData = await strategy.export(report);
      
      this.logger.info('Report exported successfully', { 
        reportId, 
        format,
        dataSize: exportedData.length || 'unknown'
      });
      
      return {
        success: true,
        data: exportedData,
        filename: strategy.getFilename(report),
        mimeType: strategy.getMimeType()
      };
      
    } catch (error) {
      this.logger.error('Error exporting report', error, { reportId, format });
      throw error;
    }
  }

  async getReports(filters = {}) {
    try {
      this.logger.debug('Getting reports with filters', filters);
      
      if (filters.type) {
        return await this.reportRepository.findByType(filters.type);
      }
      
      if (filters.dateRange) {
        return await this.reportRepository.findByDateRange(
          filters.dateRange.start,
          filters.dateRange.end
        );
      }
      
      if (filters.limit) {
        return await this.reportRepository.getLatest(filters.limit);
      }
      
      return await this.reportRepository.findAll();
    } catch (error) {
      this.logger.error('Error getting reports', error);
      throw error;
    }
  }

  async getReportById(reportId) {
    try {
      this.logger.debug('Getting report by id', { reportId });
      
      const report = await this.reportRepository.findById(reportId);
      if (!report) {
        throw new Error(`Report with id ${reportId} not found`);
      }
      
      return report;
    } catch (error) {
      this.logger.error('Error getting report by id', error, { reportId });
      throw error;
    }
  }

  async deleteReport(reportId) {
    try {
      this.logger.info('Deleting report', { reportId });
      
      const result = await this.reportRepository.delete(reportId);
      
      this.logger.info('Report deleted successfully', { reportId });
      return result;
    } catch (error) {
      this.logger.error('Error deleting report', error, { reportId });
      throw error;
    }
  }

  async getReportStatistics() {
    try {
      this.logger.debug('Getting report statistics');
      
      const allReports = await this.reportRepository.findAll();
      
      const statistics = {
        totalReports: allReports.length,
        reportsByType: this.groupByType(allReports),
        totalExpedientesProcessed: this.getTotalExpedientesProcessed(allReports),
        averageExpedientesPerReport: this.getAverageExpedientesPerReport(allReports),
        latestReportDate: this.getLatestReportDate(allReports)
      };
      
      return statistics;
    } catch (error) {
      this.logger.error('Error getting report statistics', error);
      throw error;
    }
  }

  groupByType(reports) {
    return reports.reduce((acc, report) => {
      acc[report.type] = (acc[report.type] || 0) + 1;
      return acc;
    }, {});
  }

  getTotalExpedientesProcessed(reports) {
    return reports.reduce((total, report) => {
      return total + (report.expedientes?.length || 0);
    }, 0);
  }

  getAverageExpedientesPerReport(reports) {
    if (reports.length === 0) return 0;
    
    const total = this.getTotalExpedientesProcessed(reports);
    return Math.round(total / reports.length);
  }

  getLatestReportDate(reports) {
    if (reports.length === 0) return null;
    
    return reports.reduce((latest, report) => {
      const reportDate = new Date(report.createdAt);
      return reportDate > latest ? reportDate : latest;
    }, new Date(0));
  }

  registerExportStrategy(format, strategy) {
    this.exportStrategies[format.toLowerCase()] = strategy;
    this.logger.debug('Export strategy registered', { format });
  }

  getSupportedFormats() {
    return Object.keys(this.exportStrategies);
  }
}

module.exports = ReportService;