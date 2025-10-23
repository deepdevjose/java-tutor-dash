/**
 * @file signup.js
 * Lógica encapsulada para el formulario de registro (signup.html).
 * Se inicializa al cargar el DOM.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SELECCIÓN DE ELEMENTOS ---
    const registerForm = document.getElementById('registerForm');
    
    // Guarda Temprana: Si el formulario no existe, detenemos el script.
    if (!registerForm) {
        return;
    }

    // Almacenamos referencias a los elementos que usaremos
    const emailInput = document.getElementById('email');
    const githubInput = document.getElementById('githubUsername');
    const matriculaInput = document.getElementById('matricula');
    const grupoInput = document.getElementById('grupo'); 
    const togglePwdBtns = document.querySelectorAll('.toggle-password');
    const allFormInputs = Array.from(registerForm.querySelectorAll('input, select'));
    const submitBtn = registerForm.querySelector('.submit-btn');

    // Variable para almacenar el temporizador del 'debounce' de GitHub
    let githubTimeout; 

    
    // --- 2. LÓGICA DE NEGOCIO Y EVENTOS ---

    /**
     * Handler (manejador) principal para el envío del formulario de registro.
     * @param {Event} e - El objeto de evento 'submit'
     */
    const handleRegisterSubmit = async (e) => {
        e.preventDefault(); // Prevenir recarga de página
        setLoading(true);

        // Recolectar datos de todos los campos del formulario
        const formData = {
            firstName: document.getElementById('firstName').value.trim(),
            middleName: document.getElementById('middleName').value.trim(),
            apellidoPaterno: document.getElementById('apellidoPaterno').value.trim(),
            apellidoMaterno: document.getElementById('apellidoMaterno').value.trim(),
            matricula: matriculaInput.value.trim(),
            grupo: grupoInput.value.trim(),
            semestre: document.getElementById('semestre').value,
            email: emailInput.value.trim(),
            githubUsername: githubInput.value.trim(),
            password: document.getElementById('password').value
        };

        // --- Validaciones del lado del cliente ---
        if (!validateEmail(formData.email)) {
            showMessage('error', 'Por favor, usa una dirección de Gmail válida (@gmail.com)');
            setLoading(false);
            return; // Detener ejecución
        }

        if (formData.password.length < 6) {
            showMessage('error', 'La contraseña debe tener al menos 6 caracteres');
            setLoading(false);
            return;
        }

        if (formData.matricula.length === 0) {
            showMessage('error', 'Por favor, ingresa tu matrícula');
            setLoading(false);
            return;
        }
        
        if (formData.grupo.length === 0) {
            showMessage('error', 'Por favor, ingresa tu grupo (A, B, C, etc.)');
            setLoading(false);
            return;
        }

        // Re-validar GitHub en el momento del submit, por si el usuario lo cambió
        const isGitHubValid = await validateGitHub(formData.githubUsername);
        if (!isGitHubValid) {
            showMessage('error', 'Usuario de GitHub no válido. Por favor, verifícalo.');
            setLoading(false);
            return;
        }

        // 
        // --- [INICIO] SIMULACIÓN DE API (Reemplazar con Firebase) ---
        //
        console.log('Datos de registro:', formData);
        
        try {
            // Pausar 1.5s para simular la llamada de red
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            showMessage('success', '¡Cuenta creada! Redirigiendo al dashboard...');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html'; 
            }, 2000);

        } catch (error) {
            console.error('Error en simulación de registro:', error);
            showMessage('error', 'No se pudo crear la cuenta. Intenta de nuevo.');
            setLoading(false);
        }
        //
        // --- [FIN] SIMULACIÓN DE API ---
        //
        
        /* // --- [INICIO] INTEGRACIÓN REAL DE FIREBASE ---
        try {
            // 1. Crear el usuario en Firebase Auth
            // const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            // const user = userCredential.user;

            // 2. Guardar los datos extra en Firestore
            // Es CRUCIAL eliminar la contraseña antes de guardarla en la base de datos
            // delete formData.password; 
            // await setDoc(doc(db, "usuarios", user.uid), formData);

            showMessage('success', '¡Cuenta creada! Redirigiendo al dashboard...');
            setTimeout(() => window.location.href = 'dashborad.html', 2000);

        } catch (error) {
            console.error("Error en Sign Up:", error.code);
            let message = 'No se pudo crear la cuenta.';
            if (error.code === 'auth/email-already-in-use') {
                message = 'Este correo electrónico ya está en uso.';
            } else if (error.code === 'auth/weak-password') {
                message = 'La contraseña es muy débil.';
            }
            showMessage('error', message);
            setLoading(false);
        }
        // --- [FIN] INTEGRACIÓN REAL DE FIREBASE ---
        */
    };

    /**
     * Controla el estado visual y funcional del botón de submit.
     * @param {boolean} isLoading - Verdadero para mostrar 'cargando', falso para estado normal.
     */
    const setLoading = (isLoading) => {
        if (!submitBtn) return;
        
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');
            if (!submitBtn.dataset.originalText) {
                submitBtn.dataset.originalText = submitBtn.textContent;
            }
            submitBtn.textContent = '';
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = submitBtn.dataset.originalText || 'Registrarse';
        }
    };

    /**
     * Filtra el input de grupo para que solo acepte una letra A-Z.
     * Se ejecuta en CADA pulsación de tecla ('input').
     */
    const handleGrupoInput = () => {
        let value = grupoInput.value;
        // 1. Convertir a mayúsculas y quitar cualquier cosa que NO sea A-Z
        //    Regex [^A-Z] significa "cualquier caracter que NO esté en el rango A-Z"
        value = value.toUpperCase().replace(/[^A-Z]/g, '');
        // 2. Limitar a un solo carácter
        if (value.length > 1) {
            value = value.charAt(0); // Tomar solo el primer carácter
        }
        // 3. Reasignar el valor limpio al input
        grupoInput.value = value;
    };

    /**
     * Filtra el input de matrícula para que solo acepte dígitos (0-9).
     * Se ejecuta en CADA pulsación de tecla ('input').
     */
    const handleMatriculaInput = () => {
        // Regex [^0-9] significa "cualquier caracter que NO sea un dígito"
        matriculaInput.value = matriculaInput.value.replace(/[^0-9]/g, '');
    };

    /**
     * Valida el email cuando el usuario sale del campo ('blur').
     */
    const handleEmailBlur = () => {
        const email = emailInput.value.trim();
        // Solo validar si hay algo escrito
        if (email && !validateEmail(email)) {
            showError('emailError', 'Solo se permiten direcciones @gmail.com');
            emailInput.style.borderColor = '#ef4444'; // Borde rojo
        } else {
            clearError('emailError');
            emailInput.style.borderColor = '#333'; // Borde normal
        }
    };

    /**
     * Valida el usuario de GitHub en tiempo real, usando 'debounce'.
     * 'Debounce' evita hacer una llamada a la API en cada tecla, 
     * esperando a que el usuario deje de escribir por 800ms.
     */
    const handleGitHubInput = () => {
        // 1. Limpiar el temporizador anterior
        clearTimeout(githubTimeout);
        const username = githubInput.value.trim();
        
        if (username.length > 2) {
            githubInput.style.borderColor = '#666'; // Feedback visual: "cargando"
            
            // 2. Crear un nuevo temporizador
            githubTimeout = setTimeout(async () => {
                // 3. Esta función solo se ejecuta 800ms después de la última tecla
                const isValid = await validateGitHub(username);
                if (!isValid) {
                    showError('githubError', 'Usuario de GitHub no encontrado');
                    githubInput.style.borderColor = '#ef4444'; // Borde rojo
                } else {
                    clearError('githubError');
                    githubInput.style.borderColor = '#22c55e'; // Borde verde
                }
            }, 800); 
        } else {
            // Si el nombre es muy corto, limpiar el estado
            clearError('githubError');
            githubInput.style.borderColor = '#333';
        }
    };

    /**
     * Alterna la visibilidad de la contraseña (texto/password).
     * @param {Event} e - El evento de click del botón-ojo
     */
    const togglePasswordVisibility = (e) => {
        const btn = e.currentTarget;
        const input = btn.closest('.password-input')?.querySelector('input');
        if (!input) return;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        btn.style.color = type === 'text' ? '#a855f7' : '#666';
    };


    // --- 3. ASIGNACIÓN DE EVENT LISTENERS ---
    
    registerForm.addEventListener('submit', handleRegisterSubmit);
    
    // Validaciones en tiempo real
    emailInput.addEventListener('blur', handleEmailBlur);
    githubInput.addEventListener('input', handleGitHubInput);
    if (matriculaInput) {
        matriculaInput.addEventListener('input', handleMatriculaInput);
    }
    if (grupoInput) {
        grupoInput.addEventListener('input', handleGrupoInput);
    }

    // Toggle de contraseña
    togglePwdBtns.forEach(btn => {
        btn.addEventListener('click', togglePasswordVisibility);
    });

    // Animaciones de focus/blur (del script original)
    allFormInputs.forEach(input => {
        const parent = input.closest('.form-group');
        if (!parent) return;
        input.addEventListener('focus', () => {
            parent.style.transform = 'translateY(-2px)';
            parent.style.transition = 'transform 0.2s ease';
        });
        input.addEventListener('blur', () => {
            parent.style.transform = 'translateY(0)';
        });
    });

    // Navegación con 'Enter' (del script original)
    allFormInputs.forEach((input, index) => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (index < allFormInputs.length - 1) {
                    allFormInputs[index + 1].focus(); // Siguiente input
                } else {
                    submitBtn.click(); // Submit en el último input
                }
            }
        });
    });

}); // Fin de 'DOMContentLoaded'


