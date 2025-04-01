# 🔧 IKE Expedientes Automation - Guía del Desarrollador

## 📋 Descripción General

Aplicación de escritorio para automatizar la gestión y validación de expedientes con sistema de actualización automática integrado.

## 🚀 Instalación y Desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/Fechomap/expedientes-ike.git

# Entrar al directorio
cd expedientes-ike

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm start

# Iniciar en modo debug
npm run dev
```

## 🏗️ Proceso de Construcción

### Construir para distintas plataformas

```bash
# Construir para Windows
npm run build:win

# Construir para macOS
npm run build:mac

# Construir para Linux
npm run build:linux

# Construir para todas las plataformas
npm run build
```

Los archivos construidos se almacenarán en el directorio `dist/`.

## 📦 Sistema de Actualizaciones

### Conceptos generales

- La aplicación usa **electron-updater** para manejar actualizaciones automáticas
- Los archivos de actualización se almacenan en un bucket S3 (`ike-expedientes-updates`)
- El versionado sigue el formato semántico (X.Y.Z)

### Requisitos para publicar actualizaciones

1. **Credenciales AWS configuradas**
   ```bash
   # Verificar si las credenciales están configuradas
   aws configure list

   # Configurar credenciales si es necesario
   aws configure
   # Ingresar:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region: us-east-1
   # - Default output format: json
   ```

2. **Permisos adecuados para el bucket S3**
   - Necesitas permisos para acceder y modificar el bucket `ike-expedientes-updates`
   - Los permisos IAM mínimos requeridos son: 
     - `s3:PutObject`
     - `s3:GetObject`
     - `s3:ListBucket`
     - `s3:PutBucketPolicy` (para configurar acceso público)

### Publicar una nueva versión

#### Método 1: Script automatizado

```bash
# Este script te guiará a través del proceso y hará todo automáticamente
npm run release
```

#### Método 2: Proceso manual

```bash
# 1. Incrementar versión (elige una opción)
npm version patch  # Para incrementos menores (1.0.0 -> 1.0.1)
npm version minor  # Para nuevas características (1.0.0 -> 1.1.0)
npm version major  # Para cambios importantes (1.0.0 -> 2.0.0)

# 2. Construir y publicar (elige según plataforma)
# Para Windows
npm run publish:win

# Para macOS
npm run publish:mac

# Para todas las plataformas
npm run publish
```

### Verificar Publicación de Actualizaciones

Para confirmar que las actualizaciones se han publicado correctamente:

1. **Verificar archivos en S3**
   ```bash
   # Listar archivos en el bucket
   aws s3 ls s3://ike-expedientes-updates/
   ```

2. **Verificar acceso público a los archivos**
   - Navegador: visita las URLs directamente para comprobar acceso
   ```
   https://ike-expedientes-updates.s3.amazonaws.com/latest.yml
   https://ike-expedientes-updates.s3.amazonaws.com/latest-mac.yml
   https://ike-expedientes-updates.s3.amazonaws.com/IKE-Expedientes-Automation-Setup-[VERSION].exe
   https://ike-expedientes-updates.s3.amazonaws.com/IKE-Expedientes-Automation-[VERSION].dmg
   ```

3. **Ejecutar prueba de actualización**
   - Instala una versión anterior de la aplicación
   - Ejecuta la aplicación y ve a la pantalla principal
   - Haz clic en "Buscar Actualizaciones"
   - Confirma que se detecta y descarga la actualización

### Distribución Manual de Actualizaciones

Para enviar enlaces directos a los usuarios (necesario para actualizar desde versiones sin auto-actualización):

```
# Enlaces directos a los instaladores
https://ike-expedientes-updates.s3.amazonaws.com/IKE-Expedientes-Automation-Setup-[VERSION].exe
https://ike-expedientes-updates.s3.amazonaws.com/IKE-Expedientes-Automation-[VERSION].dmg
```

Reemplaza `[VERSION]` con el número de versión actual (p.ej., `1.0.4`).

### Solución de problemas de actualización

#### Problema: Error "AccessDenied" al acceder a los archivos

**Solución 1**: Configurar política de bucket correctamente
```bash
aws s3api put-bucket-policy --bucket ike-expedientes-updates --policy '{
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
}'
```

**Solución 2**: Hacer públicos archivos individuales
```bash
aws s3 cp s3://ike-expedientes-updates/ARCHIVO.ext s3://ike-expedientes-updates/ARCHIVO.ext --acl public-read
```

#### Problema: Las actualizaciones no son detectadas

1. Verificar que la nueva versión sea mayor que la versión actual
2. Comprobar los logs de la aplicación:
   - Windows: `%USERPROFILE%\AppData\Roaming\ike-expedientes-automation\logs`
   - macOS: `~/Library/Logs/ike-expedientes-automation`
3. Verificar que los archivos YAML están correctamente formateados
4. Asegurarse de que los instaladores son accesibles públicamente

## 🔑 Manejo de Licencias

### Verificar token almacenado

```javascript
// El token se almacena usando electron-store
// Se puede verificar el almacenamiento en:
// Windows: %APPDATA%\ike-expedientes-automation\license.json
// macOS: ~/Library/Application Support/ike-expedientes-automation/license.json
```

### Endpoint de API para validación

```
BASE_URL: 'https://ike-license-manager-9b796c40a448.herokuapp.com'
VALIDATE_TOKEN: '/api/validate'
CHECK_VALIDITY: '/api/check-validity'
```

## 📁 Estructura del Proyecto

```
expedientes-ike/
├── build/              # Recursos para la construcción
├── dist/               # Archivos generados por electron-builder
├── scripts/            # Scripts auxiliares
│   ├── publish-updates.js        # Script de publicación
│   └── version-bump.js           # Script para incrementar versión
├── src/
│   ├── config/         # Configuración
│   │   └── constants.js          # Constantes y endpoints
│   ├── utils/          # Utilidades
│   │   ├── browserHandler.js     # Manejo del navegador
│   │   ├── configHandler.js      # Manejo de configuración
│   │   ├── licenseHandler.js     # Manejo de licencias
│   │   └── readExcel.js          # Lectura de archivos Excel
│   ├── ui/             # Archivos de interfaz
│   ├── index.js        # Punto de entrada de lógica de negocio
│   ├── main.js         # Punto de entrada de Electron
│   └── preload.js      # Script de preload para IPC
├── package.json        # Dependencias y scripts
└── electron-builder.yml # Configuración de electron-builder
```

## 🧪 Pruebas

### Probar actualizaciones

```bash
# Verificar configuración de actualizaciones
node test-updater.js
```

## ⚠️ Notas Importantes

1. Las versiones antiguas sin el código de auto-actualización requerirán una actualización manual a la nueva versión con auto-actualización.

2. Siempre incrementa la versión en `package.json` antes de publicar una actualización.

3. Después de publicar, verifica siempre que los archivos sean públicamente accesibles.