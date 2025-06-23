const { ValidationError } = require('../../../shared/errors');

class Token {
  constructor(value) {
    this.validateToken(value);
    this.value = value;
    this.createdAt = new Date();
  }

  validateToken(value) {
    if (!value || typeof value !== 'string') {
      throw new ValidationError('Token must be a non-empty string', 'token', value);
    }

    if (value.length < 10) {
      throw new ValidationError('Token must be at least 10 characters long', 'token', value);
    }

    if (!/^[a-zA-Z0-9\-_]+$/.test(value)) {
      throw new ValidationError('Token contains invalid characters', 'token', value);
    }
  }

  equals(otherToken) {
    if (!(otherToken instanceof Token)) {
      return false;
    }
    return this.value === otherToken.value;
  }

  toString() {
    return this.value;
  }

  toJSON() {
    return {
      value: this.value,
      createdAt: this.createdAt.toISOString()
    };
  }

  static fromString(value) {
    return new Token(value);
  }

  static fromJSON(data) {
    const token = new Token(data.value);
    if (data.createdAt) {
      token.createdAt = new Date(data.createdAt);
    }
    return token;
  }

  static isValidTokenFormat(value) {
    try {
      new Token(value);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = Token;