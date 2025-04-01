// src/config/constants.js
const API_CONFIG = {
    BASE_URL: 'https://ike-license-manager-9b796c40a448.herokuapp.com',
    ENDPOINTS: {
      VALIDATE_TOKEN: '/api/validate',
      CHECK_VALIDITY: '/api/check-validity'
    },
    HEADERS: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  const TOKEN_STATUS = {
    VALID: 'valid',
    EXPIRED: 'expired',
    INVALID: 'invalid',
    PENDING: 'pending',
    RENEWABLE: 'renewable'
  };
  
  const ERROR_MESSAGES = {
    INVALID_TOKEN: 'Token inválido. Por favor, ingresa un token válido.',
    EXPIRED_TOKEN: 'El token ha expirado. Por favor, solicita uno nuevo.',
    RENEWABLE_TOKEN: 'Su licencia ha expirado pero puede renovarla en la aplicación IKE Licencias.',
    NETWORK_ERROR: 'Error de conexión. Por favor, verifica tu conexión a internet.',
    SERVER_ERROR: 'Error en el servidor. Por favor, intenta más tarde.',
    VALIDATION_ERROR: 'Error durante la validación del token. Inténtelo nuevamente.'
  };
  
  module.exports = {
    API_CONFIG,
    TOKEN_STATUS,
    ERROR_MESSAGES
  };