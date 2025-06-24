const Logger = require('../../../shared/utils/Logger');

class CSVExporter {
  constructor() {
    this.logger = Logger.getInstance('CSVExporter');
  }

  async export(report) {
    try {
      this.logger.info('Exporting report to CSV', { reportId: report.id });
      
      const csvContent = this.generateCSV(report);
      
      this.logger.info('CSV export completed', { 
        reportId: report.id,
        contentLength: csvContent.length
      });
      
      return Buffer.from(csvContent, 'utf-8');
    } catch (error) {
      this.logger.error('Error exporting to CSV', error);
      throw error;
    }
  }

  generateCSV(report) {
    const headers = [
      'Número de Expediente',
      'Estado',
      'Costo',
      'Estatus',
      'Fecha Inicio',
      'Fecha Término',
      'Procedimiento',
      'Abogado',
      'Procesado En'
    ];
    
    let csv = this.arrayToCSVRow(headers) + '\n';
    
    report.expedientes.forEach(expediente => {
      const row = [
        expediente.numero,
        expediente.status,
        expediente.costo || 'N/A',
        expediente.estatus || 'N/A',
        expediente.fechaInicio || 'N/A',
        expediente.fechaTermino || 'N/A',
        expediente.procedimiento || 'N/A',
        expediente.abogado || 'N/A',
        expediente.processedAt ? expediente.processedAt.toLocaleString() : 'N/A'
      ];
      
      csv += this.arrayToCSVRow(row) + '\n';
    });
    
    csv += '\n';
    csv += 'ESTADÍSTICAS\n';
    csv += this.arrayToCSVRow(['Total', report.statistics.total]) + '\n';
    csv += this.arrayToCSVRow(['Completados', report.statistics.completed]) + '\n';
    csv += this.arrayToCSVRow(['Fallidos', report.statistics.failed]) + '\n';
    csv += this.arrayToCSVRow(['Pendientes', report.statistics.pending]) + '\n';
    csv += this.arrayToCSVRow(['Con Costo', report.statistics.withCost]) + '\n';
    csv += this.arrayToCSVRow(['Activos', report.statistics.active]) + '\n';
    csv += this.arrayToCSVRow(['Costo Total', `$${report.statistics.totalCost}`]) + '\n';
    csv += this.arrayToCSVRow(['Tasa de Éxito (%)', report.statistics.successRate]) + '\n';
    csv += this.arrayToCSVRow(['Tiempo Promedio (seg)', report.statistics.averageProcessingTime]) + '\n';
    
    return csv;
  }

  arrayToCSVRow(array) {
    return array.map(field => {
      if (field === null || field === undefined) {
        return '';
      }
      
      const stringField = String(field);
      
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return '"' + stringField.replace(/"/g, '""') + '"';
      }
      
      return stringField;
    }).join(',');
  }

  getFilename(report) {
    const date = new Date(report.createdAt).toISOString().split('T')[0];
    return `reporte_expedientes_${report.type}_${date}.csv`;
  }

  getMimeType() {
    return 'text/csv';
  }
}

module.exports = CSVExporter;