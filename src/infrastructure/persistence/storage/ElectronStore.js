const Store = require('electron-store');
const Logger = require('../../../shared/utils/Logger');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ElectronStore {
  constructor(options = {}) {
    this.logger = Logger.getInstance('ElectronStore');
    
    try {
      // Verificar permisos en Windows antes de crear el store
      if (process.platform === 'win32' && options.cwd) {
        this.ensureStoragePermissions(options.cwd);
      }
      
      this.store = new Store(options);
      this.logger.info('ElectronStore initialized successfully', { 
        path: this.store.path,
        platform: process.platform 
      });
    } catch (error) {
      this.logger.error('Error initializing ElectronStore', error);
      // Fallback a configuración básica
      this.store = new Store({ 
        name: options.name || 'fallback',
        clearInvalidConfig: true 
      });
    }
  }

  ensureStoragePermissions(storageDir) {
    try {
      // Crear directorio si no existe
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
        this.logger.info('Created storage directory', { dir: storageDir });
      }
      
      // Verificar permisos de escritura
      fs.accessSync(storageDir, fs.constants.W_OK);
      this.logger.debug('Storage permissions verified', { dir: storageDir });
    } catch (error) {
      this.logger.warn('Storage permissions issue, using default location', error);
      throw error;
    }
  }

  async get(key, defaultValue = null) {
    try {
      this.logger.debug('Getting value from store', { key });
      const value = this.store.get(key, defaultValue);
      return value;
    } catch (error) {
      this.logger.error('Error getting value from store', error, { key });
      throw error;
    }
  }

  async set(key, value) {
    try {
      this.logger.debug('Setting value in store', { key });
      this.store.set(key, value);
      return value;
    } catch (error) {
      this.logger.error('Error setting value in store', error, { key });
      throw error;
    }
  }

  async delete(key) {
    try {
      this.logger.debug('Deleting value from store', { key });
      this.store.delete(key);
      return true;
    } catch (error) {
      this.logger.error('Error deleting value from store', error, { key });
      throw error;
    }
  }

  async has(key) {
    try {
      return this.store.has(key);
    } catch (error) {
      this.logger.error('Error checking if key exists in store', error, { key });
      return false;
    }
  }

  async clear() {
    try {
      this.logger.debug('Clearing all values from store');
      this.store.clear();
      return true;
    } catch (error) {
      this.logger.error('Error clearing store', error);
      throw error;
    }
  }

  async getAll() {
    try {
      this.logger.debug('Getting all values from store');
      return this.store.store;
    } catch (error) {
      this.logger.error('Error getting all values from store', error);
      throw error;
    }
  }

  async size() {
    try {
      return this.store.size;
    } catch (error) {
      this.logger.error('Error getting store size', error);
      return 0;
    }
  }

  getPath() {
    return this.store.path;
  }

  openInEditor() {
    this.store.openInEditor();
  }
}

module.exports = ElectronStore;