const { ValidationError } = require('../../../shared/errors');

class License {
  constructor(data) {
    this.validateData(data);
    
    this.token = data.token;
    this.isValid = data.isValid || false;
    this.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    this.userId = data.userId;
    this.permissions = data.permissions || [];
    this.isOfflineMode = data.isOfflineMode || false;
    this.lastValidated = data.lastValidated ? new Date(data.lastValidated) : new Date();
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  }

  validateData(data) {
    if (!data.token) {
      throw new ValidationError('Token is required', 'token', data.token);
    }

    if (data.expiresAt && isNaN(Date.parse(data.expiresAt))) {
      throw new ValidationError('Invalid expiration date', 'expiresAt', data.expiresAt);
    }
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  isActive() {
    return this.isValid && !this.isExpired();
  }

  markAsValidated() {
    this.lastValidated = new Date();
    this.isValid = true;
  }

  markAsInvalid() {
    this.isValid = false;
  }

  enableOfflineMode() {
    this.isOfflineMode = true;
  }

  disableOfflineMode() {
    this.isOfflineMode = false;
  }

  toJSON() {
    return {
      token: this.token,
      isValid: this.isValid,
      expiresAt: this.expiresAt?.toISOString(),
      userId: this.userId,
      permissions: this.permissions,
      isOfflineMode: this.isOfflineMode,
      lastValidated: this.lastValidated.toISOString(),
      createdAt: this.createdAt.toISOString()
    };
  }

  static fromJSON(data) {
    return new License(data);
  }

  static fromAPIResponse(apiResponse) {
    return new License({
      token: apiResponse.token,
      isValid: apiResponse.valid || false,
      expiresAt: apiResponse.expires_at,
      userId: apiResponse.user_id,
      permissions: apiResponse.permissions || []
    });
  }
}

module.exports = License;