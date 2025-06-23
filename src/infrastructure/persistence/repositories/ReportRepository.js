const IReportRepository = require('../../../core/domain/repositories/IReportRepository');
const Report = require('../../../core/domain/entities/Report');
const Logger = require('../../../shared/utils/Logger');

class ReportRepository extends IReportRepository {
  constructor(storage) {
    super();
    this.storage = storage;
    this.logger = Logger.getInstance('ReportRepository');
    this.reportsKey = 'reports';
  }

  async save(report) {
    try {
      this.logger.debug('Saving report', { id: report.id, type: report.type });
      
      const reports = await this.getAllReports();
      reports[report.id] = report.toJSON();
      
      await this.storage.set(this.reportsKey, reports);
      
      this.logger.info('Report saved successfully', { id: report.id });
      return report;
    } catch (error) {
      this.logger.error('Error saving report', error, { id: report.id });
      throw error;
    }
  }

  async findById(id) {
    try {
      this.logger.debug('Finding report by id', { id });
      
      const reports = await this.getAllReports();
      const reportData = reports[id];
      
      if (!reportData) {
        this.logger.debug('Report not found', { id });
        return null;
      }
      
      const report = Report.fromJSON(reportData);
      this.logger.debug('Report found', { id: report.id });
      
      return report;
    } catch (error) {
      this.logger.error('Error finding report by id', error, { id });
      throw error;
    }
  }

  async findAll() {
    try {
      this.logger.debug('Finding all reports');
      
      const reports = await this.getAllReports();
      const reportList = Object.values(reports).map(data => Report.fromJSON(data));
      
      reportList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      this.logger.debug('Found reports', { count: reportList.length });
      return reportList;
    } catch (error) {
      this.logger.error('Error finding all reports', error);
      throw error;
    }
  }

  async findByType(type) {
    try {
      this.logger.debug('Finding reports by type', { type });
      
      const allReports = await this.findAll();
      const filteredReports = allReports.filter(report => report.type === type);
      
      this.logger.debug('Found reports by type', { type, count: filteredReports.length });
      return filteredReports;
    } catch (error) {
      this.logger.error('Error finding reports by type', error, { type });
      throw error;
    }
  }

  async findByDateRange(startDate, endDate) {
    try {
      this.logger.debug('Finding reports by date range', { startDate, endDate });
      
      const allReports = await this.findAll();
      const filteredReports = allReports.filter(report => {
        const reportDate = new Date(report.createdAt);
        return reportDate >= new Date(startDate) && reportDate <= new Date(endDate);
      });
      
      this.logger.debug('Found reports by date range', { count: filteredReports.length });
      return filteredReports;
    } catch (error) {
      this.logger.error('Error finding reports by date range', error);
      throw error;
    }
  }

  async update(report) {
    try {
      this.logger.debug('Updating report', { id: report.id });
      
      const existingReport = await this.findById(report.id);
      if (!existingReport) {
        throw new Error(`Report with id ${report.id} not found for update`);
      }
      
      report.updatedAt = new Date();
      return await this.save(report);
    } catch (error) {
      this.logger.error('Error updating report', error, { id: report.id });
      throw error;
    }
  }

  async delete(id) {
    try {
      this.logger.debug('Deleting report', { id });
      
      const reports = await this.getAllReports();
      if (!reports[id]) {
        throw new Error(`Report with id ${id} not found for deletion`);
      }
      
      delete reports[id];
      await this.storage.set(this.reportsKey, reports);
      
      this.logger.info('Report deleted successfully', { id });
      return true;
    } catch (error) {
      this.logger.error('Error deleting report', error, { id });
      throw error;
    }
  }

  async exists(id) {
    try {
      const report = await this.findById(id);
      return report !== null;
    } catch (error) {
      this.logger.error('Error checking report existence', error, { id });
      return false;
    }
  }

  async getLatest(limit = 10) {
    try {
      this.logger.debug('Getting latest reports', { limit });
      
      const allReports = await this.findAll();
      const latestReports = allReports.slice(0, limit);
      
      this.logger.debug('Found latest reports', { count: latestReports.length });
      return latestReports;
    } catch (error) {
      this.logger.error('Error getting latest reports', error, { limit });
      throw error;
    }
  }

  async getAllReports() {
    try {
      const reports = await this.storage.get(this.reportsKey, {});
      return reports;
    } catch (error) {
      this.logger.error('Error getting all reports from storage', error);
      return {};
    }
  }
}

module.exports = ReportRepository;