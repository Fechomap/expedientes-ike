const ExcelJS = require('exceljs');
const Logger = require('../../../shared/utils/Logger');

class ExcelExporter {
  constructor() {
    this.logger = Logger.getInstance('ExcelExporter');
  }

  async export(report) {
    try {
      this.logger.info('Exporting report to Excel', { reportId: report.id });
      
      const workbook = new ExcelJS.Workbook();
      
      workbook.creator = 'IKE Expedientes Automation';
      workbook.lastModifiedBy = 'System';
      workbook.created = new Date();
      
      this.addSummarySheet(workbook, report);
      this.addDetailSheet(workbook, report);
      this.addStatisticsSheet(workbook, report);
      
      const buffer = await workbook.xlsx.writeBuffer();
      
      this.logger.info('Excel export completed', { 
        reportId: report.id,
        bufferSize: buffer.length
      });
      
      return buffer;
    } catch (error) {
      this.logger.error('Error exporting to Excel', error);
      throw error;
    }
  }

  addSummarySheet(workbook, report) {
    const sheet = workbook.addWorksheet('Resumen');
    
    sheet.addRow(['Reporte de Expedientes IKE']);
    sheet.addRow([]);
    sheet.addRow(['Información General']);
    sheet.addRow(['Tipo de Reporte:', report.type]);
    sheet.addRow(['Fecha de Generación:', report.createdAt.toLocaleString()]);
    sheet.addRow(['Total de Expedientes:', report.statistics.total]);
    sheet.addRow([]);
    
    sheet.addRow(['Estadísticas']);
    sheet.addRow(['Procesados Exitosamente:', report.statistics.completed]);
    sheet.addRow(['Fallidos:', report.statistics.failed]);
    sheet.addRow(['Pendientes:', report.statistics.pending]);
    sheet.addRow(['Con Costo:', report.statistics.withCost]);
    sheet.addRow(['Activos:', report.statistics.active]);
    sheet.addRow(['Costo Total:', `$${report.statistics.totalCost}`]);
    sheet.addRow(['Tasa de Éxito:', `${report.statistics.successRate}%`]);
    sheet.addRow(['Tiempo Promedio (seg):', report.statistics.averageProcessingTime]);
    
    this.styleHeaderRow(sheet, 1);
    this.styleHeaderRow(sheet, 3);
    this.styleHeaderRow(sheet, 8);
    
    sheet.columns = [
      { width: 25 },
      { width: 20 }
    ];
  }

  addDetailSheet(workbook, report) {
    const sheet = workbook.addWorksheet('Detalle');
    
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
    
    sheet.addRow(headers);
    this.styleHeaderRow(sheet, 1);
    
    report.expedientes.forEach(expediente => {
      sheet.addRow([
        expediente.numero,
        expediente.status,
        expediente.costo || 'N/A',
        expediente.estatus || 'N/A',
        expediente.fechaInicio || 'N/A',
        expediente.fechaTermino || 'N/A',
        expediente.procedimiento || 'N/A',
        expediente.abogado || 'N/A',
        expediente.processedAt ? expediente.processedAt.toLocaleString() : 'N/A'
      ]);
    });
    
    sheet.columns = headers.map(() => ({ width: 15 }));
    
    this.addConditionalFormatting(sheet, report.expedientes.length + 1);
  }

  addStatisticsSheet(workbook, report) {
    const sheet = workbook.addWorksheet('Análisis');
    
    sheet.addRow(['Análisis Detallado']);
    sheet.addRow([]);
    
    const expedientesConCosto = report.expedientes.filter(exp => 
      exp.costo && exp.costo !== 'N/A' && exp.costo !== ''
    );
    
    if (expedientesConCosto.length > 0) {
      sheet.addRow(['Distribución de Costos']);
      
      const costoPromedio = expedientesConCosto
        .reduce((sum, exp) => {
          const costo = parseFloat(exp.costo.toString().replace(/[^\d.-]/g, ''));
          return sum + (isNaN(costo) ? 0 : costo);
        }, 0) / expedientesConCosto.length;
      
      sheet.addRow(['Costo Promedio:', `$${costoPromedio.toFixed(2)}`]);
      sheet.addRow(['Expedientes con Costo:', expedientesConCosto.length]);
      sheet.addRow(['% con Costo:', `${((expedientesConCosto.length / report.expedientes.length) * 100).toFixed(2)}%`]);
    }
    
    sheet.addRow([]);
    sheet.addRow(['Distribución por Estado']);
    
    const estadosCount = report.expedientes.reduce((acc, exp) => {
      acc[exp.estatus || 'Sin Estatus'] = (acc[exp.estatus || 'Sin Estatus'] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(estadosCount).forEach(([estado, count]) => {
      sheet.addRow([estado, count]);
    });
    
    this.styleHeaderRow(sheet, 1);
    this.styleHeaderRow(sheet, 3);
    this.styleHeaderRow(sheet, 8);
    
    sheet.columns = [
      { width: 25 },
      { width: 15 }
    ];
  }

  styleHeaderRow(sheet, rowNumber) {
    const row = sheet.getRow(rowNumber);
    row.font = { bold: true, size: 12 };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7E6E6' }
    };
  }

  addConditionalFormatting(sheet, dataRows) {
    sheet.addConditionalFormatting({
      ref: `B2:B${dataRows}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"completed"'],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FF90EE90' }
            }
          }
        },
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"failed"'],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFFFCCCB' }
            }
          }
        }
      ]
    });
  }

  getFilename(report) {
    const date = new Date(report.createdAt).toISOString().split('T')[0];
    return `reporte_expedientes_${report.type}_${date}.xlsx`;
  }

  getMimeType() {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
}

module.exports = ExcelExporter;