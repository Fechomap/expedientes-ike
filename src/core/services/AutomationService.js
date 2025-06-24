const puppeteer = require('puppeteer-core');
const Logger = require('../../shared/utils/Logger');
const { AutomationError } = require('../../shared/errors');
const ProcessEvents = require('../../shared/events/events/ProcessEvents');
const SearchResult = require('../domain/value-objects/SearchResult');

class AutomationService {
  constructor(eventBus, configRepository) {
    this.eventBus = eventBus;
    this.configRepository = configRepository;
    this.logger = Logger.getInstance('AutomationService');
    this.browser = null;
    this.page = null;
    this.stats = {
      totalRevisados: 0,
      totalConCosto: 0,
      totalAceptados: 0
    };
    this.releaseLogicConfig = {
      exactMatch: true,
      marginLogic: false,
      superiorLogic: false
    };
  }

  async initializeBrowser() {
    try {
      this.logger.info('Initializing browser');
      
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        executablePath: this.getChromePath(),
        timeout: 60000
      });

      this.page = await this.browser.newPage();
      await this.page.setDefaultNavigationTimeout(60000);

      this.eventBus.publish(ProcessEvents.BROWSER_CREATED, {
        browserVersion: await this.browser.version()
      });

      this.logger.info('Browser initialized successfully');
      return this.browser;
    } catch (error) {
      this.logger.error('Error initializing browser', error);
      throw new AutomationError('Failed to initialize browser', null, 'initialize', error);
    }
  }

  getChromePath() {
    const platform = process.platform;
    
    if (platform === 'win32') {
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else if (platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
      return '/usr/bin/google-chrome';
    }
  }

  async login() {
    try {
      this.logger.info('Starting login process');
      
      const credentials = await this.configRepository.getCredentials();
      if (!credentials) {
        throw new AutomationError('No credentials configured');
      }

      await this.page.goto('https://portalproveedores.ikeasistencia.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for login elements
      await this.page.waitForSelector('input[formcontrolname="username"]', { timeout: 30000 });
      await this.page.waitForSelector('input[formcontrolname="password"]', { timeout: 30000 });

      // Type credentials
      await this.page.type('input[formcontrolname="username"]', credentials.username, { delay: 30 });
      await this.page.type('input[formcontrolname="password"]', credentials.password, { delay: 30 });

      // Submit login
      await this.page.click('button[type="submit"]');

      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Verify login success
      const isLoggedIn = await this.page.evaluate(() => {
        return !document.querySelector('input[formcontrolname="password"]');
      });

      if (!isLoggedIn) {
        throw new Error('Login failed');
      }

      this.logger.info('Login completed successfully');
      return true;
    } catch (error) {
      this.logger.error('Login failed', error);
      throw new AutomationError('Login failed', '#btnIngresar', 'login', error);
    }
  }

  async searchExpediente(numeroExpediente, costoGuardado = 0) {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Searching expediente', { numeroExpediente, costoGuardado });
      
      // Navigate to search page
      await this.navigateToSearchPage();
      
      // Perform search
      await this.performSearch(numeroExpediente);
      
      // Extract results
      const result = await this.extractSearchResults(numeroExpediente, costoGuardado);
      
      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;
      
      this.updateStats(result);
      
      this.eventBus.publish(ProcessEvents.EXPEDIENTE_PROCESSED, {
        numeroExpediente,
        result: result.toJSON(),
        processingTime
      });
      
      this.logger.debug('Expediente search completed', { 
        numeroExpediente, 
        success: result.isSuccessful(),
        processingTime 
      });
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error('Error searching expediente', error, { numeroExpediente });
      
      const failureResult = SearchResult.failure(numeroExpediente, error, processingTime);
      
      this.eventBus.publish(ProcessEvents.EXPEDIENTE_FAILED, {
        numeroExpediente,
        error: error.message,
        processingTime
      });
      
      return failureResult;
    }
  }

  async navigateToSearchPage() {
    try {
      const searchUrl = 'https://portalproveedores.ikeasistencia.com/admin/services/pendientes';
      
      // Only navigate if not already on the correct page (like legacy system)
      if (!this.page.url().includes('portalproveedores.ikeasistencia.com')) {
        this.logger.debug('Navigating to search page...');
        await this.page.goto(searchUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // Add delay after navigation like legacy
        await this.delay(1500);
      } else {
        this.logger.debug('Already on search page, skipping navigation');
      }

      // Wait for search input field
      const inputSelectors = [
        'input[placeholder="No. Expediente:*"]',
        'input[formcontrolname="expediente"]',
        'input.mat-mdc-input-element',
        'input[type="text"]'
      ];

      let inputElement = null;
      for (const sel of inputSelectors) {
        try {
          inputElement = await this.page.$(sel);
          if (inputElement) {
            this.logger.debug('Search input found with selector', sel);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!inputElement) {
        throw new Error('Could not find search input field');
      }
    } catch (error) {
      throw new AutomationError('Failed to navigate to search page', null, 'navigate', error);
    }
  }

  async performSearch(numeroExpediente) {
    try {
      // Find the search input
      const inputSelectors = [
        'input[placeholder="No. Expediente:*"]',
        'input[formcontrolname="expediente"]',
        'input.mat-mdc-input-element',
        'input[type="text"]'
      ];

      let inputElement = null;
      for (const sel of inputSelectors) {
        try {
          inputElement = await this.page.$(sel);
          if (inputElement) break;
        } catch (e) {
          continue;
        }
      }

      if (!inputElement) {
        throw new Error('Could not find search input field');
      }

      // Clear and enter expediente number
      await inputElement.click({ clickCount: 3 });
      await this.page.waitForTimeout(300);
      await this.page.evaluate((el) => { el.value = ''; }, inputElement);

      // Type expediente number with delay
      for (const char of numeroExpediente.toString()) {
        await this.page.keyboard.type(char, { delay: 50 });
      }
      await this.page.waitForTimeout(300);

      // Find and click search button
      const searchButton = await this.page.$$eval('button', (buttons) => {
        return buttons.find(btn => btn.textContent.includes('Buscar'));
      });

      if (searchButton) {
        this.logger.debug('Search button found, clicking...');
        await searchButton.click();
      } else {
        this.logger.debug('Search button not found, using Enter key...');
        await this.page.keyboard.press('Enter');
      }

      // Wait for results
      try {
        await this.page.waitForSelector('table tbody tr, .no-results', { timeout: 5000 });
      } catch (err) {
        this.logger.debug('No results table found or no results');
      }

      await this.page.waitForTimeout(1500);
    } catch (error) {
      throw new AutomationError('Failed to perform search', null, 'search', error);
    }
  }

  async extractSearchResults(numeroExpediente, costoGuardado = 0) {
    try {
      // Check if results table exists
      const hasResults = await this.page.$('table tbody tr') !== null;
      
      if (!hasResults) {
        return SearchResult.empty(numeroExpediente);
      }

      // Extract data from the results table
      const data = await this.page.evaluate((guardado) => {
        const row = document.querySelector('table tbody tr');
        if (!row) return null;

        const cells = row.querySelectorAll('td');
        
        // Check if there's meaningful content in the cost cell
        const tieneContenido = cells[2] && 
                             cells[2].textContent && 
                             cells[2].textContent.trim() !== '' && 
                             cells[2].textContent.trim() !== '$0.00' &&
                             cells[2].textContent.trim() !== '$0';
        
        if (!tieneContenido) {
          return null;
        }

        // Extract cost and format it
        const costoSistema = cells[2] ? cells[2].textContent.trim().replace('$', '').replace(',', '') : '0';

        return {
          costo: parseFloat(costoSistema), // Guardar como número, no como string formateado
          estatus: cells[3]?.textContent?.trim() || '',
          notas: cells[4]?.textContent?.trim() || '',
          fechaRegistro: cells[5]?.textContent?.trim() || '',
          servicio: cells[6]?.textContent?.trim() || '',
          subservicio: cells[7]?.textContent?.trim() || '',
          validacion: 'PENDIENTES', // Se actualiza después si se libera
          rawCosto: parseFloat(costoSistema),
          costosCoinciden: parseFloat(costoSistema) === parseFloat(guardado) // mantener compatibilidad
        };
      }, costoGuardado);

      if (!data) {
        return SearchResult.empty(numeroExpediente);
      }

      // Update stats
      this.stats.totalConCosto++;

      // Implementar las nuevas lógicas de liberación fuera del page.evaluate()
      const releaseResult = this.shouldReleaseExpediente(data.rawCosto, costoGuardado);
      data.shouldRelease = releaseResult.shouldRelease;
      data.logicUsed = releaseResult.logicUsed;
      data.validationDate = new Date(); // Agregar fecha y hora de validación

      // Si debe liberarse según las lógicas configuradas, realizar liberación automática
      if (releaseResult.shouldRelease) {
        this.stats.totalAceptados++;
        
        this.logger.info('Costs match, starting automatic liberation process', { 
          numeroExpediente, 
          costoGuardado, 
          costoSistema: data.rawCosto 
        });
        
        try {
          await this.performAutomaticLiberation();
          data.validacion = 'ACEPTADO';
        } catch (liberationError) {
          this.logger.error('Error during automatic liberation', liberationError);
          data.validacion = 'PENDIENTES';
        }
      }

      return SearchResult.success(numeroExpediente, data);
    } catch (error) {
      throw new AutomationError('Failed to extract search results', 'table tbody tr', 'extract', error);
    }
  }

  async performAutomaticLiberation() {
    try {
      this.logger.debug('Starting automatic liberation process');
      
      // Buscar y hacer clic en el botón de aceptar (como en legacy)
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

      this.logger.debug('Accept button clicked, waiting for confirmation modal');
      await this.delay(2000);

      // Confirmar en el modal (como en legacy)
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
        this.logger.info('Automatic liberation completed successfully');
        await this.delay(3000);
      } else {
        throw new Error('No se pudo confirmar la aceptación en el modal');
      }
      
    } catch (error) {
      this.logger.error('Error during automatic liberation', error);
      throw new AutomationError('Failed to perform automatic liberation', null, 'liberate', error);
    }
  }

  updateStats(result) {
    this.stats.totalRevisados++;
    
    // Las estadísticas de costo y aceptados se manejan en extractSearchResults
    // porque ahí tenemos acceso al costoGuardado para comparación
    
    this.logger.debug('Stats updated', this.stats);
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats = {
      totalRevisados: 0,
      totalConCosto: 0,
      totalAceptados: 0
    };
  }

  async closeBrowser() {
    try {
      this.logger.info('Closing browser');
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        
        this.eventBus.publish(ProcessEvents.BROWSER_CLOSED, {
          timestamp: new Date()
        });
      }
      
      this.logger.info('Browser closed successfully');
    } catch (error) {
      this.logger.error('Error closing browser', error);
      throw new AutomationError('Failed to close browser', null, 'close', error);
    }
  }

  async dispose() {
    await this.closeBrowser();
    this.resetStats();
  }

  isInitialized() {
    return this.browser !== null && this.page !== null;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Método para configurar las lógicas de liberación
  setReleaseLogicConfig(config) {
    this.releaseLogicConfig = {
      exactMatch: true, // siempre activa
      marginLogic: config.marginLogic || false,
      superiorLogic: config.superiorLogic || false
    };
    this.logger.info('Release logic config updated', this.releaseLogicConfig);
  }

  // Método que implementa las lógicas de liberación y retorna {shouldRelease, logicUsed}
  shouldReleaseExpediente(costoSistema, costoGuardado) {
    // Lógica 1: Costo exacto (siempre activa)
    if (costoSistema === costoGuardado) {
      this.logger.info('Expediente should be released: Exact match', { costoSistema, costoGuardado });
      return { shouldRelease: true, logicUsed: 1 };
    }

    // Lógica 2: Margen de ±10%
    if (this.releaseLogicConfig.marginLogic) {
      const margenInferior = costoGuardado * 0.9;
      const margenSuperior = costoGuardado * 1.1;
      
      if (costoSistema >= margenInferior && costoSistema <= margenSuperior) {
        this.logger.info('Expediente should be released: Within ±10% margin', { 
          costoSistema, 
          costoGuardado, 
          margenInferior, 
          margenSuperior 
        });
        return { shouldRelease: true, logicUsed: 2 };
      }
    }

    // Lógica 3: Costo superior al ingresado
    if (this.releaseLogicConfig.superiorLogic) {
      if (costoSistema > costoGuardado) {
        this.logger.info('Expediente should be released: Superior cost', { costoSistema, costoGuardado });
        return { shouldRelease: true, logicUsed: 3 };
      }
    }

    this.logger.info('Expediente should NOT be released', { 
      costoSistema, 
      costoGuardado, 
      config: this.releaseLogicConfig 
    });
    return { shouldRelease: false, logicUsed: null };
  }
}

module.exports = AutomationService;