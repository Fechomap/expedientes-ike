const ExcelJS = require('exceljs');
const path = require('path');
const Logger = require('../../shared/utils/Logger');
const { ValidationError } = require('../../shared/errors');
const Expediente = require('../domain/entities/Expediente');
const ProcessEvents = require('../../shared/events/events/ProcessEvents');

class ExcelService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.logger = Logger.getInstance('ExcelService');
  }

  async readExpedientesFromFile(filePath) {
    try {
      this.logger.info('Reading expedientes from Excel file', { filePath });
      
      this.validateFilePath(filePath);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new ValidationError('No worksheet found in Excel file');
      }

      const expedientes = [];
      let rowNumber = 2; // Start from row 2, assuming row 1 has headers

      worksheet.eachRow((row, index) => {
        if (index === 1) return; // Skip header row
        
        try {
          const numeroExpediente = row.getCell(1).value;
          
          if (numeroExpediente && numeroExpediente.toString().trim() !== '') {
            const costoGuardado = row.getCell(2).value || 0; // Columna B = Costo guardado
            
            const expediente = new Expediente({
              numero: numeroExpediente.toString().trim(),
              costoGuardado: parseFloat(costoGuardado) || 0,
              nombre: row.getCell(3).value?.toString().trim() || '' // Columna C = Nombre (opcional)
            });
            
            expedientes.push(expediente);
          }
        } catch (error) {
          this.logger.warn('Error processing row', error, { 
            rowNumber: index,
            expedienteNumber: row.getCell(1).value 
          });
        }
        
        rowNumber++;
      });

      this.logger.info('Expedientes read successfully', { 
        filePath,
        count: expedientes.length 
      });

      return expedientes;
    } catch (error) {
      this.logger.error('Error reading expedientes from Excel file', error);
      throw error;
    }
  }

  async updateExpedientesInFile(filePath, expedientes) {
    try {
      this.logger.info('Updating expedientes in Excel file', { 
        filePath,
        count: expedientes.length 
      });
      
      this.validateFilePath(filePath);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new ValidationError('No worksheet found in Excel file');
      }

      // Create a map for quick lookup
      const expedienteMap = new Map();
      expedientes.forEach(exp => {
        expedienteMap.set(exp.numero, exp);
      });

      let updatedCount = 0;
      
      worksheet.eachRow((row, index) => {
        if (index === 1) return; // Skip header row
        
        const numeroExpediente = row.getCell(1).value?.toString().trim();
        
        if (numeroExpediente && expedienteMap.has(numeroExpediente)) {
          const expediente = expedienteMap.get(numeroExpediente);
          
          // Update cells with new data (según el formato correcto del usuario)
          const costoCell = row.getCell(3);
          costoCell.value = expediente.costo || 0; // Asegurar que sea número
          costoCell.numFmt = '#,##0.00'; // Formato de número con comas y 2 decimales
          
          row.getCell(4).value = expediente.validacion || ''; // Estatus debe usar validacion (ACEPTADO/PENDIENTES/NO ENCONTRADO)
          row.getCell(5).value = expediente.notas || '';
          row.getCell(6).value = expediente.fechaRegistro || '';
          row.getCell(7).value = expediente.servicio || '';
          row.getCell(8).value = expediente.subservicio || '';
          
          row.commit();
          updatedCount++;
          
          this.eventBus.publish(ProcessEvents.EXCEL_UPDATED, {
            expedienteNumber: numeroExpediente,
            rowIndex: index
          });
        }
      });

      // Save the file
      await workbook.xlsx.writeFile(filePath);
      
      this.logger.info('Excel file updated successfully', { 
        filePath,
        updatedCount 
      });

      return updatedCount;
    } catch (error) {
      this.logger.error('Error updating expedientes in Excel file', error);
      throw error;
    }
  }

  async createNewExcelFile(filePath, expedientes) {
    try {
      this.logger.info('Creating new Excel file', { 
        filePath,
        count: expedientes.length 
      });
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Expedientes');
      
      // Add headers
      const headers = [
        'Número de Expediente',
        'Nombre',
        'Costo',
        'Estatus',
        'Fecha Inicio',
        'Fecha Término',
        'Procedimiento',
        'Abogado',
        'Estado de Procesamiento',
        'Fecha de Procesamiento'
      ];
      
      worksheet.addRow(headers);
      
      // Style headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' }
      };
      
      // Add data rows
      expedientes.forEach(expediente => {
        worksheet.addRow([
          expediente.numero,
          expediente.nombre || '',
          expediente.costo || 'N/A',
          expediente.estatus || 'N/A',
          expediente.fechaInicio || 'N/A',
          expediente.fechaTermino || 'N/A',
          expediente.procedimiento || 'N/A',
          expediente.abogado || 'N/A',
          expediente.status || 'pending',
          expediente.processedAt ? expediente.processedAt.toLocaleString() : 'N/A'
        ]);
      });
      
      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.width = 15;
      });
      
      // Save the file
      await workbook.xlsx.writeFile(filePath);
      
      this.logger.info('New Excel file created successfully', { filePath });
      
      return filePath;
    } catch (error) {
      this.logger.error('Error creating new Excel file', error);
      throw error;
    }
  }

  async validateExcelFile(filePath) {
    try {
      this.logger.debug('Validating Excel file', { filePath });
      
      this.validateFilePath(filePath);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new ValidationError('No worksheet found in Excel file');
      }

      // Check if there are any data rows
      let hasData = false;
      let rowCount = 0;
      
      worksheet.eachRow((row, index) => {
        if (index === 1) return; // Skip header row
        
        const numeroExpediente = row.getCell(1).value;
        if (numeroExpediente && numeroExpediente.toString().trim() !== '') {
          hasData = true;
          rowCount++;
        }
      });

      if (!hasData) {
        throw new ValidationError('Excel file contains no valid expediente data');
      }

      this.logger.debug('Excel file validation successful', { 
        filePath,
        rowCount 
      });

      return {
        valid: true,
        rowCount,
        hasHeaders: true
      };
    } catch (error) {
      this.logger.error('Excel file validation failed', error);
      throw error;
    }
  }

  validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('File path is required', 'filePath', filePath);
    }

    const extension = path.extname(filePath).toLowerCase();
    if (!extension || (extension !== '.xlsx' && extension !== '.xls')) {
      throw new ValidationError('File must be an Excel file (.xlsx or .xls)', 'filePath', filePath);
    }
  }

  async getFileInfo(filePath) {
    try {
      this.validateFilePath(filePath);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new ValidationError('No worksheet found in Excel file');
      }

      let expedienteCount = 0;
      worksheet.eachRow((row, index) => {
        if (index === 1) return; // Skip header row
        
        const numeroExpediente = row.getCell(1).value;
        if (numeroExpediente && numeroExpediente.toString().trim() !== '') {
          expedienteCount++;
        }
      });

      return {
        filePath,
        fileName: path.basename(filePath),
        expedienteCount,
        worksheetCount: workbook.worksheets.length,
        worksheetName: worksheet.name
      };
    } catch (error) {
      this.logger.error('Error getting file info', error);
      throw error;
    }
  }
}

module.exports = ExcelService;