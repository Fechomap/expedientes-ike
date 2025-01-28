// src/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { processExcelFile } = require('./index');
const LicenseHandler = require('./utils/licenseHandler');
const ConfigHandler = require('./utils/configHandler');

const licenseHandler = new LicenseHandler();
const configHandler = new ConfigHandler();

let mainWindow;
let loadingWindow;

/**
 * Crea y devuelve una nueva ventana de carga.
 */
async function createLoadingWindow() {
  console.log('Creando ventana de carga...');
  const loadingWin = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  await loadingWin.loadFile(path.join(__dirname, '..', 'ui', 'loading.html'))
    .catch((err) => {
      console.error('Error al cargar loading.html:', err);
      console.log(`Error al cargar loading.html: ${err.message}`);
    });

  return loadingWin;
}

/**
 * Verifica:
 * 1. Si existe un token y es válido.
 * 2. Si existen credenciales configuradas.
 *
 * Retorna:
 *  - { valid: true } si ambos existen.
 *  - { valid: false, requiresToken: true } si falta el token o es inválido.
 *  - { valid: false, requiresConfig: true } si el token es válido pero faltan credenciales.
 */
async function verificarLicenciaInicial() {
  try {
    console.log('Iniciando verificación de licencia y token');

    // 1. Validación del token local
    const tokenResult = await licenseHandler.checkInitialLicense();
    console.log(`Estado del token local: ${JSON.stringify(tokenResult)}`);

    // Si no hay token local o es inválido, redirigir a pantalla de licencia
    if (!tokenResult.valid) {
      console.log('Token local no encontrado o inválido');
      return { valid: false, requiresToken: true };
    }

    // 2. Validación explícita con el servidor
    console.log('Iniciando validación con el servidor...');
    try {
      const serverValidation = await licenseHandler.validateWithServer();
      console.log('Resultado de validación con servidor:', serverValidation);
      
      // Si el servidor invalida el token, redirigir a pantalla de licencia
      if (!serverValidation.valid) {
        console.log('Token invalidado por el servidor');
        return { valid: false, requiresToken: true };
      }
    } catch (serverError) {
      // Si hay error de conexión, mostramos el mensaje y cerramos la aplicación
      console.error('Error en validación con servidor:', serverError);
      
      await dialog.showMessageBox({
        type: 'error',
        title: 'Error de Conexión',
        message: 'No se pudo validar el token con el servidor',
        detail: 'Verifique su conexión a internet e intente nuevamente.',
        buttons: ['OK']
      });
      
      // Cerramos la aplicación
      app.quit();
      // Retornamos null para indicar que no debe continuar el proceso
      return null;
    }

    // Solo llegamos aquí si ambas validaciones fueron exitosas
    // 3. Verificar credenciales
    const credentials = configHandler.getCredentials();
    console.log('Verificando credenciales...');
    
    if (!credentials) {
      console.log('No hay credenciales configuradas');
      return { valid: false, requiresConfig: true };
    }

    console.log('Todas las validaciones completadas exitosamente');
    return { valid: true };

  } catch (error) {
    console.error('Error en verificación inicial:', error);
    
    await dialog.showMessageBox({
      type: 'error',
      title: 'Error de Verificación',
      message: 'Error al verificar la licencia',
      detail: error.message || 'Error desconocido al verificar la licencia',
      buttons: ['OK']
    });
    
    // En caso de error general también cerramos la aplicación
    app.quit();
    return null;
  }
}

async function createMainWindow() {
  console.log('Creando ventana principal...');
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  try {
    const status = await verificarLicenciaInicial();
    
    // Si status es null, significa que hubo un error de conexión y la aplicación ya se está cerrando
    if (status === null) {
      return;
    }

    console.log(`Estado de verificación inicial: ${JSON.stringify(status)}`);

    if (!status.valid) {
      if (status.requiresToken) {
        await mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'license.html'));
      } else if (status.requiresConfig) {
        await mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'config.html'));
      }
    } else {
      await mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
    }

    if (loadingWindow) {
      loadingWindow.close();
      loadingWindow = null;
    }

    mainWindow.show();
  } catch (error) {
    console.error('Error al crear ventana principal:', error);
    console.log(`Error al crear ventana principal: ${error.message}`);
    if (loadingWindow) {
      loadingWindow.close();
      loadingWindow = null;
    }
    dialog.showErrorBox('Error', 'Error al iniciar la aplicación');
    app.quit();
  }
}

app.whenReady().then(async () => {
  try {
    console.log('Aplicación lista, creando ventana de carga...');
    loadingWindow = await createLoadingWindow();
    console.log('Ventana de carga creada exitosamente');

    // Simular tiempo de carga
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Creando ventana principal...');
    await createMainWindow();
  } catch (error) {
    console.error('Error durante la inicialización:', error);
    console.log(`Error durante la inicialización: ${error.message}`);
    if (loadingWindow) {
      loadingWindow.close();
      loadingWindow = null;
    }
    dialog.showErrorBox('Error', 'Error al iniciar la aplicación');
    app.quit();
  }
});

