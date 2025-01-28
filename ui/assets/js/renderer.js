// ui/assets/js/renderer.js

document.addEventListener('DOMContentLoaded', () => {
    const selectExcelBtn = document.getElementById('selectExcel');
    const startProcessBtn = document.getElementById('startProcess');
    const selectedFileSpan = document.getElementById('selectedFile');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const progressBar = document.getElementById('progress'); // la barra

    let selectedFilePath = null;

    startProcessBtn.disabled = true;

    // Asegurar que la barra de progreso esté oculta al inicio
    progressBar.style.display = 'none';
    progressBar.style.width = '0%';

    // Log inicialización
    console.log('Inicializando interfaz principal...');  

    selectExcelBtn.addEventListener('click', async () => {
        try {
            console.log('Iniciando selección de archivo Excel...');  
            const result = await window.electronAPI.selectFile();
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
                statusDiv.textContent = response.message;
                console.log('Procesamiento completado con éxito');  
            } else {
                statusDiv.textContent = `Error: ${response.message}`;
                console.log(`Error en procesamiento: ${response.message}`);  
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