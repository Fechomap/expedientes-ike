# Plan de Refactorización Estratégica - IKE Expedientes Automation

## Resumen Ejecutivo

El proyecto EXPEDIENTES-IKE presenta una arquitectura monolítica con serios problemas de mantenibilidad, escalabilidad y separación de responsabilidades. Este documento detalla un plan estratégico para transformar la aplicación en un sistema modular, escalable y mantenible.

## 1. Diagnóstico del Estado Actual

### 1.1 Problemas Críticos Identificados

#### Arquitectura Monolítica
- **licenseHandler.js**: 1001 líneas manejando 8+ responsabilidades diferentes
- **browserHandler.js**: Método `searchExpediente()` con 197 líneas
- **main.js**: Función `verificarLicenciaInicial()` con 136 líneas

#### Violación de Principios SOLID
- **Responsabilidad Única**: Múltiples clases manejan UI, lógica de negocio y persistencia
- **Abierto/Cerrado**: Modificar funcionalidad requiere cambios en archivos core
- **Inversión de Dependencias**: Dependencias concretas en lugar de abstracciones

#### Acoplamiento y Cohesión
- Lógica de negocio mezclada con presentación
- Comunicación IPC sin capa de abstracción
- Múltiples fuentes de verdad para el estado

#### Sistema de Reportes Inexistente
- Solo se muestran estadísticas en consola
- No hay persistencia de resultados
- No hay generación de reportes compartibles

## 2. Arquitectura Propuesta

### 2.1 Estructura de Directorios

```
src/
├── core/                      # Lógica de negocio
│   ├── domain/               # Entidades y reglas de negocio
│   │   ├── entities/
│   │   │   ├── Expediente.js
│   │   │   ├── License.js
│   │   │   └── Report.js
│   │   └── value-objects/
│   │       ├── Token.js
│   │       └── SearchResult.js
│   │
│   ├── services/             # Servicios de aplicación
│   │   ├── LicenseService.js
│   │   ├── ExcelService.js
│   │   ├── AutomationService.js
│   │   ├── ReportService.js
│   │   └── ConfigService.js
│   │
│   └── use-cases/            # Casos de uso
│       ├── ValidateLicense.js
│       ├── ProcessExpedientes.js
│       ├── GenerateReport.js
│       └── ExportResults.js
│
├── infrastructure/           # Implementaciones técnicas
│   ├── persistence/         # Almacenamiento
│   │   ├── repositories/
│   │   │   ├── LicenseRepository.js
│   │   │   ├── ConfigRepository.js
│   │   │   └── ReportRepository.js
│   │   └── storage/
│   │       ├── ElectronStore.js
│   │       └── MongoDBAdapter.js
│   │
│   ├── automation/          # Puppeteer
│   │   ├── BrowserPool.js
│   │   ├── PageAutomation.js
│   │   └── selectors/
│   │       └── IKESelectors.js
│   │
│   ├── excel/               # ExcelJS
│   │   ├── ExcelReader.js
│   │   ├── ExcelWriter.js
│   │   └── ExcelProcessor.js
│   │
│   └── api/                 # Comunicación externa
│       ├── APIClient.js
│       └── endpoints/
│           └── LicenseAPI.js
│
├── presentation/            # Capa de presentación
│   ├── ipc/                # Comunicación IPC
│   │   ├── handlers/
│   │   │   ├── LicenseHandler.js
│   │   │   ├── ProcessHandler.js
│   │   │   └── ReportHandler.js
│   │   ├── IPCRouter.js
│   │   └── IPCMiddleware.js
│   │
│   └── windows/            # Gestión de ventanas
│       ├── WindowManager.js
│       ├── factories/
│       │   ├── MainWindowFactory.js
│       │   ├── LicenseWindowFactory.js
│       │   └── ReportWindowFactory.js
│       └── preload/
│           └── PreloadAPI.js
│
├── shared/                  # Código compartido
│   ├── errors/             # Manejo de errores
│   │   ├── AppError.js
│   │   ├── ValidationError.js
│   │   ├── NetworkError.js
│   │   └── AutomationError.js
│   │
│   ├── events/             # Sistema de eventos
│   │   ├── EventBus.js
│   │   └── events/
│   │       ├── LicenseEvents.js
│   │       └── ProcessEvents.js
│   │
│   └── utils/              # Utilidades
│       ├── Logger.js
│       ├── Validator.js
│       └── DateHelper.js
│
└── main.js                 # Punto de entrada simplificado
```

### 2.2 Patrones de Diseño a Implementar