ipcMain.handle('token:verify', async (event, token) => {
  try {
    console.log(`Verificando token recibido: ${token}`);
    const result = await licenseHandler.validateToken(token);
    console.log(`Resultado de validación: ${JSON.stringify(result)}`);

    if (result.valid) {
      const creds = configHandler.getCredentials();
      let nextScreen;

      if (!creds) {
        nextScreen = path.join(__dirname, '..', 'ui', 'config.html');
      } else {
        nextScreen = path.join(__dirname, '..', 'ui', 'index.html');
      }

      const loadingScreen = await createLoadingWindow();

      setTimeout(async () => {
        try {
          const newWindow = new BrowserWindow({
            width: 900,
            height: 700,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              preload: path.join(__dirname, 'preload.js')
            }
          });

          await newWindow.loadFile(nextScreen);
          newWindow.show();

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.close();
          }

          mainWindow = newWindow;
        } catch (err) {
          console.error('Error al cargar la siguiente pantalla:', err);
          console.log(`Error al cargar la siguiente pantalla: ${err.message}`);
        } finally {
          loadingScreen.close();
        }
      }, 1000);
    }

    return result;
  } catch (error) {
    console.error('Error en verificación de token:', error);
    console.log(`Error en verificación de token: ${error.message}`);
    return { valid: false, message: error.message };
  }
});

ipcMain.handle('save-config', async (event, credentials) => {
  try {
    console.log(`Guardando configuración con credenciales: ${JSON.stringify(credentials)}`);
    const result = configHandler.saveCredentials(credentials.username, credentials.password);
    
    if (result) {
      const loadingScreen = await createLoadingWindow();
      console.log('Configuración guardada exitosamente, cargando ventana principal...');

      setTimeout(async () => {
        try {
          if (mainWindow && !mainWindow.isDestroyed()) {
            await mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
          } else {
            mainWindow = new BrowserWindow({
              width: 900,
              height: 700,
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
              }
            });
            await mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
            mainWindow.show();
          }
        } catch (err) {
          console.error('Error al cargar index.html después de guardar la configuración:', err);
          console.log(`Error al cargar index.html después de guardar la configuración: ${err.message}`);
        } finally {
          loadingScreen.close();
        }
      }, 1000);
    }

    return { success: result };
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    console.log(`Error al guardar configuración: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('license:verify', async (event, licenseKey) => {
  try {
    console.log(`Verificando licencia con key: ${licenseKey}`);
    const result = await licenseHandler.validateLicense(licenseKey);
    console.log(`Resultado de validación de licencia: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error('Error en validación de licencia:', error);
    console.log(`Error en validación de licencia: ${error.message}`);
    return { valid: false, message: error.message };
  }
});

ipcMain.handle('dialog:openFile', async () => {
  try {
    console.log('Abriendo diálogo para seleccionar archivo...');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      console.log(`Archivo seleccionado: ${result.filePaths[0]}`);
      return { success: true, filePath: result.filePaths[0] };
    }

    console.log('No se seleccionó ningún archivo.');
    return { success: false, filePath: null };
  } catch (error) {
    console.error('Error al abrir diálogo de archivo:', error);
    console.log(`Error al abrir diálogo de archivo: ${error.message}`);
    return { success: false, filePath: null };
  }
});

// src/main.js (sección process:start)
ipcMain.handle('process:start', async (event, filePath) => {
  try {
    console.log(`Iniciando procesamiento del archivo: ${filePath}`);
    mainWindow.webContents.send('process:progress', {
      message: 'Iniciando procesamiento...',
      progress: 0,
      stats: { totalRevisados: 0, totalConCosto: 0, totalAceptados: 0 }
    });

    let accumulatedStats = {
      totalRevisados: 0,
      totalConCosto: 0,
      totalAceptados: 0
    };

    const result = await processExcelFile(filePath, async (progress) => {
      console.log(`Progreso: ${JSON.stringify(progress)}`);
      
      // Actualización acumulativa
      if (progress.stats) {
        accumulatedStats = { 
          totalRevisados: Math.max(accumulatedStats.totalRevisados, progress.stats.totalRevisados),
          totalConCosto: Math.max(accumulatedStats.totalConCosto, progress.stats.totalConCosto),
          totalAceptados: Math.max(accumulatedStats.totalAceptados, progress.stats.totalAceptados)
        };
      }

      mainWindow.webContents.send('process:progress', {
        ...progress,
        stats: accumulatedStats
      });
    });

    mainWindow.webContents.send('process:progress', {
      final: true,
      message: 'Proceso completado',
      stats: accumulatedStats,
      progress: 100
    });

    console.log('Proceso completado con éxito');
    return { success: true, message: 'Proceso completado con éxito' };
  } catch (error) {
    console.error('Error en el proceso:', error);
    console.log(`Error en el proceso: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('app:reload', async () => {
  try {
    console.log('Recargando aplicación...');
    await mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
    return { success: true };
  } catch (error) {
    console.error('Error al recargar la aplicación:', error);
    console.log(`Error al recargar la aplicación: ${error.message}`);
    return { success: false, error: error.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});