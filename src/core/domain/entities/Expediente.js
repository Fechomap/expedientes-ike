const { ValidationError } = require('../../../shared/errors');

class Expediente {
  constructor(data) {
    this.validateData(data);
    
    this.numero = data.numero;
    this.nombre = data.nombre || '';
    this.status = data.status || 'pending';
    this.costoGuardado = data.costoGuardado || 0; // Costo del Excel (columna B)
    this.costo = data.costo || null; // Costo del sistema (resultado de búsqueda)
    this.estatus = data.estatus || '';
    this.notas = data.notas || '';
    this.fechaRegistro = data.fechaRegistro || '';
    this.servicio = data.servicio || '';
    this.subservicio = data.subservicio || '';
    this.validacion = data.validacion || '';
    this.logicUsed = data.logicUsed || null; // Columna 9: Número de lógica usada (1, 2, 3)
    this.validationDate = data.validationDate || null; // Columna 10: Fecha y hora de validación
    this.fechaInicio = data.fechaInicio || null;
    this.fechaTermino = data.fechaTermino || null;
    this.procedimiento = data.procedimiento || '';
    this.abogado = data.abogado || '';
    this.processedAt = data.processedAt ? new Date(data.processedAt) : null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  validateData(data) {
    if (!data.numero) {
      throw new ValidationError('Número de expediente is required', 'numero', data.numero);
    }
  }

  markAsProcessed(result) {
    this.status = result.success ? 'completed' : 'failed';
    this.costo = result.costo || this.costo;
    this.estatus = result.estatus || this.estatus;
    this.notas = result.notas || this.notas;
    this.fechaRegistro = result.fechaRegistro || this.fechaRegistro;
    this.servicio = result.servicio || this.servicio;
    this.subservicio = result.subservicio || this.subservicio;
    this.validacion = result.validacion || this.validacion;
    this.logicUsed = result.logicUsed || this.logicUsed;
    this.validationDate = result.validationDate || this.validationDate;
    this.fechaInicio = result.fechaInicio || this.fechaInicio;
    this.fechaTermino = result.fechaTermino || this.fechaTermino;
    this.procedimiento = result.procedimiento || this.procedimiento;
    this.abogado = result.abogado || this.abogado;
    this.processedAt = new Date();
    this.updatedAt = new Date();
  }

  markAsProcessing() {
    this.status = 'processing';
    this.updatedAt = new Date();
  }

  markAsFailed(error) {
    this.status = 'failed';
    this.error = error;
    this.validacion = 'NO ENCONTRADO';
    this.costo = 0; // Número, no string
    this.estatus = 'N/A';
    this.notas = 'N/A';
    this.fechaRegistro = 'N/A';
    this.servicio = 'N/A';
    this.subservicio = 'N/A';
    this.logicUsed = 'N/A'; // Expediente no encontrado = N/A
    this.validationDate = new Date();
    this.updatedAt = new Date();
  }

  isProcessed() {
    return this.status === 'completed';
  }

  hasCost() {
    return this.costo !== null && this.costo !== '' && this.costo !== 'N/A';
  }

  isActive() {
    return this.estatus === 'Activo' || this.estatus === 'En trámite';
  }

  toJSON() {
    return {
      numero: this.numero,
      nombre: this.nombre,
      status: this.status,
      costoGuardado: this.costoGuardado,
      costo: this.costo,
      estatus: this.estatus,
      notas: this.notas,
      fechaRegistro: this.fechaRegistro,
      servicio: this.servicio,
      subservicio: this.subservicio,
      validacion: this.validacion,
      logicUsed: this.logicUsed,
      validationDate: this.validationDate?.toISOString(),
      fechaInicio: this.fechaInicio,
      fechaTermino: this.fechaTermino,
      procedimiento: this.procedimiento,
      abogado: this.abogado,
      processedAt: this.processedAt?.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  static fromJSON(data) {
    return new Expediente(data);
  }

  static fromExcelRow(row) {
    return new Expediente({
      numero: row.getCell(1).value,
      nombre: row.getCell(2).value || ''
    });
  }
}

module.exports = Expediente;