const AppError = require('./AppError');

class ValidationError extends AppError {
  constructor(message, field = null, value = null, originalError = null) {
    super(message, 'VALIDATION_ERROR', originalError);
    this.field = field;
    this.value = value;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
      value: this.value
    };
  }
}

module.exports = ValidationError;