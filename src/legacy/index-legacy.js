// src/index.js
const path = require('path');
const fs = require('fs');

const { readExpedientesAndRows } = require('./utils/readExcel');
const BrowserHandler = require('./utils/browserHandler');

async function processExcelFile(filePath, progressCallback) {
  try {
    console.log(`Iniciando procesamiento de archivo: ${filePath}`);
    progressCallback({ message: 'Leyendo archivo Excel...' });
    
    const { workbook, worksheet, filas } = await readExpedientesAndRows(filePath);
    if (filas.length === 0) {
      throw new Error('No se encontraron expedientes en el archivo.');
    }

    const browserHandler = new BrowserHandler();
    progressCallback({ message: 'Inicializando navegador...' });
    
    const initialized = await browserHandler.initialize();
    if (!initialized) {
      throw new Error('No se pudo inicializar el navegador.');
    }

    const resultados = [];
    const batchSize = 5;

    for (let i = 0; i < filas.length; i++) {
      let result = null;
      try {
        const { expediente, rowNumber } = filas[i];
        const row = worksheet.getRow(rowNumber);
        const costoGuardado = row.getCell(2).value || 0;

        const progressPercent = Math.round(((i + 1) / filas.length) * 100);
        
        // Actualización de progreso por expediente
        progressCallback({ 
          message: `Revisando expediente ${i + 1} de ${filas.length} (${progressPercent}%)`,
          detail: `Expediente: ${expediente} - Fila: ${rowNumber}`,
          progress: progressPercent,
          stats: browserHandler.stats
        });

        result = await browserHandler.searchExpediente(expediente, costoGuardado);
        
        // === Actualización de celdas ===
        row.getCell(3).value = result.costo || 'Error';
        row.getCell(4).value = result.estatus || 'N/A';
        row.getCell(5).value = result.notas || 'N/A';
        row.getCell(6).value = result.fechaRegistro || 'N/A';
        row.getCell(7).value = result.servicio || 'N/A';
        row.getCell(8).value = result.subservicio || 'N/A';
        row.getCell(9).value = result.validacion || 'N/A';
        row.commit();

        // Guardado para debug
        try {
          await workbook.xlsx.writeFile(filePath);
        } catch (saveError) {
          console.error(`Error al guardar fila ${i + 1}:`, saveError.message);
          throw saveError;
        }

        if (result.costo && result.costo !== '$0.00') {
          resultados.push({
            expediente,
            costoGuardado: `$${costoGuardado}`,
            costoSistema: result.costo,
            estatus: result.estatus,
            notas: result.notas,
            fechaRegistro: result.fechaRegistro,
            servicio: result.servicio,
            subservicio: result.subservicio,
            validacion: result.validacion,
            fechaConsulta: new Date().toISOString()
          });
        }

      } catch (error) {
        console.error(`Error procesando expediente: ${error.message}`);
        result = {
          costo: '',
          estatus: '',
          notas: '',
          fechaRegistro: '',
          servicio: '',
          subservicio: '',
          validacion: 'Error en consulta',
          stats: browserHandler.stats
        };
      }

      // Guardado parcial sin actualizar progreso
      if ((i + 1) % batchSize === 0 || i === filas.length - 1) {
        await workbook.xlsx.writeFile(filePath);
      }
    }

    await browserHandler.close();

    // Generar reporte CSV
    console.log('Reporte CSV omitido por configuración actual.');

    progressCallback({ 
      message: `Proceso finalizado. Se revisaron ${filas.length} expedientes.`,
      progress: 100,
      final: true,
      stats: browserHandler.stats
    });

    return true;
  } catch (error) {
    console.error(`Error crítico: ${error.message}`);
    throw error;
  }
}

module.exports = { processExcelFile };