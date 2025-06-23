// src/utils/browserHandler.js
const puppeteer = require('puppeteer-core');
const Store = require('electron-store');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class BrowserHandler {
  constructor() {
    this.browser = null;
    this.page = null;
    this.store = new Store({
      name: 'config',
      cwd: app.getPath('userData') // Ruta portable
    });

    this.stats = {
      totalRevisados: 0,
      totalConCosto: 0,
      totalAceptados: 0
    };
  }

  async getBrowserPath() {
    if (os.platform() !== 'win32') {
      // Lógica para Mac (mantener tu versión anterior)
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ];
      for (const p of macPaths) {
        if (fs.existsSync(p)) return p;
      }
      throw new Error('Chrome no encontrado en macOS');
    }

    // ========== Lógica mejorada para Windows ==========
    // 1. Primera prioridad: Chrome
    const chromePaths = [
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
    ];

    for (const p of chromePaths) {
      if (fs.existsSync(p)) return p;
    }

    // 2. Segunda prioridad: Navegador predeterminado del sistema
    try {
      const defaultBrowser = await this.getDefaultBrowserWindows();
      if (defaultBrowser) return defaultBrowser;
    } catch (e) {
      console.error('Error detectando navegador predeterminado:', e);
    }

    // 3. Último recurso: Buscar otros navegadores comunes
    const commonBrowsers = [
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(os.homedir(), 'AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe'),
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
    ];

    for (const p of commonBrowsers) {
      if (fs.existsSync(p)) return p;
    }

    throw new Error('No se encontró ningún navegador compatible instalado');
  }

  async getDefaultBrowserWindows() {
    const { execSync } = require('child_process');
    try {
      // Obtener navegador predeterminado desde el registro
      const regQuery = execSync(
        'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId'
      ).toString();
      
      const browserId = regQuery.split('REG_SZ')[1].trim();
      const association = execSync(
        `reg query "HKEY_CLASSES_ROOT\\${browserId}\\shell\\open\\command" /ve`
      ).toString();
      
      const fullPath = association.split('REG_SZ')[1].trim().replace(/"/g, '');
      return path.normalize(fullPath.split(' ')[0]); // Extraer solo la ruta
    } catch (e) {
      console.error('No se pudo detectar el navegador predeterminado:', e.message);
      return null;
    }
  }

  async initialize() {
    try {
      console.log('Inicializando navegador...');
      const browserPath = await this.getBrowserPath();
      
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        executablePath: browserPath,
        timeout: 60000
      });

      this.page = await this.browser.newPage();
      await this.page.setDefaultNavigationTimeout(60000);
      await this.login();
      return true;
    } catch (error) {
      console.error('Error inicializando navegador:', error.message);
      throw new Error(`No se pudo iniciar ningún navegador. Instala Chrome o Edge para continuar.`);
    }
  }

  async login() {
    try {
      const credentials = this.store.get('credentials');
      if (!credentials) {
        throw new Error('No se encontraron credenciales configuradas');
      }

      console.log('Iniciando proceso de login...');
      await this.page.goto('https://portalproveedores.ikeasistencia.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.page.waitForSelector('input[formcontrolname="username"]', { timeout: 30000 });
      await this.page.waitForSelector('input[formcontrolname="password"]', { timeout: 30000 });

      await this.page.type('input[formcontrolname="username"]', credentials.username, { delay: 30 });
      await this.page.type('input[formcontrolname="password"]', credentials.password, { delay: 30 });

      await this.page.click('button[type="submit"]');

      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const isLoggedIn = await this.page.evaluate(() => {
        return !document.querySelector('input[formcontrolname="password"]');
      });

      if (!isLoggedIn) {
        throw new Error('Login failed');
      }

      console.log('Login successful');
      await delay(2000);
      return true;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }

  async searchExpediente(expediente, costoGuardado) {
    try {
      this.stats.totalRevisados++;
      console.log(`Iniciando búsqueda para expediente: "${expediente}" (Costo guardado: $${costoGuardado})`);

      this.page.setDefaultNavigationTimeout(30000);
      this.page.setDefaultTimeout(30000);

      if (!this.page.url().includes('portalproveedores.ikeasistencia.com')) {
        console.log('Navegando a la página de búsqueda...');
        await this.page.goto(
          'https://portalproveedores.ikeasistencia.com/admin/services/pendientes',
          { waitUntil: 'networkidle2', timeout: 30000 }
        );
        await delay(1500);
      }

      const inputSelectors = [
        'input[placeholder="No. Expediente:*"]',
        'input[formcontrolname="expediente"]',
        'input.mat-mdc-input-element',
        'input[type="text"]'
      ];

      let inputElement = null;
      for (const sel of inputSelectors) {
        try {
          const candidate = await this.page.$(sel);
          if (candidate) {
            inputElement = candidate;
            console.log(`Campo de búsqueda encontrado con selector: ${sel}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!inputElement) {
        throw new Error('No se pudo encontrar el campo de búsqueda');
      }

      await inputElement.click({ clickCount: 3 });
      await delay(300);
      await this.page.evaluate((el) => { el.value = ''; }, inputElement);

      for (const char of expediente.toString()) {
        await this.page.keyboard.type(char, { delay: 50 });
      }
      await delay(300);

      const botonBuscar = await this.page.$$eval('button', (buttons) => {
        return buttons.find(btn => btn.textContent.includes('Buscar'));
      });

      if (botonBuscar) {
        console.log('Botón "Buscar" encontrado, haciendo clic...');
        await botonBuscar.click();
      } else {
        console.log('No se encontró botón "Buscar"; usando Enter...');
        await this.page.keyboard.press('Enter');
      }
      // =========================
      
      try {
        await this.page.waitForSelector('table tbody tr, .no-results', { timeout: 5000 });
      } catch (err) {
        console.log('No se encontró la tabla o no hay resultados');
      }

      await delay(1500);

      // Evalúa la tabla para obtener la información
      const searchResult = await this.page.evaluate((guardado) => {
        const row = document.querySelector('table tbody tr');
        if (!row) {
          return {
            hayDatos: false,
            costosCoinciden: false
          };
        }

        const cells = row.querySelectorAll('td');
        const tieneContenido = cells[2] && 
                             cells[2].textContent && 
                             cells[2].textContent.trim() !== '' && 
                             cells[2].textContent.trim() !== '$0.00' &&
                             cells[2].textContent.trim() !== '$0';
        
        if (!tieneContenido) {
          return {
            hayDatos: false,
            costosCoinciden: false
          };
        }

        // Quita '$' y ',' para poder comparar como número
        const costoSistema = cells[2] ? cells[2].textContent.trim().replace('$', '').replace(',', '') : '0';
        const costosCoinciden = parseFloat(costoSistema) === parseFloat(guardado);

        return {
          costo: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
            .format(parseFloat(costoSistema)),
          estatus: cells[3]?.textContent?.trim() || '',
          notas: cells[4]?.textContent?.trim() || '',
          fechaRegistro: cells[5]?.textContent?.trim() || '',
          servicio: cells[6]?.textContent?.trim() || '',
          subservicio: cells[7]?.textContent?.trim() || '',
          validacion: costosCoinciden ? 'Aceptado' : 'No aceptado',
          hayDatos: true,
          costosCoinciden
        };
      }, costoGuardado);

      // Actualización de estadísticas
      if (searchResult.hayDatos) {
        this.stats.totalConCosto++;

        // Si coinciden, incrementa aceptados Y haz la liberación (clic en botón)
        if (searchResult.costosCoinciden) {
          this.stats.totalAceptados++;

          // === INICIO de la lógica para presionar el botón de aceptación ===
          console.log('Costos coinciden, iniciando proceso de aceptación...');
          try {
            const buttonClicked = await this.page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const acceptButton = buttons.find(button =>
                button.querySelector('.mat-mdc-button-touch-target') &&
                button.closest('td') &&
                button.closest('td').cellIndex === 0
              );
              if (acceptButton) {
                acceptButton.click();
                return true;
              }
              return false;
            });

            if (!buttonClicked) {
              throw new Error('No se encontró el botón de aceptar');
            }

            await delay(2000);

            const confirmed = await this.page.evaluate(() => {
              const modalButtons = Array.from(document.querySelectorAll('.cdk-overlay-container button'));
              const confirmButton = modalButtons.find(button =>
                button.textContent.trim().toLowerCase().includes('aceptar')
              );
              if (confirmButton) {
                confirmButton.click();
                return true;
              }
              return false;
            });

            if (confirmed) {
              console.log('Confirmación realizada');
              await delay(3000);
            } else {
              throw new Error('No se pudo confirmar la aceptación');
            }
          } catch (acceptError) {
            console.error('Error durante el proceso de aceptación:', acceptError);
            searchResult.validacion = 'Error en aceptación';
          }
          // === FIN de la lógica para presionar el botón de aceptación ===
        }
      }

      delete searchResult.hayDatos;

      console.log(`Resultado para ${expediente}:`, {
        ...searchResult,
        stats: this.stats
      });

      return {
        ...searchResult,
        stats: this.stats
      };

    } catch (error) {
      console.error(`Error searching expediente ${expediente}:`, error);
      return {
        costo: '',
        estatus: '',
        notas: '',
        fechaRegistro: '',
        servicio: '',
        subservicio: '',
        validacion: 'Sin datos en sistema',
        stats: this.stats
      };
    }
  }

  async close() {
    if (this.browser) {
      console.log('Esperando 2s antes de cerrar...');
      await delay(2000);
      console.log('Cerrando navegador...');
      await this.browser.close();
    }
  }
}

module.exports = BrowserHandler;