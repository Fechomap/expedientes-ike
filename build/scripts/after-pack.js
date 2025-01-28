// build/scripts/after-pack.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');

async function afterPack({ appOutDir, packager, electronPlatformName }) {
    console.log('Ejecutando tareas post-empaquetado...');

    // Patrones de archivos a eliminar
    const filesToRemove = [
        '**/*.map',
        '**/*.md',
        '**/LICENSE*',
        '**/README*',
        '**/CHANGELOG*',
        '**/test/**',
        '**/tests/**',
        '**/*.ts',
        '**/.git*',
        '**/docs/**'
    ];

    try {
        // Eliminar archivos usando glob
        filesToRemove.forEach(pattern => {
            const files = glob.sync(path.join(appOutDir, pattern));
            files.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`Eliminado: ${file}`);
                }
            });
        });

        // Generar archivo de verificación
        const resourcesPath = path.join(appOutDir, 'Resources');
        const appPath = path.join(resourcesPath, 'app.asar');
        
        if (fs.existsSync(appPath)) {
            const hash = crypto.createHash('sha256');
            const fileBuffer = fs.readFileSync(appPath);
            hash.update(fileBuffer);
            const hashSum = hash.digest('hex');
            
            fs.writeFileSync(
                path.join(resourcesPath, '.integrity'),
                hashSum
            );
            console.log('Archivo de integridad generado');
        }

        console.log('Tareas post-empaquetado completadas con éxito.');
    } catch (error) {
        console.error('Error en tareas post-empaquetado:', error);
        throw error;
    }
}

module.exports = afterPack;