// --- 4. FUNCIONES DE UTILIDAD (Puras) ---

/**
 * Valida si un string es un correo de @gmail.com.
 * @param {string} email - El correo a validar
 * @returns {boolean} - True si es un email de Gmail válido
 */
function validateEmail(email) {
    const gmailRegex = /^[a-zA-Z0-9.+_-]+@gmail\.com$/;
    return gmailRegex.test(String(email).toLowerCase());
}

/**
 * Valida si un usuario de GitHub existe haciendo una llamada a su API.
 * @param {string} username - El nombre de usuario a verificar
 * @returns {Promise<boolean>} - True si el usuario existe (HTTP 200)
 */
async function validateGitHub(username) {
    if (!username || username.length < 1) return false;
    try {
        // 'fetch' hace una llamada de red a la API de GitHub
        const response = await fetch(`https://api.github.com/users/${username}`);
        // 'response.ok' es true si el código de estado es 200-299
        // (Si el usuario no existe, la API devuelve 404 y .ok será false)
        return response.ok; 
    } catch (error) {
        // Capturar errores de red (ej. sin internet)
        console.error('Error validando GitHub:', error);
        return false;
    }
}

/**
 * Muestra un mensaje de error debajo de un campo de formulario específico.
 * @param {string} elementId - El ID del elemento <span> de error
 * @param {string} message - El mensaje a mostrar
 */
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/**
 * Limpia un mensaje de error específico.
 * @param {string} elementId - El ID del elemento <span> de error
 */
function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

/**
 * Muestra una alerta global en el formulario (éxito o error).
 * @param {'success' | 'error'} type - El tipo de alerta (para clase CSS)
 * @param {string} message - El mensaje a mostrar
 */
function showMessage(type, message) {
    const activeForm = document.getElementById('registerForm');
    if (!activeForm) return;

    // Remover alertas existentes
    const existingMessage = activeForm.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Crear nueva alerta
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} show`;
    messageDiv.setAttribute('role', 'alert');
    messageDiv.textContent = message;
    
    // Insertar al inicio del formulario
    activeForm.prepend(messageDiv);

    // Auto-ocultar después de 5s
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => messageDiv.remove(), 500);
    }, 5000);
}