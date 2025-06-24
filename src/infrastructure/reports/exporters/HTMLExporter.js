const Logger = require('../../../shared/utils/Logger');

class HTMLExporter {
  constructor() {
    this.logger = Logger.getInstance('HTMLExporter');
  }

  async export(report) {
    try {
      this.logger.info('Exporting report to HTML', { reportId: report.id });
      
      const htmlContent = this.generateHTML(report);
      
      this.logger.info('HTML export completed', { 
        reportId: report.id,
        contentLength: htmlContent.length
      });
      
      return Buffer.from(htmlContent, 'utf-8');
    } catch (error) {
      this.logger.error('Error exporting to HTML', error);
      throw error;
    }
  }

  generateHTML(report) {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Expedientes - ${report.createdAt.toLocaleDateString()}</title>
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="container">
        ${this.renderHeader(report)}
        ${this.renderStatistics(report.statistics)}
        ${this.renderExpedientesTable(report.expedientes)}
        ${this.renderFooter(report)}
    </div>
</body>
</html>
    `.trim();
  }

  getStyles() {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #007bff;
        }
        
        .header h1 {
            color: #007bff;
            margin-bottom: 10px;
        }
        
        .header .subtitle {
            color: #666;
            font-size: 1.1em;
        }
        
        .statistics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .stat-card h3 {
            font-size: 2em;
            margin-bottom: 10px;
        }
        
        .stat-card p {
            font-size: 0.9em;
            opacity: 0.9;
        }
        
        .expedientes-section {
            margin-bottom: 30px;
        }
        
        .section-title {
            color: #007bff;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }
        
        .table-container {
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #007bff;
        }
        
        tr:hover {
            background-color: #f5f5f5;
        }
        
        .status-completed {
            background-color: #d4edda;
            color: #155724;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        
        .status-failed {
            background-color: #f8d7da;
            color: #721c24;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        
        .status-pending {
            background-color: #fff3cd;
            color: #856404;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.9em;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .statistics {
                grid-template-columns: 1fr;
            }
            
            th, td {
                padding: 8px;
                font-size: 0.9em;
            }
        }
    `;
  }

  renderHeader(report) {
    return `
        <div class="header">
            <h1>Reporte de Procesamiento de Expedientes</h1>
            <div class="subtitle">
                <p><strong>Tipo:</strong> ${report.type.charAt(0).toUpperCase() + report.type.slice(1)}</p>
                <p><strong>Generado:</strong> ${report.createdAt.toLocaleString()}</p>
                <p><strong>ID del Reporte:</strong> ${report.id}</p>
            </div>
        </div>
    `;
  }

  renderStatistics(stats) {
    return `
        <div class="statistics">
            <div class="stat-card">
                <h3>${stats.total}</h3>
                <p>Total Expedientes</p>
            </div>
            <div class="stat-card">
                <h3>${stats.completed}</h3>
                <p>Procesados</p>
            </div>
            <div class="stat-card">
                <h3>${stats.failed}</h3>
                <p>Fallidos</p>
            </div>
            <div class="stat-card">
                <h3>${stats.withCost}</h3>
                <p>Con Costo</p>
            </div>
            <div class="stat-card">
                <h3>$${stats.totalCost.toLocaleString()}</h3>
                <p>Costo Total</p>
            </div>
            <div class="stat-card">
                <h3>${stats.successRate}%</h3>
                <p>Tasa de Éxito</p>
            </div>
        </div>
    `;
  }

  renderExpedientesTable(expedientes) {
    const rows = expedientes.map(exp => `
        <tr>
            <td>${exp.numero}</td>
            <td><span class="status-${exp.status}">${exp.status}</span></td>
            <td>${exp.costo || 'N/A'}</td>
            <td>${exp.estatus || 'N/A'}</td>
            <td>${exp.fechaInicio || 'N/A'}</td>
            <td>${exp.fechaTermino || 'N/A'}</td>
            <td>${exp.procedimiento || 'N/A'}</td>
            <td>${exp.abogado || 'N/A'}</td>
            <td>${exp.processedAt ? exp.processedAt.toLocaleString() : 'N/A'}</td>
        </tr>
    `).join('');

    return `
        <div class="expedientes-section">
            <h2 class="section-title">Detalle de Expedientes</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Número</th>
                            <th>Estado</th>
                            <th>Costo</th>
                            <th>Estatus</th>
                            <th>Fecha Inicio</th>
                            <th>Fecha Término</th>
                            <th>Procedimiento</th>
                            <th>Abogado</th>
                            <th>Procesado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
  }

  renderFooter(report) {
    return `
        <div class="footer">
            <p>Reporte generado por IKE Expedientes Automation</p>
            <p>Generado el ${new Date().toLocaleString()}</p>
        </div>
    `;
  }

  getFilename(report) {
    const date = new Date(report.createdAt).toISOString().split('T')[0];
    return `reporte_expedientes_${report.type}_${date}.html`;
  }

  getMimeType() {
    return 'text/html';
  }
}

module.exports = HTMLExporter;