const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../../../shared/utils/Logger');

class ReportHandler {
  constructor(reportService) {
    this.reportService = reportService;
    this.logger = Logger.getInstance('ReportHandler');
    this.registerHandlers();
  }

  registerHandlers() {
    ipcMain.handle('report:generate', this.handleGenerateReport.bind(this));
    ipcMain.handle('report:export', this.handleExportReport.bind(this));
    ipcMain.handle('report:getAll', this.handleGetAllReports.bind(this));
    ipcMain.handle('report:getById', this.handleGetReportById.bind(this));
    ipcMain.handle('report:delete', this.handleDeleteReport.bind(this));
    ipcMain.handle('report:getStatistics', this.handleGetStatistics.bind(this));
    ipcMain.handle('report:getSupportedFormats', this.handleGetSupportedFormats.bind(this));

    this.logger.info('Report IPC handlers registered');
  }

  async handleGenerateReport(event, { expedientes, options = {} }) {
    try {
      this.logger.info('Handling generate report request', { 
        expedientesCount: expedientes?.length || 0,
        type: options.type 
      });

      if (!expedientes || !Array.isArray(expedientes)) {
        throw new Error('Expedientes array is required');
      }

      const report = await this.reportService.generateReport(expedientes, options);

      return {
        success: true,
        data: report.toJSON()
      };

    } catch (error) {
      this.logger.error('Error generating report', error);

      return {
        success: false,
        error: error.message,
        code: 'GENERATE_REPORT_ERROR'
      };
    }
  }

  async handleExportReport(event, { reportId, format, saveDialog = true }) {
    try {
      this.logger.info('Handling export report request', { reportId, format });

      const exportResult = await this.reportService.exportReport(reportId, format);

      if (saveDialog) {
        const { filePath } = await dialog.showSaveDialog({
          defaultPath: exportResult.filename,
          filters: [
            {
              name: this.getFilterName(format),
              extensions: [this.getExtension(format)]
            }
          ]
        });

        if (filePath) {
          await fs.writeFile(filePath, exportResult.data);
          
          return {
            success: true,
            data: {
              filePath,
              filename: path.basename(filePath),
              size: exportResult.data.length
            }
          };
        } else {
          return {
            success: false,
            error: 'Export cancelled by user',
            code: 'EXPORT_CANCELLED'
          };
        }
      } else {
        return {
          success: true,
          data: {
            filename: exportResult.filename,
            mimeType: exportResult.mimeType,
            data: exportResult.data,
            size: exportResult.data.length
          }
        };
      }

    } catch (error) {
      this.logger.error('Error exporting report', error);

      return {
        success: false,
        error: error.message,
        code: 'EXPORT_REPORT_ERROR'
      };
    }
  }

  async handleGetAllReports(event, filters = {}) {
    try {
      this.logger.debug('Handling get all reports request', filters);

      const reports = await this.reportService.getReports(filters);

      return {
        success: true,
        data: reports.map(report => report.toJSON())
      };

    } catch (error) {
      this.logger.error('Error getting all reports', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_REPORTS_ERROR'
      };
    }
  }

  async handleGetReportById(event, { reportId }) {
    try {
      this.logger.debug('Handling get report by id request', { reportId });

      const report = await this.reportService.getReportById(reportId);

      return {
        success: true,
        data: report.toJSON()
      };

    } catch (error) {
      this.logger.error('Error getting report by id', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_REPORT_ERROR'
      };
    }
  }

  async handleDeleteReport(event, { reportId }) {
    try {
      this.logger.info('Handling delete report request', { reportId });

      const result = await this.reportService.deleteReport(reportId);

      return {
        success: true,
        data: { deleted: result }
      };

    } catch (error) {
      this.logger.error('Error deleting report', error);

      return {
        success: false,
        error: error.message,
        code: 'DELETE_REPORT_ERROR'
      };
    }
  }

  async handleGetStatistics(event) {
    try {
      this.logger.debug('Handling get statistics request');

      const statistics = await this.reportService.getReportStatistics();

      return {
        success: true,
        data: statistics
      };

    } catch (error) {
      this.logger.error('Error getting statistics', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_STATISTICS_ERROR'
      };
    }
  }

  async handleGetSupportedFormats(event) {
    try {
      this.logger.debug('Handling get supported formats request');

      const formats = this.reportService.getSupportedFormats();

      return {
        success: true,
        data: { formats }
      };

    } catch (error) {
      this.logger.error('Error getting supported formats', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_FORMATS_ERROR'
      };
    }
  }

  getFilterName(format) {
    const filterNames = {
      'excel': 'Excel Files',
      'xlsx': 'Excel Files',
      'csv': 'CSV Files',
      'html': 'HTML Files'
    };

    return filterNames[format.toLowerCase()] || 'All Files';
  }

  getExtension(format) {
    const extensions = {
      'excel': 'xlsx',
      'xlsx': 'xlsx',
      'csv': 'csv',
      'html': 'html'
    };

    return extensions[format.toLowerCase()] || format.toLowerCase();
  }

  dispose() {
    ipcMain.removeAllListeners('report:generate');
    ipcMain.removeAllListeners('report:export');
    ipcMain.removeAllListeners('report:getAll');
    ipcMain.removeAllListeners('report:getById');
    ipcMain.removeAllListeners('report:delete');
    ipcMain.removeAllListeners('report:getStatistics');
    ipcMain.removeAllListeners('report:getSupportedFormats');

    this.logger.info('Report IPC handlers disposed');
  }
}

module.exports = ReportHandler;