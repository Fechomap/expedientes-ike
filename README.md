# 🔧 IKE Expedientes Automation

Una aplicación de escritorio para automatizar la gestión y validación de expedientes.

## ⚡️ Requisitos Previos

- 📦 Node.js (v16 o superior)
- 📦 npm (incluido con Node.js)
- 🌐 Navegador Chrome/Chromium instalado

## 🚀 Instalación

1. **Clonar el repositorio:**
```bash
git clone https://github.com/tu-usuario/ike-expedientes-automation.git
```

2. **Navegar al directorio:**
```bash
cd ike-expedientes-automation
```

3. **Instalar dependencias:**
```bash
npm install
```

4. **Iniciar la aplicación:**
```bash
npm start
```

## ⚙️ Comandos Disponibles

```bash
# Iniciar en modo desarrollo
npm start

# Empaquetar para diferentes plataformas
npm run build:mac     # Para macOS
npm run build:win     # Para Windows
npm run build:linux   # Para Linux

# Reinstalar dependencias
rm -rf node_modules
npm install
```

## 📁 Estructura del Proyecto

```
ike-expedientes-automation/
├── src/
│   ├── config/
│   │   └── constants.js
│   ├── utils/
│   │   ├── browserHandler.js
│   │   ├── configHandler.js
│   │   ├── licenseHandler.js
│   │   └── readExcel.js
│   ├── ui/
│   │   ├── assets/
│   │   ├── config.html
│   │   ├── index.html
│   │   ├── license.html
│   │   └── loading.html
│   ├── index.js
│   ├── main.js
│   └── preload.js
└── package.json
```

## 🔒 Solución de Problemas

### macOS
Si la aplicación no abre por restricciones de seguridad:
```bash
sudo xattr -cr /Applications/ike-expedientes-automation.app
```

### Windows
Asegúrate de tener Chrome o Edge instalado en las rutas predeterminadas.

## 🛠️ Características Principales

- Validación de tokens de licencia
- Procesamiento automatizado de expedientes
- Interfaz gráfica intuitiva
- Generación de reportes
- Sistema de licencias integrado
- Soporte multiplataforma

## 👥 Contribución

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commitea tus cambios (`git commit -m 'Añade nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📜 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo `LICENSE` para más detalles.

## 🔗 API Endpoints

- Base URL: `https://ike-license-manager-9b796c40a448.herokuapp.com`
- Validación de token: `/api/validate`
- Verificación de token: `/api/check-token`

## 📞 Soporte

Para soporte y preguntas, por favor abre un issue en el repositorio o contacta al equipo de desarrollo.