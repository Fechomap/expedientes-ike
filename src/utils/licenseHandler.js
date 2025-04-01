// src/utils/licenseHandler.js
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const moment = require('moment');
const Store = require('electron-store');
const { app, dialog } = require('electron');
const os = require('os');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');

// Importar constantes desde config
const { API_CONFIG, TOKEN_STATUS, ERROR_MESSAGES } = require('../config/constants');

class LicenseHandler {
  constructor() {
    // Configurar logging
    this.log = log.scope('license');
    this.log.info('Inicializando LicenseHandler');
    
    // Obtener y mostrar la ruta donde Electron guarda los datos de usuario
    const storePath = app.getPath('userData');
    this.log.info('Store path:', storePath);

    // Construir la ruta completa del archivo que utiliza electron-store
    const filePath = path.join(storePath, 'license.json');
    
    // Verificar si el archivo existe y si su contenido es un JSON válido
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        JSON.parse(fileContent);
      } catch (error) {
        this.log.error('Archivo de configuración corrupto. Se eliminará para evitar conflictos.', error);
        fs.unlinkSync(filePath); // Elimina el archivo corrupto
      }
    }

    // Crear la instancia de electron-store
    this.store = new Store({
      name: 'license',
      // Agregar encriptación opcional para mayor seguridad
      encryptionKey: 'ike-secure-key-2024'
    });
    
    this.client = null;
    this.checkInterval = null;
    this.EXPIRATION_WARNING_DAYS = 3;
    this.TRIAL_PERIOD_DAYS = 30;
    
    // Límites para las solicitudes a la API
    this.API_TIMEOUT = 15000; // 15 segundos
    this.API_RETRY_LIMIT = 3;
    this.API_RETRY_DELAY = 2000; // 2 segundos
  }

  // Método para obtener información del dispositivo con más detalles
  getDeviceInfo() {
    try {
      const info = {
        platform: process.platform,
        hostname: os.hostname(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        osType: os.type(),
        osRelease: os.release(),
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        userDataPath: app.getPath('userData'),
        date: new Date().toISOString()
      };

      return {
        ...info,
        totalMemory: `${Math.round(info.totalMemory / (1024 * 1024 * 1024))}GB`,
        cpus: `${info.cpus} cores`
      };
    } catch (error) {
      this.log.error('Error getting device info:', error);
      return {
        platform: 'unknown',
        hostname: 'unknown',
        arch: 'unknown',
        cpus: 'unknown',
        totalMemory: 'unknown',
        osType: 'unknown',
        osRelease: 'unknown',
        appVersion: app.getVersion(),
        error: error.message
      };
    }
  }

  // Método para guardar el token validado
  async saveValidatedToken(tokenData) {
    try {
      // Agregar más metadatos
      const enrichedTokenData = {
        ...tokenData,
        validatedAt: new Date().toISOString(),
        appVersion: app.getVersion()
      };
      
      this.store.set('validatedToken', enrichedTokenData);
      this.log.info('Token guardado exitosamente:', tokenData.token);
      return true;
    } catch (error) {
      this.log.error('Error al guardar el token:', error);
      return false;
    }
  }

  // Método para obtener el token guardado
  getStoredToken() {
    try {
      const tokenData = this.store.get('validatedToken');
      if (tokenData) {
        this.log.info('Token almacenado encontrado, expira:', tokenData.expiresAt);
        return tokenData;
      }
      this.log.info('No se encontró token almacenado');
      return null;
    } catch (error) {
      this.log.error('Error al obtener el token guardado:', error);
      return null;
    }
  }

  // Método para generar un machineId basado en información del sistema
  generateMachineId() {
    try {
      const platform = process.platform;
      const hostname = os.hostname();
      const username = process.env.USERNAME || process.env.USER;
      const cpuInfo = JSON.stringify(os.cpus()[0]);
      
      // Usar más información para crear un ID más único
      return crypto
        .createHash('sha256')
        .update(`${platform}-${hostname}-${username}-${cpuInfo}`)
        .digest('hex');
    } catch (error) {
      this.log.error('Error al generar machineId:', error);
      // Fallback en caso de error
      return crypto
        .createHash('sha256')
        .update(`fallback-${Date.now()}-${Math.random()}`)
        .digest('hex');
    }
  }

  // Método mejorado para realizar solicitudes a la API con reintentos
  async apiRequest(url, method, data = null, retryCount = 0) {
    try {
      const config = {
        method,
        url,
        headers: API_CONFIG.HEADERS,
        timeout: this.API_TIMEOUT
      };
      
      if (data && (method === 'post' || method === 'put')) {
        config.data = data;
      }
      
      this.log.info(`Enviando solicitud ${method.toUpperCase()} a: ${url}`);
      const response = await axios(config);
      return response.data;
    } catch (error) {
      // Registrar detalles del error
      this.log.error(`Error en solicitud ${method.toUpperCase()} a ${url}:`, error.message);
      
      if (error.response) {
        this.log.error('Respuesta del servidor:', error.response.status, error.response.data);
        return { 
          success: false, 
          status: error.response.status,
          message: error.response.data?.message || ERROR_MESSAGES.SERVER_ERROR 
        };
      }
      
      // Reintentar en caso de errores de red si no se excede el límite
      if (retryCount < this.API_RETRY_LIMIT && 
          (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')) {
        this.log.info(`Reintentando solicitud (${retryCount + 1}/${this.API_RETRY_LIMIT})...`);
        await new Promise(resolve => setTimeout(resolve, this.API_RETRY_DELAY));
        return this.apiRequest(url, method, data, retryCount + 1);
      }
      
      // Si aún falla después de los reintentos o es otro tipo de error
      return {
        success: false,
        error: error.message,
        message: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  }

  // Método mejorado para validar token con la API
  async validateToken(token) {
    if (!token || token.trim() === '') {
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: 'El token no puede estar vacío'
      };
    }
    
    try {
      const deviceInfo = this.getDeviceInfo();
      const machineId = this.generateMachineId();
      const deviceInfoString = JSON.stringify(deviceInfo);

      this.log.info('Validando token:', token);
      
      // Usar el método apiRequest con reintentos
      const response = await this.apiRequest(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDATE_TOKEN}`,
        'post',
        {
          token,
          machineId,
          deviceInfo: deviceInfoString
        }
      );

      this.log.info('Respuesta de validación de token:', JSON.stringify(response));

      if (response.success) {
        const tokenData = {
          token,
          machineId,
          deviceInfo: deviceInfoString,
          expiresAt: response.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          lastValidation: new Date().toISOString()
        };

        // Guardar el token validado
        await this.saveValidatedToken(tokenData);

        return {
          valid: true,
          status: TOKEN_STATUS.VALID,
          expiresAt: tokenData.expiresAt,
          message: 'Token validado correctamente'
        };
      }

      // Si la respuesta no es exitosa
      return {
        valid: false,
        status: response.status === 403 ? TOKEN_STATUS.EXPIRED : TOKEN_STATUS.INVALID,
        message: response.message || ERROR_MESSAGES.INVALID_TOKEN
      };

    } catch (error) {
      this.log.error('Error inesperado al validar token:', error);
      
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: ERROR_MESSAGES.VALIDATION_ERROR
      };
    }
  }

  // Método mejorado para verificar el estado del token almacenado
  async checkTokenStatus() {
    const storedToken = this.getStoredToken();

    if (!storedToken) {
      this.log.info('No hay token almacenado');
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: 'No hay token almacenado',
        requiresToken: true
      };
    }

    // Verificar si el token ha expirado localmente
    const now = moment();
    const expirationDate = moment(storedToken.expiresAt);
    const daysUntilExpiration = expirationDate.diff(now, 'days');

    this.log.info(`Días hasta expiración: ${daysUntilExpiration}`);

    if (now.isAfter(expirationDate)) {
      this.log.info('Token expirado, se marca como renovable');
      return {
        valid: false,
        status: TOKEN_STATUS.RENEWABLE,
        message: ERROR_MESSAGES.RENEWABLE_TOKEN,
        token: storedToken.token,
        expiresAt: storedToken.expiresAt,
        expired: true,
        renewable: true
      };
    }

    // Si el token no ha expirado, verificar si está cerca de expirar
    if (daysUntilExpiration <= this.EXPIRATION_WARNING_DAYS) {
      this.log.info('Token próximo a expirar');
      return {
        valid: true,
        status: TOKEN_STATUS.VALID,
        expiresAt: storedToken.expiresAt,
        message: `Token válido, expira en ${daysUntilExpiration} días`,
        warning: true,
        daysUntilExpiration
      };
    }

    // Token válido y no cerca de expirar
    return {
      valid: true,
      status: TOKEN_STATUS.VALID,
      expiresAt: storedToken.expiresAt,
      message: 'Token válido',
      daysUntilExpiration
    };
  }

  // Método mejorado para la verificación de licencia inicial
  async checkInitialLicense() {
    try {
      const storedToken = this.getStoredToken();
      
      if (!storedToken || !storedToken.token) {
        return {
          valid: false,
          message: 'No hay token almacenado',
          requiresToken: true
        };
      }
    
      // Verificación local de expiración
      const now = moment();
      const expirationDate = moment(storedToken.expiresAt);
      
      // Si la fecha ha expirado O ha pasado más de 24 horas desde la última verificación
      // con el servidor, debemos verificar con el servidor
      const lastVerification = storedToken.lastServerValidation ? 
        moment(storedToken.lastServerValidation) : null;
      const needsVerification = !lastVerification || 
        now.diff(lastVerification, 'hours') >= 24 || 
        now.isAfter(expirationDate);
        
      if (needsVerification) {
        this.log.info('Se requiere verificación con el servidor...');
        
        try {
          const serverStatus = await this.validateWithServer();
          
          // Si el servidor indica que el token es válido
          if (serverStatus.valid) {
            this.log.info('El servidor indica que el token sigue válido');
            return {
              valid: true,
              token: storedToken.token,
              expiresAt: storedToken.expiresAt
            };
          }
          
          // Si el servidor confirma que no es válido
          this.log.info('El servidor confirma que el token no es válido');
          return {
            valid: false,
            message: ERROR_MESSAGES.EXPIRED_TOKEN,
            requiresToken: true
          };
        } catch (serverError) {
          // Si no podemos conectar con el servidor
          this.log.error('Error al verificar con servidor:', serverError.message);
          
          // Si el token ya está expirado localmente y no podemos verificar,
          // entonces lo consideramos inválido
          if (now.isAfter(expirationDate)) {
            return {
              valid: false,
              message: ERROR_MESSAGES.RENEWABLE_TOKEN,
              requiresToken: true,
              expired: true,
              renewable: true
            };
          }
          
          // Solo permitimos el modo sin conexión si no ha expirado localmente
          return {
            valid: true,
            token: storedToken.token,
            expiresAt: storedToken.expiresAt,
            offlineMode: true,
            message: 'Modo sin conexión: Usando token local temporalmente'
          };
        }
      }
      
      // Si el token no está expirado localmente y no necesita verificación
      const daysUntilExpiration = expirationDate.diff(now, 'days');
      const warning = daysUntilExpiration <= this.EXPIRATION_WARNING_DAYS;
      
      return {
        valid: true,
        token: storedToken.token,
        expiresAt: storedToken.expiresAt,
        message: warning ? 
          `Token válido, expira en ${daysUntilExpiration} días` : 
          'Token válido',
        warning,
        daysUntilExpiration
      };
    } catch (error) {
      this.log.error('Error en checkInitialLicense:', error);
      return {
        valid: false,
        message: error.message || 'Error al verificar la licencia',
        requiresToken: true
      };
    }
  }
  
  // Método mejorado para validar con el servidor
  async validateWithServer() {
    try {
      const storedToken = this.getStoredToken();
      
      if (!storedToken || !storedToken.token) {
        this.log.info('No hay token para validar con el servidor');
        return { valid: false, message: 'No hay token para validar' };
      }
    
      this.log.info('Consultando si el token está activo...');
      
      // Usar el método apiRequest con reintentos
      const validityResponse = await this.apiRequest(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHECK_VALIDITY}/${storedToken.token}`,
        'get'
      );
      
      this.log.info('Respuesta de validez:', validityResponse);
      
      // Analizar la respuesta
      const isActive = validityResponse === true || validityResponse.success === true;
      
      if (isActive) {
        this.log.info('El token está activo según el servidor');
        
        // Actualización del token
        const updatedToken = {
          ...storedToken,
          lastServerValidation: new Date().toISOString(),
          verified: true
        };
        
        await this.saveValidatedToken(updatedToken);
        this.log.info('Token actualizado con verificación del servidor');
        
        return {
          valid: true,
          message: 'Token activo en servidor',
          expiresAt: storedToken.expiresAt
        };
      } else {
        this.log.info('El token no está activo según el servidor');
        return {
          valid: false,
          message: validityResponse.message || 'El token no está activo en el servidor'
        };
      }
    } catch (error) {
      this.log.error('Error en validación con servidor:', error);
      
      if (error.response) {
        this.log.error('Respuesta de error del servidor:', error.response.data);
        return { 
          valid: false, 
          message: `Error del servidor: ${error.response.status}` 
        };
      }
      
      // Si hay error de red/conexión
      if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        throw new Error('Error de conexión: No se pudo contactar con el servidor de licencias');
      }
      
      throw new Error(`Error de validación: ${error.message}`);
    }
  }

  // Métodos relacionados con la conexión a MongoDB y validación de licencia
  async connect() {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI no está definida en las variables de entorno.');
      }

      if (!this.client) {
        this.client = new MongoClient(process.env.MONGODB_URI);
        await this.client.connect();
        this.log.info('Conexión exitosa a MongoDB');
      }

      const db = this.client.db(process.env.MONGODB_DB);
      return db.collection(process.env.MONGODB_COLLECTION);
    } catch (error) {
      this.log.error('Error en connect:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  async validateLicense(licenseKey) {
    try {
      // Retraso artificial para simular el proceso de validación
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.log.info('Validando licencia:', licenseKey);
      const collection = await this.connect();

      const license = await collection.findOne({ key: licenseKey });
      this.log.info('Licencia encontrada:', license);

      if (!license) {
        return { valid: false, message: 'Licencia no encontrada' };
      }

      if (license.active === false) {
        return { valid: false, message: 'Licencia inactiva en el servidor' };
      }

      const now = moment();
      const expirationDate = moment(license.expiresAt);
      const daysUntilExpiration = expirationDate.diff(now, 'days');

      if (daysUntilExpiration < 0) {
        return { valid: false, message: 'Licencia expirada' };
      }

      const machineId = this.generateMachineId();
      if (license.machineId && license.machineId !== machineId) {
        return { valid: false, message: 'Licencia en uso en otra máquina' };
      }

      if (!license.machineId) {
        await collection.updateOne(
          { key: licenseKey },
          { $set: { machineId } }
        );
      }

      // Almacenar información de la licencia
      const licenseInfo = {
        key: licenseKey,
        type: license.type,
        expiresAt: license.expiresAt,
        features: license.features || {},
        machineId
      };
      this.store.set('license', licenseInfo);

      // Eliminar información del periodo de prueba si existe
      if (this.store.has('trial')) {
        this.store.delete('trial');
      }

      return {
        valid: true,
        type: license.type,
        daysRemaining: daysUntilExpiration,
        warning: daysUntilExpiration <= this.EXPIRATION_WARNING_DAYS,
        message: 'Licencia válida'
      };
    } catch (error) {
      this.log.error('Error en validateLicense:', error);
      return { valid: false, message: 'Error al validar licencia' };
    } finally {
      await this.disconnect();
    }
  }

  async startTrialPeriod() {
    const trialInfo = {
      type: 'trial',
      startDate: new Date(),
      expiresAt: moment().add(this.TRIAL_PERIOD_DAYS, 'days').toDate(),
      machineId: this.generateMachineId()
    };
    this.store.set('trial', trialInfo);
    return trialInfo;
  }

  isTrialValid() {
    const trial = this.store.get('trial');
    if (!trial) return { valid: false };

    const now = moment();
    const expirationDate = moment(trial.expiresAt);
    const daysRemaining = expirationDate.diff(now, 'days');

    return {
      valid: daysRemaining >= 0,
      daysRemaining,
      warning: daysRemaining <= this.EXPIRATION_WARNING_DAYS
    };
  }

  // Métodos para manejar diálogos y estados de licencia/token
  handleInvalidToken(message) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Token Inválido',
      message: message,
      detail: 'Por favor, ingrese un nuevo token para continuar.',
      buttons: ['Ingresar Token', 'Salir'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        // Aquí se debería abrir la ventana de ingreso de token
        // this.openTokenWindow();
      } else {
        app.quit();
      }
    });
    return { valid: false, message };
  }

  handleNoLicense() {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Licencia Requerida',
      message: 'No se ha encontrado una licencia válida.',
      detail: '¿Desea iniciar un periodo de prueba de 30 días o ingresar una licencia?',
      buttons: ['Iniciar Prueba', 'Ingresar Licencia', 'Salir'],
      defaultId: 0
    }).then(async ({ response }) => {
      if (response === 0) {
        await this.startTrialPeriod();
      } else if (response === 1) {
        // Aquí se debería abrir la ventana de ingreso de licencia
        // this.openLicenseWindow();
      } else {
        app.quit();
      }
    });
    return { valid: false, message: 'Se requiere licencia' };
  }

  handleInvalidLicense(message) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Licencia Inválida',
      message: message,
      detail: 'La aplicación se cerrará.',
      buttons: ['OK']
    }).then(() => {
      app.quit();
    });
    return { valid: false, message };
  }

  handleTrialExpired() {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Periodo de Prueba Expirado',
      message: 'Su periodo de prueba ha expirado.',
      detail: 'Por favor, ingrese una licencia válida para continuar usando la aplicación.',
      buttons: ['Ingresar Licencia', 'Salir'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        // Aquí se debería abrir la ventana de ingreso de licencia
        // this.openLicenseWindow();
      } else {
        app.quit();
      }
    });
    return { valid: false, message: 'Periodo de prueba expirado' };
  }

  showExpirationWarning(daysRemaining) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Licencia por Expirar',
      message: `Su licencia expirará en ${daysRemaining} días.`,
      detail: 'Por favor, renueve su licencia para continuar usando la aplicación.',
      buttons: ['OK']
    });
  }

  showTrialExpirationWarning(daysRemaining) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Periodo de Prueba por Expirar',
      message: `Su periodo de prueba expirará en ${daysRemaining} días.`,
      detail: 'Para continuar usando la aplicación después de este periodo, necesitará una licencia válida.',
      buttons: ['OK']
    });
  }

  startPeriodicCheck(interval = 24 * 60 * 60 * 1000) { // Por defecto, cada 24 horas
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.checkInterval = setInterval(() => this.checkInitialLicense(), interval);
  }

  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

module.exports = LicenseHandler;