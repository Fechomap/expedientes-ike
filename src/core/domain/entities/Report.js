const { ValidationError } = require('../../../shared/errors');

class Report {
  constructor(data) {
    this.validateData(data);
    
    this.id = data.id || this.generateId();
    this.type = data.type || 'summary';
    this.title = data.title || `Reporte ${this.type} - ${new Date().toLocaleDateString()}`;
    this.expedientes = data.expedientes || [];
    this.statistics = data.statistics || this.calculateStatistics();
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  validateData(data) {
    const validTypes = ['summary', 'detailed', 'daily', 'weekly', 'monthly'];
    if (data.type && !validTypes.includes(data.type)) {
      throw new ValidationError('Invalid report type', 'type', data.type);
    }
  }

  generateId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addExpediente(expediente) {
    this.expedientes.push(expediente);
    this.statistics = this.calculateStatistics();
    this.updatedAt = new Date();
  }

  addExpedientes(expedientes) {
    this.expedientes.push(...expedientes);
    this.statistics = this.calculateStatistics();
    this.updatedAt = new Date();
  }

  calculateStatistics() {
    const total = this.expedientes.length;
    const completed = this.expedientes.filter(exp => exp.status === 'completed').length;
    const failed = this.expedientes.filter(exp => exp.status === 'failed').length;
    const withCost = this.expedientes.filter(exp => exp.hasCost && exp.hasCost()).length;
    const active = this.expedientes.filter(exp => exp.isActive && exp.isActive()).length;

    const totalCost = this.expedientes
      .filter(exp => exp.costo && !isNaN(parseFloat(exp.costo)))
      .reduce((sum, exp) => sum + parseFloat(exp.costo), 0);

    const averageProcessingTime = this.calculateAverageProcessingTime();

    return {
      total,
      completed,
      failed,
      pending: total - completed - failed,
      withCost,
      active,
      totalCost,
      averageProcessingTime,
      successRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0
    };
  }

  calculateAverageProcessingTime() {
    const processedExpedientes = this.expedientes.filter(exp => 
      exp.processedAt && exp.createdAt
    );

    if (processedExpedientes.length === 0) return 0;

    const totalTime = processedExpedientes.reduce((sum, exp) => {
      return sum + (exp.processedAt.getTime() - exp.createdAt.getTime());
    }, 0);

    return Math.round(totalTime / processedExpedientes.length / 1000);
  }

  getExpedientesByStatus(status) {
    return this.expedientes.filter(exp => exp.status === status);
  }

  getExpedientesWithCost() {
    return this.expedientes.filter(exp => exp.hasCost && exp.hasCost());
  }

  getActiveExpedientes() {
    return this.expedientes.filter(exp => exp.isActive && exp.isActive());
  }

  updateMetadata(key, value) {
    this.metadata[key] = value;
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      expedientes: this.expedientes.map(exp => exp.toJSON ? exp.toJSON() : exp),
      statistics: this.statistics,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  static fromJSON(data) {
    const Expediente = require('./Expediente');
    
    const expedientes = data.expedientes.map(expData => {
      return expData.numero ? Expediente.fromJSON(expData) : expData;
    });

    return new Report({
      ...data,
      expedientes
    });
  }

  static createSummaryReport(expedientes, metadata = {}) {
    return new Report({
      type: 'summary',
      expedientes,
      metadata: {
        ...metadata,
        generatedBy: 'system',
        reportVersion: '1.0'
      }
    });
  }

  static createDetailedReport(expedientes, metadata = {}) {
    return new Report({
      type: 'detailed',
      expedientes,
      metadata: {
        ...metadata,
        generatedBy: 'system',
        reportVersion: '1.0',
        includesDetails: true
      }
    });
  }
}

module.exports = Report;