#### Repository Pattern
```javascript
// core/domain/repositories/ILicenseRepository.js
class ILicenseRepository {
  async save(license) { throw new Error('Not implemented'); }
  async findByToken(token) { throw new Error('Not implemented'); }
  async update(license) { throw new Error('Not implemented'); }
}

// infrastructure/persistence/repositories/LicenseRepository.js
class LicenseRepository extends ILicenseRepository {
  constructor(storage) {
    this.storage = storage;
  }
  
  async save(license) {
    return await this.storage.set('license', license.toJSON());
  }
}
```

#### Service Layer Pattern
```javascript
// core/services/LicenseService.js
class LicenseService {
  constructor(licenseRepository, apiClient, eventBus) {
    this.licenseRepository = licenseRepository;
    this.apiClient = apiClient;
    this.eventBus = eventBus;
  }
  
  async validateLicense(token) {
    try {
      const license = await this.licenseRepository.findByToken(token);
      
      if (license && !license.isExpired()) {
        return { valid: true, license };
      }
      
      const validation = await this.apiClient.validateToken(token);
      
      if (validation.success) {
        const newLicense = License.fromAPIResponse(validation);
        await this.licenseRepository.save(newLicense);
        this.eventBus.emit('license:validated', newLicense);
        return { valid: true, license: newLicense };
      }
      
      return { valid: false, error: validation.error };
    } catch (error) {
      throw new ValidationError('Error validating license', error);
    }
  }
}
```

#### Command Pattern para IPC
```javascript
// presentation/ipc/commands/ValidateLicenseCommand.js
class ValidateLicenseCommand {
  constructor(licenseService) {
    this.licenseService = licenseService;
  }
  
  async execute(params) {
    const { token } = params;
    return await this.licenseService.validateLicense(token);
  }
}

// presentation/ipc/IPCRouter.js
class IPCRouter {
  constructor() {
    this.commands = new Map();
  }
  
  register(channel, command) {
    this.commands.set(channel, command);
  }
  
  async handle(channel, params) {
    const command = this.commands.get(channel);
    if (!command) throw new Error(`No handler for channel: ${channel}`);
    
    return await command.execute(params);
  }
}
```

## 3. Sistema de Reportes

### 3.1 Arquitectura del Sistema de Reportes

```javascript
// core/domain/entities/Report.js
class Report {
  constructor(data) {
    this.id = data.id;
    this.createdAt = data.createdAt || new Date();
    this.type = data.type; // 'daily', 'summary', 'detailed'
    this.results = data.results || [];
    this.statistics = data.statistics || {};
    this.metadata = data.metadata || {};
  }
  
  addResult(expedienteResult) {
    this.results.push(expedienteResult);
    this.updateStatistics();
  }
  
  updateStatistics() {
    this.statistics = {
      total: this.results.length,
      successful: this.results.filter(r => r.status === 'success').length,
      failed: this.results.filter(r => r.status === 'error').length,
      withCost: this.results.filter(r => r.hasCost).length,
      averageProcessingTime: this.calculateAverageTime()
    };
  }
}

// core/services/ReportService.js
class ReportService {
  constructor(reportRepository, exportStrategies) {
    this.reportRepository = reportRepository;
    this.exportStrategies = exportStrategies;
  }
  
  async generateReport(results, options = {}) {
    const report = new Report({
      type: options.type || 'summary',
      results: results,
      metadata: {
        generatedBy: options.user,
        searchCriteria: options.criteria,
        dateRange: options.dateRange
      }
    });
    
    await this.reportRepository.save(report);
    return report;
  }
  
  async exportReport(reportId, format) {
    const report = await this.reportRepository.findById(reportId);
    const strategy = this.exportStrategies[format];
    
    if (!strategy) {
      throw new Error(`Export format ${format} not supported`);
    }
    
    return await strategy.export(report);
  }
}
```

### 3.2 Estrategias de Exportación

