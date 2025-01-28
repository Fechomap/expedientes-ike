// src/utils/readExcel.js
const ExcelJS = require('exceljs');

async function readExpedientesAndRows(filePath) {
  console.log(`Iniciando lectura del archivo Excel: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
    console.log('Archivo Excel leído correctamente');
  } catch (error) {
    console.log(`Error al leer el archivo Excel: ${error.message}`);
    throw new Error(`No se puede abrir el archivo. Verifique que no esté abierto en otro programa.`);
  }

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    console.log('No se encontró la hoja de trabajo');
    throw new Error('El archivo debe contener al menos una hoja.');
  }

  const filas = [];
  let rowCount = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Saltar encabezado

    const cellA = row.getCell(1).value;
    if (!cellA) {
      console.log(`Fila ${rowNumber} vacía en columna A. Saltando...`);
      return;
    }

    const expediente = String(cellA).trim();
    if (/^\d+$/.test(expediente)) {
      filas.push({ expediente, rowNumber });
      rowCount++;
    } else {
      console.log(`Expediente inválido en fila ${rowNumber}: ${expediente}`);
    }
  });

  console.log(`Filas válidas encontradas: ${rowCount}`);
  return { workbook, worksheet, filas };
}

module.exports = {
  readExpedientesAndRows
};