// ui/assets/js/license-ui.js
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando interfaz de licencia...');
    const tokenInput = document.getElementById('tokenInput');
    const validateButton = document.getElementById('validateToken');
    const tokenError = document.getElementById('tokenError');
    const tokenSuccess = document.getElementById('tokenSuccess');
    const validationLoader = document.getElementById('validationLoader');
    const licenseStatus = document.getElementById('licenseStatus');

    // Limpiar mensajes
    const clearMessages = () => {
        if (tokenError) tokenError.textContent = '';
        if (tokenSuccess) tokenSuccess.textContent = '';
    };

    // Mostrar loader
    const showLoader = () => {
        if (validationLoader) validationLoader.style.display = 'inline-block';
        if (validateButton) validateButton.disabled = true;
    };

    // Ocultar loader
    const hideLoader = () => {
        if (validationLoader) validationLoader.style.display = 'none';
        if (validateButton) validateButton.disabled = false;
    };

    // Actualizar estado de licencia
    const updateLicenseStatus = (status) => {
        if (licenseStatus) {
            if (status.valid) {
                const expirationDate = new Date(status.expiresAt);
                const formattedDate = expirationDate.toLocaleDateString();
                licenseStatus.innerHTML = `
                    <div style="background-color: #d4edda; color: #155724; padding: 10px; border-radius: 4px;">
                        <p><strong>Estado:</strong> Activa</p>
                        <p><strong>Vence:</strong> ${formattedDate}</p>
                    </div>
                `;
            } else {
                licenseStatus.innerHTML = `
                    <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px;">
                        <p><strong>Estado:</strong> Inactiva</p>
                        <p><strong>Mensaje:</strong> ${status.message}</p>
                    </div>
                `;
            }
        }
    };

    // Inicialización: verificar si ya hay un token válido
    const checkExistingToken = async () => {
        try {
            if (licenseStatus) {
                licenseStatus.innerHTML = '<p>Verificando estado de licencia...</p>';
            }
            
            // Aquí podríamos hacer una llamada para verificar el token existente
            // Por ahora, simplemente mostramos el estado de verificación
            
            licenseStatus.innerHTML = '<p>Ingrese un token para activar la licencia</p>';
        } catch (error) {
            console.error('Error al verificar token existente:', error);
            if (licenseStatus) {
                licenseStatus.innerHTML = '<p>Error al verificar estado de licencia</p>';
            }
        }
    };

    // Ejecutar verificación inicial
    checkExistingToken();

    // Evento click en el botón de validación
    if (validateButton) {
        validateButton.addEventListener('click', async () => {
            clearMessages();
            const token = tokenInput.value.trim();

            if (!token) {
                tokenError.textContent = 'Por favor, ingrese un token válido';
                return;
            }

            showLoader();

            try {
                const result = await window.electronAPI.verifyToken(token);
                console.log('Resultado de validación:', result);

                if (result.valid) {
                    tokenSuccess.textContent = 'Token validado correctamente';
                    updateLicenseStatus(result);
                    
                    // Redirección después de un breve delay
                    setTimeout(() => {
                        window.electronAPI.reloadApp();
                    }, 1500);
                } else {
                    tokenError.textContent = result.message || 'Error al validar el token';
                    updateLicenseStatus(result);
                }
            } catch (error) {
                console.error('Error:', error);
                tokenError.textContent = 'Error al validar el token. Inténtelo nuevamente.';
            } finally {
                hideLoader();
            }
        });
    }

    // Validación en tiempo real del input
    if (tokenInput) {
        tokenInput.addEventListener('input', () => {
            clearMessages();
            if (validateButton) {
                validateButton.disabled = !tokenInput.value.trim();
            }
        });
        
        // Permitir validación al presionar Enter
        tokenInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && tokenInput.value.trim() && validateButton && !validateButton.disabled) {
                validateButton.click();
            }
        });
    }
});