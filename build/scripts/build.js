// build.js
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');
const asar = require('asar');
const { exec } = require('child_process');

// Configuración de ofuscación
const obfuscatorConfig = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    numbersToExpressions: true,
    simplify: true,
    stringArrayShuffle: true,
    splitStrings: true,
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: true
};

// Función para ofuscar un archivo
async function obfuscateFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, obfuscatorConfig);
    fs.writeFileSync(filePath, obfuscatedCode.getObfuscatedCode());
}

// Función para procesar recursivamente directorios
async function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            await processDirectory(fullPath);
        } else if (file.endsWith('.js')) {
            await obfuscateFile(fullPath);
        }
    }
}

// Función principal de construcción
async function build() {
    try {
        // 1. Limpiar directorio dist
        console.log('Limpiando directorio dist...');
        if (fs.existsSync('dist')) {
            fs.rmSync('dist', { recursive: true });
        }

        // 2. Copiar archivos a un directorio temporal
        console.log('Copiando archivos...');
        const tempDir = path.join(__dirname, 'temp_build');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Copiar archivos necesarios
        exec(`cp -r src/* ${tempDir}/`);

        // 3. Ofuscar código JavaScript
        console.log('Ofuscando código...');
        await processDirectory(tempDir);

        // 4. Empaquetar con electron-builder
        console.log('Empaquetando aplicación...');
        exec('electron-builder --config electron-builder.yml', (error) => {
            if (error) {
                console.error('Error en el empaquetado:', error);
                return;
            }
            
            // 5. Limpiar directorio temporal
            fs.rmSync(tempDir, { recursive: true });
            console.log('¡Construcción completada!');
        });

    } catch (error) {
        console.error('Error en el proceso de construcción:', error);
        process.exit(1);
    }
}

// Ejecutar construcción
build();