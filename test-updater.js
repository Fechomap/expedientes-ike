// test-updater.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICADOR DEL SISTEMA DE ACTUALIZACIONES 🔍');
console.log('=============================================\n');

// 1. Verificar configuración
console.log('1. Verificando configuración...');

// Verificar package.json
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ Versión actual: ${packageJson.version}`);
  
  if (!packageJson.dependencies['electron-updater']) {
    console.log('❌ Falta la dependencia electron-updater');
  } else {
    console.log(`✅ electron-updater encontrado (${packageJson.dependencies['electron-updater']})`);
  }
  
  if (!packageJson.scripts.publish || !packageJson.scripts['publish:win']) {
    console.log('❌ Faltan los scripts de publicación');
  } else {
    console.log('✅ Scripts de publicación encontrados');
  }
} catch (error) {
  console.log('❌ Error al leer package.json:', error.message);
}

// Verificar configuración de publicación
let s3Configured = false;
try {
  if (fs.existsSync('electron-builder.yml')) {
    const builderConfig = fs.readFileSync('electron-builder.yml', 'utf8');
    if (builderConfig.includes('provider: s3') && builderConfig.includes('bucket:')) {
      console.log('✅ Configuración S3 encontrada en electron-builder.yml');
      s3Configured = true;
    }
  }
  
  if (!s3Configured) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (packageJson.build?.publish?.[0]?.provider === 's3' && packageJson.build?.publish?.[0]?.bucket) {
      console.log('✅ Configuración S3 encontrada en package.json');
      s3Configured = true;
    }
  }
  
  if (!s3Configured) {
    console.log('❌ No se encontró configuración de S3');
  }
} catch (error) {
  console.log('❌ Error al verificar configuración:', error.message);
}

// 2. Verificar credenciales de AWS
console.log('\n2. Verificando credenciales de AWS...');

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  console.log('✅ Variables de entorno AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY encontradas');
} else {
  console.log('❌ No se encontraron variables de entorno de AWS');
  console.log('   Recuerda configurar las variables antes de publicar:');
  console.log('   set AWS_ACCESS_KEY_ID=tu_access_key_id');
  console.log('   set AWS_SECRET_ACCESS_KEY=tu_secret_access_key');
  
  // Verificar archivo de credenciales
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const awsCredentialsPath = path.join(homeDir, '.aws', 'credentials');
  
  if (fs.existsSync(awsCredentialsPath)) {
    console.log('✅ Archivo de credenciales AWS encontrado en ~/.aws/credentials');
  } else {
    console.log('❌ No se encontró archivo de credenciales AWS');
  }
}

// 3. Verificar función principal de actualización
console.log('\n3. Verificando implementación en main.js...');

try {
  const mainPath = path.join(__dirname, 'src', 'main.js');
  const mainContent = fs.readFileSync(mainPath, 'utf8');
  
  if (mainContent.includes('electron-updater') && 
      mainContent.includes('autoUpdater') && 
      mainContent.includes('setupAutoUpdater')) {
    console.log('✅ Configuración de autoUpdater encontrada en main.js');
  } else {
    console.log('❌ Configuración de autoUpdater no encontrada en main.js');
  }
  
  if (mainContent.includes('update-available') && 
      mainContent.includes('update-downloaded')) {
    console.log('✅ Eventos de actualización implementados');
  } else {
    console.log('❌ Eventos de actualización no implementados completamente');
  }
} catch (error) {
  console.log('❌ Error al verificar main.js:', error.message);
}

// 4. Verificar preload.js
console.log('\n4. Verificando preload.js...');

try {
  const preloadPath = path.join(__dirname, 'src', 'preload.js');
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');
  
  if (preloadContent.includes('checkForUpdates') && 
      preloadContent.includes('getAppVersion') && 
      preloadContent.includes('onUpdateAvailable')) {
    console.log('✅ Métodos de actualización expuestos en preload.js');
  } else {
    console.log('❌ Métodos de actualización no expuestos completamente en preload.js');
  }
} catch (error) {
  console.log('❌ Error al verificar preload.js:', error.message);
}

// 5. Sugerir próximos pasos
console.log('\n5. Prueba de publicación:');
console.log('   Para probar el sistema de actualizaciones, ejecuta:');
console.log('   1. Asegúrate de tener configuradas las credenciales de AWS');
console.log('   2. npm version patch');
console.log('   3. npm run publish:win');
console.log('   4. Instala una versión anterior en otro equipo y verifica que detecte la actualización');

console.log('\n¡Verificación completada!');