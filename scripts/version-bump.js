// scripts/version-bump.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Crear interfaz para leer input del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Leer el package.json actual
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

console.log(`Versión actual: ${currentVersion}`);

// Función para incrementar versión automáticamente
function incrementVersion(version, type) {
  const parts = version.split('.');
  if (parts.length !== 3) {
    console.error('Formato de versión incorrecto. Debe ser x.y.z');
    process.exit(1);
  }

  let [major, minor, patch] = parts.map(Number);

  switch (type) {
    case 'patch':
      patch += 1;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      break;
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      break;
    default:
      console.error('Tipo de incremento inválido. Debe ser patch, minor o major');
      process.exit(1);
  }

  return `${major}.${minor}.${patch}`;
}

// Preguntar por el tipo de actualización
rl.question('Tipo de actualización (patch/minor/major): ', (type) => {
  if (!['patch', 'minor', 'major'].includes(type)) {
    console.error('Tipo de actualización inválido. Debe ser patch, minor o major');
    rl.close();
    process.exit(1);
  }

  const newVersion = incrementVersion(currentVersion, type);
  
  // Preguntar confirmación
  rl.question(`¿Incrementar versión de ${currentVersion} a ${newVersion}? (s/n): `, (answer) => {
    if (answer.toLowerCase() !== 's') {
      console.log('Operación cancelada');
      rl.close();
      return;
    }

    // Actualizar package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    console.log(`Versión actualizada a ${newVersion}`);
    console.log('¡Ahora puedes ejecutar npm run publish para publicar la nueva versión!');
    
    rl.close();
  });
});