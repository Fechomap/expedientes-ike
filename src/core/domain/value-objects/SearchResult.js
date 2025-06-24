class SearchResult {
  constructor(data) {
    this.expedienteNumero = data.expedienteNumero;
    this.success = data.success || false;
    this.costo = data.costo || null;
    this.estatus = data.estatus || 'N/A';
    this.notas = data.notas || '';
    this.fechaRegistro = data.fechaRegistro || '';
    this.servicio = data.servicio || '';
    this.subservicio = data.subservicio || '';
    this.validacion = data.validacion || '';
    this.logicUsed = data.logicUsed || null;
    this.validationDate = data.validationDate || null;
    this.fechaInicio = data.fechaInicio || null;
    this.fechaTermino = data.fechaTermino || null;
    this.procedimiento = data.procedimiento || '';
    this.abogado = data.abogado || '';
    this.error = data.error || null;
    this.processingTime = data.processingTime || 0;
    this.timestamp = data.timestamp || new Date();
    this.metadata = data.metadata || {};
  }

  isSuccessful() {
    return this.success && !this.error;
  }

  hasCost() {
    return this.costo !== null && this.costo !== '' && this.costo !== 'N/A';
  }

  isActive() {
    return this.estatus === 'Activo' || this.estatus === 'En trámite';
  }

  hasValidDates() {
    return this.fechaInicio !== null || this.fechaTermino !== null;
  }

  getCostAsNumber() {
    if (!this.hasCost()) return 0;
    
    const cleanCost = this.costo.toString().replace(/[^\d.-]/g, '');
    const cost = parseFloat(cleanCost);
    
    return isNaN(cost) ? 0 : cost;
  }

  addMetadata(key, value) {
    this.metadata[key] = value;
  }

  toJSON() {
    return {
      expedienteNumero: this.expedienteNumero,
      success: this.success,
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
      error: this.error,
      processingTime: this.processingTime,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    return new SearchResult({
      ...data,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
    });
  }

  static success(expedienteNumero, data) {
    return new SearchResult({
      expedienteNumero,
      success: true,
      ...data
    });
  }

  static failure(expedienteNumero, error, processingTime = 0) {
    return new SearchResult({
      expedienteNumero,
      success: false,
      error: error.message || error,
      processingTime,
      costo: 0, // Número, no string
      estatus: 'N/A',
      notas: 'N/A',
      fechaRegistro: 'N/A',
      servicio: 'N/A',
      subservicio: 'N/A',
      validacion: 'NO ENCONTRADO',
      logicUsed: 'N/A', // N/A = No encontrado
      validationDate: new Date()
    });
  }

  static empty(expedienteNumero) {
    return new SearchResult({
      expedienteNumero,
      success: true,
      costo: 0, // Número, no string
      estatus: 'N/A',
      notas: 'N/A',
      fechaRegistro: 'N/A',
      servicio: 'N/A',
      subservicio: 'N/A',
      validacion: 'NO ENCONTRADO',
      logicUsed: 'N/A', // N/A = No encontrado
      validationDate: new Date()
    });
  }
}

module.exports = SearchResult;