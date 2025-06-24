// ui/assets/js/renderer.js

document.addEventListener('DOMContentLoaded', () => {
    const selectExcelBtn = document.getElementById('selectExcel');
    const startProcessBtn = document.getElementById('startProcess');
    const selectedFileSpan = document.getElementById('selectedFile');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const progressBar = document.getElementById('progress'); // la barra
    const checkUpdatesBtn = document.getElementById('checkUpdates');
    const configCredentialsBtn = document.getElementById('configCredentials');
    const versionInfoSpan = document.getElementById('versionInfo');

    let selectedFilePath = null;

    startProcessBtn.disabled = true;

    // Asegurar que la barra de progreso esté oculta al inicio
    progressBar.style.display = 'none';
    progressBar.style.width = '0%';

    // Obtener y mostrar la versión de la aplicación
    async function displayAppVersion() {
        try {
            const version = await window.electronAPI.getAppVersion();
            versionInfoSpan.textContent = `v${version}`;
        } catch (error) {
            console.error('Error al obtener versión:', error);
        }
    }

    // Mostrar la versión al cargar
    displayAppVersion();

    // Log inicialización
    console.log('Inicializando interfaz principal...');  

    // Funcionalidad de actualizaciones
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', async () => {
            try {
                statusDiv.textContent = 'Verificando actualizaciones...';
                const result = await window.electronAPI.checkForUpdates();
                console.log('Resultado de verificación de actualizaciones:', result);
            } catch (error) {
                console.error('Error al verificar actualizaciones:', error);
                statusDiv.textContent = `Error al verificar actualizaciones: ${error.message}`;
            }
        });
    }

    // Eventos de actualización
    window.electronAPI.onUpdateAvailable((info) => {
        console.log('Actualización disponible:', info);
        // Esta notificación se maneja en el proceso principal
    });

    window.electronAPI.onUpdateProgress((progressObj) => {
        statusDiv.textContent = `Descargando actualización: ${Math.round(progressObj.percent)}%`;
    });

    window.electronAPI.onUpdateDownloaded((info) => {
        console.log('Actualización descargada:', info);
        // Esta notificación se maneja en el proceso principal
    });

    // Configurar credenciales
    if (configCredentialsBtn) {
        configCredentialsBtn.addEventListener('click', async () => {
            try {
                console.log('Abriendo ventana de configuración de credenciales...');
                const result = await window.electronAPI.app.openConfigWindow();
                if (result.success) {
                    statusDiv.textContent = 'Ventana de configuración abierta. Configure sus credenciales.';
                } else {
                    console.error('Error abriendo ventana de configuración:', result.error);
                    statusDiv.textContent = 'Error al abrir la configuración';
                }
            } catch (error) {
                console.error('Error al abrir configuración:', error);
                statusDiv.textContent = 'Error al abrir la configuración';
            }
        });
    }

    selectExcelBtn.addEventListener('click', async () => {
        try {
            console.log('Botón SELECCIONAR EXCEL clickeado');
            console.log('electronAPI disponible:', !!window.electronAPI);
            console.log('selectFile disponible:', typeof window.electronAPI?.selectFile);
            console.log('Iniciando selección de archivo Excel...');  
            const result = await window.electronAPI.selectFile();
            console.log('Resultado de selectFile:', result);
            if (result.success) {
                selectedFilePath = result.filePath;
                selectedFileSpan.textContent = selectedFilePath;
                startProcessBtn.disabled = false;
                statusDiv.textContent = 'Archivo seleccionado. Listo para iniciar.';
                console.log(`Archivo seleccionado exitosamente: ${selectedFilePath}`);  
            } else {
                statusDiv.textContent = 'No se seleccionó ningún archivo.';
                console.log('No se seleccionó ningún archivo');  
            }
        } catch (error) {
            console.error('Error al seleccionar archivo:', error);
            statusDiv.textContent = 'Error al seleccionar archivo';
            console.log(`Error al seleccionar archivo: ${error.message}`);  
        }
    });

    startProcessBtn.addEventListener('click', async () => {
        if (!selectedFilePath) return;

        try {
            console.log('Iniciando procesamiento de archivo...');  
            startProcessBtn.disabled = true;
            selectExcelBtn.disabled = true;
            statusDiv.textContent = 'Procesando...';
            resultsDiv.innerHTML = '';
            progressBar.style.width = '0%';
            progressBar.style.display = 'block'; // Mostrar la barra de progreso

            const response = await window.electronAPI.startProcess(selectedFilePath);
            
            if (response.success) {
                statusDiv.textContent = response.message || 'Procesamiento completado con éxito';
                console.log('Procesamiento completado con éxito');  
            } else {
                // Check if the error is due to missing credentials or login failure
                if (response.code === 'CREDENTIALS_NOT_CONFIGURED' || response.code === 'LOGIN_FAILED') {
                    statusDiv.textContent = response.code === 'CREDENTIALS_NOT_CONFIGURED' 
                        ? 'Credenciales no configuradas' 
                        : 'Error de login - Credenciales incorrectas';
                    
                    // Show button to open configuration
                    const configButton = document.createElement('button');
                    configButton.textContent = 'Configurar Credenciales';
                    configButton.style.marginTop = '10px';
                    configButton.style.backgroundColor = '#dc3545';
                    configButton.style.color = 'white';
                    configButton.style.border = 'none';
                    configButton.style.padding = '10px 20px';
                    configButton.style.borderRadius = '4px';
                    configButton.style.cursor = 'pointer';
                    configButton.onclick = async () => {
                        try {
                            const result = await window.electronAPI.app.openConfigWindow();
                            if (result.success) {
                                statusDiv.textContent = 'Ventana de configuración abierta. Configure sus credenciales.';
                                resultsDiv.innerHTML = '';
                            }
                        } catch (err) {
                            console.error('Error opening config window:', err);
                        }
                    };
                    
                    resultsDiv.innerHTML = '';
                    resultsDiv.appendChild(configButton);
                } else {
                    statusDiv.textContent = `Error: ${response.error || response.message || 'Error desconocido'}`;
                }
                console.log(`Error en procesamiento: ${response.error || response.message}`);  
            }
        } catch (error) {
            console.error('Error:', error);
            statusDiv.textContent = 'Error en el proceso';
            resultsDiv.innerHTML = `<p>❌ Error: ${error.message}</p>`;
            console.log(`Error durante el procesamiento: ${error.message}`);  
        } finally {
            // Rehabilitar botones al terminar
            startProcessBtn.disabled = false;
            selectExcelBtn.disabled = false;
            progressBar.style.display = 'none';
            progressBar.style.width = '0%'; // Resetear la barra de progreso
        }
    });

    // Escuchar las actualizaciones de progreso
    window.electronAPI.onProgress((data) => {
        // Actualizar barra solo si viene progress
        if (typeof data.progress === 'number') {
          progressBar.style.width = `${data.progress}%`;
          progressBar.textContent = `${data.progress}%`; // Opcional: mostrar porcentaje
        }
        
        // Resto del código igual...
        statusDiv.textContent = data.message;
        
        if (data.detail) {
          resultsDiv.innerHTML += `<p>✓ ${data.detail}</p>`;
        }

        // Si trae la señal de que terminó
        if (data.final) {
            // Asegurar que la barra de progreso esté completa
            if (typeof data.progress === 'number') {
                progressBar.style.width = '100%';
            }

            // Crear una ventana modal personalizada
            const modalContent = `
                <div class="modal-overlay">
                    <div class="modal-container">
                        <div class="modal-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#4F46E5" stroke-width="2"/>
                                <path d="M8 12L11 15L16 9" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <h3>Resumen del Proceso</h3>
                        <div class="modal-stats">
                            <div class="stat-item">
                                <span class="stat-label">Expedientes Revisados:</span>
                                <span class="stat-value">${data.stats?.totalRevisados || 0}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Expedientes con Costo:</span>
                                <span class="stat-value">${data.stats?.totalConCosto || 0}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Expedientes Aceptados:</span>
                                <span class="stat-value">${data.stats?.totalAceptados || 0}</span>
                            </div>
                        </div>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">OK</button>
                    </div>
                </div>`;

            // Insertar el modal en el DOM
            document.body.insertAdjacentHTML('beforeend', modalContent);
        }
    });
});