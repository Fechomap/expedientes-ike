// src/utils/licenseHandler.js
const { MongoClient } = require('mongodb');
const dayjs = require('dayjs');
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
        // En lugar de eliminar el archivo, registramos el error y haremos una copia de respaldo
        this.log.error('Archivo de configuración posiblemente corrupto:', error);
        
        // Crear una copia de respaldo antes de continuar
        try {
          const backupPath = `${filePath}.backup.${Date.now()}`;
          fs.copyFileSync(filePath, backupPath);
          this.log.info(`Copia de seguridad creada en: ${backupPath}`);
        } catch (backupError) {
          this.log.error('Error al crear copia de seguridad:', backupError);
        }
      }
    }

    // Crear la instancia de electron-store con manejo de errores mejorado
    try {
      // Configuración específica por plataforma para mejorar compatibilidad
      const storeConfig = {
        name: 'license',
        clearInvalidConfig: true
      };
      
      // Solo usar encriptación en macOS por problemas de compatibilidad en Windows
      if (process.platform === 'darwin') {
        storeConfig.encryptionKey = 'ike-secure-key-2024';
      }
      
      // En Windows usar ruta más confiable
      if (process.platform === 'win32') {
        const path = require('path');
        const os = require('os');
        storeConfig.cwd = path.join(os.homedir(), '.ike-expedientes');
      }
      
      this.store = new Store(storeConfig);
    } catch (storeError) {
      this.log.error('Error al inicializar electron-store:', storeError);
      // Si hay error, intentamos crear con opciones mínimas
      this.store = new Store({
        name: 'license',
        clearInvalidConfig: true
      });
    }
    
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
      
      // Verificar si hay un token existente - obtener copia antes de modificar
      let existingToken = null;
      try {
        existingToken = this.store.get('validatedToken');
      } catch (readError) {
        this.log.warn('No se pudo leer el token existente:', readError);
        // Continuamos con el guardado de todas formas
      }
      
      // Guardar nuevo token con manejo de errores mejorado
      try {
        this.store.set('validatedToken', enrichedTokenData);
        this.log.info('Token guardado exitosamente:', tokenData.token);
      } catch (saveError) {
        this.log.error('Error al guardar el token en electron-store:', saveError);
        
        // Intentar guardar una copia del token en formato JSON plano como respaldo
        try {
          const backupPath = path.join(app.getPath('userData'), `license_backup_${Date.now()}.json`);
          fs.writeFileSync(backupPath, JSON.stringify(enrichedTokenData, null, 2), 'utf8');
          this.log.info(`Token guardado como respaldo en: ${backupPath}`);
        } catch (backupError) {
          this.log.error('Error al crear respaldo del token:', backupError);
        }
        
        // Reintento con opciones mínimas
        try {
          this.store = new Store({
            name: 'license',
            clearInvalidConfig: true
          });
          this.store.set('validatedToken', enrichedTokenData);
          this.log.info('Token guardado en segundo intento con opciones mínimas');
        } catch (retryError) {
          this.log.error('Error en segundo intento de guardado:', retryError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      this.log.error('Error general al guardar el token:', error);
      return false;
    }
  }

  // Método para obtener el token guardado con recuperación mejorada
  getStoredToken() {
    try {
      const tokenData = this.store.get('validatedToken');
      if (tokenData) {
        this.log.info('Token almacenado encontrado, expira:', tokenData.expiresAt);
        return tokenData;
      }
      this.log.info('No se encontró token almacenado en electron-store');
      
      // Si no hay token en electron-store, intentar buscar en archivos de respaldo
      return this.attemptTokenRecovery();
    } catch (error) {
      this.log.error('Error al obtener el token guardado:', error);
      
      // Intentar recuperar desde respaldo
      return this.attemptTokenRecovery();
    }
  }
  
  // Método auxiliar para intentar recuperar token desde archivos de respaldo
  attemptTokenRecovery() {
    try {
      this.log.info('Intentando recuperar token desde archivos de respaldo...');
      const userData = app.getPath('userData');
      
      // Buscar archivos de respaldo
      const files = fs.readdirSync(userData)
        .filter(file => file.startsWith('license_backup_') && file.endsWith('.json'))
        .sort()
        .reverse(); // Más recientes primero
      
      if (files.length === 0) {
        this.log.info('No se encontraron archivos de respaldo');
        return null;
      }
      
      // Intentar leer cada archivo hasta encontrar uno válido
      for (const file of files) {
        try {
          const filePath = path.join(userData, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const tokenData = JSON.parse(content);
          
          if (tokenData && tokenData.token) {
            this.log.info(`Token recuperado desde respaldo: ${file}`);
            
            // Guardar el token recuperado en electron-store
            this.saveValidatedToken(tokenData)
              .then(success => {
                if (success) {
                  this.log.info('Token recuperado guardado en electron-store');
                }
              })
              .catch(err => {
                this.log.error('Error al guardar token recuperado:', err);
              });
            
            return tokenData;
          }
        } catch (e) {
          this.log.error(`Error al leer archivo de respaldo ${file}:`, e);
          // Continuar con el siguiente archivo
          continue;
        }
      }
      
      this.log.info('No se pudo recuperar token desde archivos de respaldo');
      return null;
    } catch (error) {
      this.log.error('Error en proceso de recuperación de token:', error);
      return null;
    }
  }

  // Método para generar un machineId basado en información del sistema
  generateMachineId() {
    return `machine-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
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
    const dayjs = require('dayjs');    const expirationDate = dayjs(storedToken.expiresAt);
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
  // Método mejorado para la verificación de licencia inicial
  async checkInitialLicense() {
    try {
      const storedToken = this.getStoredToken();
      
      // Si no hay token almacenado, solicitar uno nuevo
      if (!storedToken || !storedToken.token) {
        return {
          valid: false,
          message: 'No hay token almacenado',
          requiresToken: true
        };
      }
    
      // No importa si el token ha expirado localmente, siempre intentaremos 
      // verificar con el servidor primero para saber si se ha renovado
      try {
        this.log.info('Verificando token con el servidor independientemente de la fecha local...');
        const serverStatus = await this.validateWithServer();
        
        // Si el servidor indica que el token es válido (se ha renovado o sigue activo)
        if (serverStatus.valid) {
          this.log.info('El servidor confirma que el token es válido');
          
          // Actualizar la fecha de expiración si viene en la respuesta
          if (serverStatus.expiresAt) {
            const updatedToken = {
              ...storedToken,
              expiresAt: serverStatus.expiresAt,
              lastServerValidation: new Date().toISOString()
            };
            
            await this.saveValidatedToken(updatedToken);
            this.log.info('Token actualizado con nueva fecha de expiración');
          }
          
          return {
            valid: true,
            token: storedToken.token,
            expiresAt: serverStatus.expiresAt || storedToken.expiresAt
          };
        }
        
        // Si el servidor indica que el token ya no es válido
        this.log.info('El servidor indica que el token no es válido');
        
        // IMPORTANTE: NO eliminamos el token local aunque sea inválido
        // simplemente lo marcamos como inválido para que el usuario pueda renovarlo
        return {
          valid: false,
          message: 'La licencia no está activa. Por favor, renuévela en la aplicación IKE Licencias.',
          requiresToken: true,
          token: storedToken.token  // Mantenemos el token para referencia
        };
      } catch (serverError) {
        // Si no podemos conectar con el servidor
        this.log.error('Error al verificar con servidor:', serverError.message);
        
        // En modo offline, verificamos la fecha local como respaldo
        const dayjs = require('dayjs');        const expirationDate = dayjs(storedToken.expiresAt);
        
        // Si el token ya está expirado localmente y no podemos verificar,
        // lo consideramos válido temporalmente para permitir el uso offline
        // Esto es un cambio clave: asumimos que es válido hasta que podamos verificar online
        if (now.isAfter(expirationDate)) {
          this.log.info('Token expirado localmente, pero permitiendo modo offline temporal');
          return {
            valid: true,  // Consideramos válido para modo offline
            token: storedToken.token,
            expiresAt: storedToken.expiresAt,
            offlineMode: true,
            message: 'Modo sin conexión: Usando licencia existente temporalmente. Se verificará cuando haya conexión a internet.'
          };
        }
        
        // Si no ha expirado localmente, lo consideramos válido en modo offline
        return {
          valid: true,
          token: storedToken.token,
          expiresAt: storedToken.expiresAt,
          offlineMode: true,
          message: 'Modo sin conexión: Usando token local temporalmente'
        };
      }
    } catch (error) {
      this.log.error('Error en checkInitialLicense:', error);
      
      // Si ocurre algún error, intentamos usar el token local como último recurso
      const storedToken = this.getStoredToken();
      if (storedToken && storedToken.token) {
        this.log.info('Usando token local como último recurso debido a error');
        return {
          valid: true,
          token: storedToken.token,
          expiresAt: storedToken.expiresAt,
          offlineMode: true,
          emergencyMode: true,
          message: 'Modo de emergencia: Usando token local'
        };
      }
      
      return {
        valid: false,
        message: error.message || 'Error al verificar la licencia',
        requiresToken: true
      };
    }
  }
  
  // Método mejorado para validar con el servidor
  // Método mejorado para validar con el servidor
  async validateWithServer() {
    try {
      const storedToken = this.getStoredToken();
      
      if (!storedToken || !storedToken.token) {
        this.log.info('No hay token para validar con el servidor');
        return { valid: false, message: 'No hay token para validar' };
      }
    
      this.log.info('Consultando si el token está activo en el servidor:', storedToken.token);
      
      // Usar el método apiRequest con reintentos
      const validityResponse = await this.apiRequest(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHECK_VALIDITY}/${storedToken.token}`,
        'get'
      );
      
      this.log.info('Respuesta de validez del servidor:', JSON.stringify(validityResponse));
      
      // Analizar la respuesta
      const isActive = validityResponse === true || validityResponse.success === true;
      
      if (isActive) {
        this.log.info('El token está activo según el servidor');
        
        // Actualización del token para reflejar que está activo
        const updatedToken = {
          ...storedToken,
          lastServerValidation: new Date().toISOString(),
          verified: true,
          // Si el servidor proporciona una nueva fecha de expiración, la actualizamos
          expiresAt: validityResponse.expiresAt || storedToken.expiresAt
        };
        
        await this.saveValidatedToken(updatedToken);
        this.log.info('Token actualizado con verificación del servidor');
        
        return {
          valid: true,
          message: 'Token activo en servidor',
          expiresAt: updatedToken.expiresAt
        };
      } else {
        this.log.info('El token no está activo según el servidor');
        
        // IMPORTANTE: No eliminamos el token, solo marcamos que no está activo
        // para permitir la renovación posterior
        return {
          valid: false,
          message: validityResponse.message || 'El token no está activo en el servidor',
          // Incluimos el token para referencia
          token: storedToken.token
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

      const dayjs = require('dayjs');      const expirationDate = dayjs(license.expiresAt);
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

    // Método para redimir token (agregarlo a la clase LicenseHandler en src/utils/licenseHandler.js)

  /**
   * Redime un token enviando una solicitud POST al servidor
   * @param {string} token - El token a redimir
   * @returns {Promise<Object>} - Resultado de la redención del token
   */
  async redeemToken(token) {
    try {
      if (!token || token.trim() === '') {
        return {
          valid: false,
          status: TOKEN_STATUS.INVALID,
          message: ERROR_MESSAGES.EMPTY_TOKEN
        };
      }
      
      this.log.info('Intentando redimir token:', token);
      
      const deviceInfo = this.getDeviceInfo();
      const machineId = this.generateMachineId();
      const deviceInfoString = JSON.stringify(deviceInfo);
      
      // Crear la URL para la solicitud POST de redención
      const redeemUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REDEEM_TOKEN}`;
      
      // Usar el método apiRequest con reintentos para redimir el token
      const response = await this.apiRequest(
        redeemUrl,
        'post',
        {
          token,
          machineId,
          deviceInfo: deviceInfoString
        }
      );
      
      this.log.info('Respuesta de redención de token:', JSON.stringify(response));
      
      if (response.success) {
        // Si la redención es exitosa, guardamos el token validado
        const tokenData = {
          token,
          machineId,
          deviceInfo: deviceInfoString,
          expiresAt: response.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          lastValidation: new Date().toISOString(),
          redeemed: true,
          redemptionDate: new Date().toISOString()
        };
        
        // Guardar el token redimido
        await this.saveValidatedToken(tokenData);
        
        return {
          valid: true,
          status: TOKEN_STATUS.VALID,
          expiresAt: tokenData.expiresAt,
          message: 'Token redimido correctamente'
        };
      }
      
      // Si la respuesta no es exitosa
      return {
        valid: false,
        status: response.status === 403 ? TOKEN_STATUS.EXPIRED : TOKEN_STATUS.INVALID,
        message: response.message || ERROR_MESSAGES.INVALID_TOKEN
      };
      
    } catch (error) {
      this.log.error('Error inesperado al redimir token:', error);
      
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: ERROR_MESSAGES.VALIDATION_ERROR
      };
    }
  }

  // Método modificado de verificación de token para usar redimirToken
  // (modificar el método existente validateToken en la clase LicenseHandler)
  async validateToken(token) {
    if (!token || token.trim() === '') {
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: ERROR_MESSAGES.EMPTY_TOKEN
      };
    }
    
    try {
      this.log.info('Validando token:', token);
      
      // 1. Primero intentar redimir el token (nueva funcionalidad)
      const redeemResult = await this.redeemToken(token);
      this.log.info('Resultado de redención:', JSON.stringify(redeemResult));
      
      // Si la redención fue exitosa, retornamos el resultado
      if (redeemResult.valid) {
        return redeemResult;
      }
      
      // 2. Si la redención falla, intentar la validación estándar como fallback
      this.log.info('Redención falló, intentando validación estándar...');
      
      const deviceInfo = this.getDeviceInfo();
      const machineId = this.generateMachineId();
      const deviceInfoString = JSON.stringify(deviceInfo);
      
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

  async startTrialPeriod() {
    const trialInfo = {
      type: 'trial',
      startDate: new Date(),
      expiresAt: dayjs().add(this.TRIAL_PERIOD_DAYS, 'days').toDate(),
      machineId: this.generateMachineId()
    };
    this.store.set('trial', trialInfo);
    return trialInfo;
  }

  isTrialValid() {
    const trial = this.store.get('trial');
    if (!trial) return { valid: false };

    const dayjs = require('dayjs');    const expirationDate = dayjs(trial.expiresAt);
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