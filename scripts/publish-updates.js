// scripts/publish-updates.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Función principal
async function main() {
  try {
    console.log('Iniciando proceso de publicación de actualización');
    
    // 1. Construir la aplicación sin publicar
    console.log('Construyendo la aplicación...');
    execSync('npm run build:mac', { stdio: 'inherit' });
    
    // 2. Sincronizar manualmente los archivos con el bucket de S3
    console.log('Subiendo archivos a S3...');
    try {
      // Usar AWS CLI para sincronizar la carpeta dist con el bucket de S3
      execSync(`aws s3 sync ./dist s3://ike-expedientes-updates/ --exclude "*" --include "*.dmg" --include "*.blockmap" --include "*.yml" --include "*.exe" --include "*.zip"`, 
        { stdio: 'inherit' }
      );
      console.log('Sincronización completada con éxito.');
    } catch (error) {
      console.error('Error al sincronizar con S3:', error.message);
      console.log('Por favor, asegúrate de tener AWS CLI instalado y configurado correctamente.');
      console.log('Puedes configurarlo con el comando: aws configure');
      process.exit(1);
    }
    
    // 3. Configurar permisos si es necesario
    console.log('Configurando permisos públicos para los archivos...');
    try {
      execSync(`aws s3api put-bucket-policy --bucket ike-expedientes-updates --policy file://${path.join(__dirname, 'bucket-policy.json')}`, 
        { stdio: 'inherit' }
      );
      console.log('Política de bucket aplicada con éxito.');
    } catch (error) {
      console.warn('Advertencia al aplicar la política del bucket:', error.message);
      console.log('Es posible que necesites configurar manualmente los permisos del bucket desde la consola de AWS.');
    }
    
    console.log('¡Publicación completada con éxito!');
    console.log('Los usuarios ahora podrán recibir la actualización a la versión ' + require(packageJsonPath).version);
    
  } catch (error) {
    console.error('Error durante el proceso de publicación:', error);
    process.exit(1);
  }
}

// Crear archivo de política del bucket
fs.writeFileSync(
  path.join(__dirname, 'bucket-policy.json'),
  JSON.stringify({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "PublicReadForGetBucketObjects",
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::ike-expedientes-updates/*"
      }
    ]
  }, null, 2)
);

// Ejecutar función principal
main().catch(console.error);