```javascript
// infrastructure/reports/exporters/PDFExporter.js
class PDFExporter {
  async export(report) {
    // Implementación para generar PDF
    const doc = new PDFDocument();
    doc.addHeader(report.metadata);
    doc.addStatistics(report.statistics);
    doc.addDetailedResults(report.results);
    return await doc.save();
  }
}

// infrastructure/reports/exporters/ExcelExporter.js
class ExcelExporter {
  async export(report) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte');
    
    // Agregar encabezados
    sheet.addRow(['Expediente', 'Estado', 'Costo', 'Fecha']);
    
    // Agregar datos
    report.results.forEach(result => {
      sheet.addRow([
        result.expediente,
        result.status,
        result.cost,
        result.processedAt
      ]);
    });
    
    return await workbook.xlsx.writeBuffer();
  }
}

// infrastructure/reports/exporters/HTMLExporter.js
class HTMLExporter {
  async export(report) {
    return this.generateHTML(report);
  }
  
  generateHTML(report) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Expedientes - ${report.createdAt}</title>
          <style>${this.getStyles()}</style>
        </head>
        <body>
          <h1>Reporte de Procesamiento de Expedientes</h1>
          <div class="statistics">${this.renderStatistics(report.statistics)}</div>
          <div class="results">${this.renderResults(report.results)}</div>
        </body>
      </html>
    `;
  }
}
```

## 4. Plan de Implementación

### Fase 1: Preparación (1-2 semanas)
1. **Configurar estructura de directorios**
2. **Implementar capa de errores personalizada**
3. **Crear sistema de logging estructurado**
4. **Configurar inyección de dependencias**

### Fase 2: Core y Domain (2-3 semanas)
1. **Crear entidades del dominio**
2. **Implementar repositorios con interfaces**
3. **Desarrollar servicios core**
4. **Implementar casos de uso**

### Fase 3: Infrastructure (2-3 semanas)
1. **Migrar lógica de puppeteer a BrowserPool**
2. **Refactorizar manejo de Excel**
3. **Implementar adaptadores de almacenamiento**
4. **Crear cliente API mejorado**

### Fase 4: Presentation (1-2 semanas)
1. **Implementar IPCRouter con commands**
2. **Refactorizar gestión de ventanas**
3. **Crear nueva API de preload**
4. **Migrar handlers IPC existentes**

### Fase 5: Sistema de Reportes (2 semanas)
1. **Implementar entidad Report**
2. **Crear ReportService**
3. **Desarrollar estrategias de exportación**
4. **Crear UI para visualización de reportes**

### Fase 6: Testing y Migración (1-2 semanas)
1. **Escribir tests unitarios para servicios**
2. **Tests de integración para flujos críticos**
3. **Migración gradual del código legacy**
4. **Pruebas de regresión**

## 5. Métricas de Éxito

### Calidad del Código
- **Reducción de complejidad ciclomática**: De >20 a <10 por método
- **Cobertura de tests**: Mínimo 80% en lógica de negocio
- **Tamaño de archivos**: Ningún archivo >200 líneas
- **Acoplamiento**: Dependencias inyectadas, no hardcodeadas

### Performance
- **Tiempo de procesamiento**: Reducción del 30% mediante pool de browsers
- **Uso de memoria**: Reducción del 40% con mejor gestión de recursos
- **Tiempo de inicio**: <3 segundos

### Mantenibilidad
- **Tiempo para agregar features**: Reducción del 50%
- **Bugs por release**: Reducción del 70%
- **Tiempo de onboarding**: De 2 semanas a 3 días

## 6. Consideraciones Técnicas

### Gestión de Estado
```javascript
// shared/state/AppState.js
class AppState {
  constructor() {
    this.state = new Map();
    this.subscribers = new Map();
  }
  
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
  }
  
  setState(key, value) {
    this.state.set(key, value);
    this.notify(key, value);
  }
  
  getState(key) {
    return this.state.get(key);
  }
  
  private notify(key, value) {
    const callbacks = this.subscribers.get(key) || [];
    callbacks.forEach(callback => callback(value));
  }
}
```

### Manejo de Errores
```javascript
// shared/errors/ErrorHandler.js
class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }
  
  async handle(error, context) {
    this.logger.error({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    });
    
    if (error instanceof ValidationError) {
      return this.handleValidationError(error);
    }
    
    if (error instanceof NetworkError) {
      return this.handleNetworkError(error);
    }
    
    return this.handleGenericError(error);
  }
}
```

## 7. Próximos Pasos

1. **Validar el plan con el equipo**
2. **Priorizar las fases según necesidades del negocio**
3. **Establecer ambiente de desarrollo con la nueva estructura**
4. **Comenzar con Fase 1: Preparación**
5. **Implementar CI/CD para garantizar calidad**

## Conclusión

Esta refactorización transformará EXPEDIENTES-IKE de una aplicación monolítica difícil de mantener a una arquitectura modular, escalable y profesional. El nuevo sistema de reportes permitirá compartir resultados de manera efectiva, mientras que la separación de responsabilidades facilitará el mantenimiento y la adición de nuevas funcionalidades.