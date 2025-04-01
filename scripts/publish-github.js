// scripts/publish-github.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);

const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Función principal
async function main() {
  try {
    console.log('Iniciando proceso de publicación en GitHub...');
    
    // Verificar token de GitHub
    if (!process.env.GH_TOKEN) {
      console.error('Error: No se encontró GH_TOKEN. Configure la variable de entorno primero.');
      console.error('Ejemplo: set GH_TOKEN=ghp_your_token_here');
      process.exit(1);
    }

    // Leer versión actual
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;

    console.log(`Publicando versión ${currentVersion} en GitHub...`);

    // Construir y publicar para Windows
    console.log('Construyendo y publicando para Windows...');
    try {
      execSync('electron-builder --win -p always', { 
        stdio: 'inherit',
        env: { ...process.env }
      });
      console.log('Publicación para Windows completada con éxito.');
    } catch (error) {
      console.error('Error al publicar para Windows:', error.message);
      process.exit(1);
    }
    
    // Opcional: Construir y publicar para macOS
    console.log('¿Desea publicar también para macOS? (s/n)');
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('', (answer) => {
      if (answer.toLowerCase() === 's') {
        try {
          console.log('Construyendo y publicando para macOS...');
          execSync('electron-builder --mac -p always', { 
            stdio: 'inherit',
            env: { ...process.env }
          });
          console.log('Publicación para macOS completada con éxito.');
        } catch (error) {
          console.error('Error al publicar para macOS:', error.message);
        }
      }
      
      console.log(`\nPublicación completada con éxito. Pasos siguientes:
1. Visita: https://github.com/Fechomap/expedientes-ike/releases
2. Edita el lanzamiento para agregar notas de versión
3. Publica el lanzamiento cuando esté listo`);
      
      readline.close();
    });
    
  } catch (error) {
    console.error('Error durante el proceso de publicación:', error.message);
    process.exit(1);
  }
}

// Ejecutar función principal
main().catch(console.error);