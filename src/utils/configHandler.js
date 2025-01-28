const Store = require('electron-store');
const { BrowserWindow } = require('electron');
const path = require('path');

class ConfigHandler {
  constructor() {
    this.store = new Store({
      name: 'config',
      defaults: {
        isConfigured: false,
        credentials: null
      }
    });
    this.configWindow = null;
  }

  // Obtener credenciales almacenadas
  getCredentials() {
    return this.store.get('credentials');
  }

  // Guardar credenciales (se requiere usuario y contraseña)
  saveCredentials(username, password) {
    if (!username || !password) {
      throw new Error('Usuario y contraseña son requeridos');
    }
    this.store.set('credentials', { username, password });
    this.store.set('isConfigured', true);
    // Opcional: asignar a variables de entorno
    process.env.IKE_USERNAME = username;
    process.env.IKE_PASSWORD = password;
    return true;
  }

  // Mostrar ventana de configuración
  async showConfigWindow() {
    if (this.configWindow) {
      this.configWindow.focus();
      return;
    }

    // Creamos la ventana de configuración con preload para exponer window.electronAPI
    this.configWindow = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      },
      resizable: false,
      modal: true
    });

    await this.configWindow.loadFile(path.join(__dirname, '../../ui/config.html'));

    return new Promise((resolve) => {
      this.configWindow.on('closed', () => {
        this.configWindow = null;
        resolve(this.store.get('isConfigured'));
      });
    });
  }
}

module.exports = ConfigHandler;