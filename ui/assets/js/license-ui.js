// ui/assets/js/license-ui.js

// renderer.js o el archivo correspondiente en la interfaz de usuario
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando interfaz de licencia...'); // Log inicio
    const tokenInput = document.getElementById('tokenInput');
    const validateButton = document.getElementById('validateToken');
    const tokenError = document.getElementById('tokenError');
    const tokenSuccess = document.getElementById('tokenSuccess');
    const validationLoader = document.getElementById('validationLoader');

    // Limpiar mensajes de error/éxito
    const clearMessages = () => {
        console.log('Limpiando mensajes de validación'); // Log limpieza
        if (tokenError) tokenError.textContent = '';
        if (tokenSuccess) tokenSuccess.textContent = '';
    };

    // Mostrar loader
    const showLoader = () => {
        console.log('Mostrando loader de validación'); // Log loader
        if (validationLoader) validationLoader.style.display = 'inline-block';
        if (validateButton) validateButton.disabled = true;
    };

    // Ocultar loader
    const hideLoader = () => {
        console.log('Ocultando loader de validación'); // Log loader
        if (validationLoader) validationLoader.style.display = 'none';
        if (validateButton) validateButton.disabled = false;
    };

    if (validateButton) {
        validateButton.addEventListener('click', async () => {
            console.log('Iniciando validación de token'); // Log validación
            clearMessages();
            const token = tokenInput.value.trim();

            if (!token) {
                console.log('Error: Token vacío'); // Log error
                tokenError.textContent = 'Por favor, ingrese un token válido';
                return;
            }

            showLoader();

            try {
                const result = await window.electronAPI.verifyToken(token);
                console.log(`Resultado de validación: ${JSON.stringify(result)}`); // Log resultado
                console.log('Resultado de validación:', result);

                if (result.valid) {
                    tokenSuccess.textContent = 'Token validado correctamente';
                    setTimeout(() => {
                        window.electronAPI.reloadApp();
                    }, 1500);
                } else {
                    tokenError.textContent = result.message || 'Error al validar el token';
                }
            } catch (error) {
                console.log(`Error en validación: ${error.message}`); // Log error
                console.error('Error:', error);
                tokenError.textContent = 'Error al validar el token';
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
    }
});