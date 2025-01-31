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

// Definición de constantes
const TOKEN_STATUS = {
  VALID: 'valid',
  EXPIRED: 'expired',
  INVALID: 'invalid',
  PENDING: 'pending'
};

const ERROR_MESSAGES = {
  INVALID_TOKEN: 'Token inválido. Por favor, ingresa un token válido.',
  EXPIRED_TOKEN: 'El token ha expirado. Por favor, solicita uno nuevo.',
  NETWORK_ERROR: 'Error de conexión. Por favor, verifica tu conexión a internet.',
  SERVER_ERROR: 'Error en el servidor. Por favor, intenta más tarde.'
};

const API_CONFIG = {
  BASE_URL: 'https://ike-license-manager-9b796c40a448.herokuapp.com',
  ENDPOINTS: {
    VALIDATE_TOKEN: '/api/validate'
  },
  HEADERS: {
    'Content-Type': 'application/json'
  }
};

class LicenseHandler {
  constructor() {
    // Obtener y mostrar la ruta donde Electron guarda los datos de usuario
    const storePath = app.getPath('userData');
    console.log('Store path:', storePath);

    // Construir la ruta completa del archivo que utiliza electron-store para este store (por defecto, el archivo se llamará license.json)
    const filePath = path.join(storePath, 'license.json');
    
    // Verificar si el archivo existe y si su contenido es un JSON válido
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        JSON.parse(fileContent);
      } catch (error) {
        console.error('Archivo de configuración corrupto. Se eliminará para evitar conflictos.', error);
        fs.unlinkSync(filePath); // Elimina el archivo corrupto
      }
    }

    // Crear la instancia de electron-store
    this.store = new Store({
      name: 'license'
    });
    
    this.client = null;
    this.checkInterval = null;
    this.EXPIRATION_WARNING_DAYS = 3;
    this.TRIAL_PERIOD_DAYS = 30;
  }

  // Método para obtener información del dispositivo
  getDeviceInfo() {
    try {
      const info = {
        platform: process.platform,
        hostname: os.hostname(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        osType: os.type(),
        osRelease: os.release()
      };

      return {
        ...info,
        totalMemory: `${Math.round(info.totalMemory / (1024 * 1024 * 1024))}GB`,
        cpus: `${info.cpus} cores`
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      return {
        platform: 'unknown',
        hostname: 'unknown',
        arch: 'unknown',
        cpus: 'unknown',
        totalMemory: 'unknown',
        osType: 'unknown',
        osRelease: 'unknown'
      };
    }
  }

  // Método para guardar el token validado
  async saveValidatedToken(tokenData) {
    try {
      this.store.set('validatedToken', {
        ...tokenData,
        validatedAt: new Date().toISOString()
      });
      console.log('Token guardado exitosamente:', tokenData.token);
      return true;
    } catch (error) {
      console.error('Error al guardar el token:', error);
      return false;
    }
  }

  // Método para obtener el token guardado
  getStoredToken() {
    try {
      const tokenData = this.store.get('validatedToken');
      console.log('Token almacenado encontrado:', tokenData);
      return tokenData;
    } catch (error) {
      console.error('Error al obtener el token guardado:', error);
      return null;
    }
  }

  // Método para generar un machineId basado en información del sistema
  generateMachineId() {
    const platform = process.platform;
    const hostname = os.hostname();
    const username = process.env.USERNAME || process.env.USER;
    return crypto
      .createHash('sha256')
      .update(`${platform}-${hostname}-${username}`)
      .digest('hex');
  }

  // Método modificado para validar token con la nueva API
  async validateToken(token) {
    try {
      const deviceInfo = this.getDeviceInfo();
      const machineId = this.generateMachineId();
      const deviceInfoString = JSON.stringify(deviceInfo);

      console.log('Validando token:', token);
      const response = await axios.post(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDATE_TOKEN}`,
        {
          token,
          machineId,
          deviceInfo: deviceInfoString
        },
        {
          headers: API_CONFIG.HEADERS,
          timeout: 10000
        }
      );

      if (response.status === 200 && response.data.success) {
        const tokenData = {
          token,
          machineId,
          deviceInfo: deviceInfoString,
          // Si no viene expiresAt desde el servidor se asigna 30 días por defecto
          expiresAt: response.data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
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

      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: response.data.message || ERROR_MESSAGES.INVALID_TOKEN
      };

    } catch (error) {
      console.error('Error validating token:', error);

      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || ERROR_MESSAGES.SERVER_ERROR;

        return {
          valid: false,
          status: status === 403 ? TOKEN_STATUS.EXPIRED : TOKEN_STATUS.INVALID,
          message
        };
      }

      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  }

  // Método modificado para verificar el estado del token almacenado
  async checkTokenStatus() {
    const storedToken = this.getStoredToken();

    if (!storedToken) {
      console.log('No hay token almacenado');
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: 'No hay token almacenado'
      };
    }

    // Verificar si el token ha expirado localmente
    const now = moment();
    const expirationDate = moment(storedToken.expiresAt);

    if (now.isAfter(expirationDate)) {
      console.log('Token expirado');
      return {
        valid: false,
        status: TOKEN_STATUS.EXPIRED,
        message: ERROR_MESSAGES.EXPIRED_TOKEN
      };
    }

    // Si el token no ha expirado, lo consideramos válido sin hacer llamada al servidor
    return {
      valid: true,
      status: TOKEN_STATUS.VALID,
      expiresAt: storedToken.expiresAt,
      message: 'Token válido'
    };
  }

  // Método modificado para la verificación de licencia inicial
  async checkInitialLicense() {
    try {
      const storedToken = this.getStoredToken();
      
      if (!storedToken || !storedToken.token) {
        return {
          valid: false,
          message: 'No hay token almacenado',
          requiresToken: true  // Añadimos esta bandera
        };
      }
  
      // Verificación local de expiración
      const now = moment();
      const expirationDate = moment(storedToken.expiresAt);
  
      if (now.isAfter(expirationDate)) {
        return {
          valid: false,
          message: ERROR_MESSAGES.EXPIRED_TOKEN,
          requiresToken: true  // También aquí
        };
      }
  
      return {
        valid: true,
        token: storedToken.token,
        expiresAt: storedToken.expiresAt
      };
  
    } catch (error) {
      console.error('Error en checkInitialLicense:', error);
      return {
        valid: false,
        message: error.message || 'Error al verificar la licencia',
        requiresToken: true  // Y aquí
      };
    }
  }
  
  async validateWithServer() {
    try {
      const storedToken = this.getStoredToken();
      console.log('Validando token con servidor:', storedToken?.token);
      
      if (!storedToken || !storedToken.token) {
        console.log('No hay token para validar con el servidor');
        return { valid: false, message: 'No hay token para validar' };
      }
  
      console.log('Realizando petición al servidor...');
      const response = await axios.get(
        `${API_CONFIG.BASE_URL}/api/check-validity/${storedToken.token}`,
        { 
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );
  
      console.log('Respuesta del servidor:', response.data);
  
      // La API devuelve true/false directamente
      const isValid = response.data === true;
      
      // Ya no borramos el token aquí, solo retornamos el resultado
      return {
        valid: isValid,
        message: isValid ? 'Token válido en servidor' : 'Token inválido en servidor'
      };
  
    } catch (error) {
      console.error('Error en validación con servidor:', error);
      
      // Si hay error de respuesta del servidor (ej: 404, 500)
      if (error.response) {
        console.error('Respuesta de error del servidor:', error.response.data);
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
        console.log('Conexión exitosa a MongoDB');
      }

      const db = this.client.db(process.env.MONGODB_DB);
      return db.collection(process.env.MONGODB_COLLECTION);
    } catch (error) {
      console.error('Error en connect:', error);
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
      console.log('Validando licencia:', licenseKey);
      const collection = await this.connect();

      const license = await collection.findOne({ key: licenseKey });
      console.log('Licencia encontrada:', license);

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
      console.error('Error en validateLicense:', error);
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