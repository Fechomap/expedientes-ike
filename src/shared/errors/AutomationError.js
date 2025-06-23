const AppError = require('./AppError');

class AutomationError extends AppError {
  constructor(message, selector = null, action = null, originalError = null) {
    super(message, 'AUTOMATION_ERROR', originalError);
    this.selector = selector;
    this.action = action;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      selector: this.selector,
      action: this.action
    };
  }

  static elementNotFound(selector) {
    return new AutomationError(
      `Element not found: ${selector}`,
      selector,
      'find'
    );
  }

  static actionFailed(action, selector, originalError) {
    return new AutomationError(
      `Action '${action}' failed on selector: ${selector}`,
      selector,
      action,
      originalError
    );
  }
}

module.exports = AutomationError;