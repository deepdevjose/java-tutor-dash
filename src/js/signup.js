// Importar módulos de Firebase Auth y Firestore
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, setDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { isAdminEmail, DEFAULT_ADMIN_PERMISSIONS } from './admin-config.js';

/**
 * @file signup.js
 * Lógica encapsulada para el formulario de registro (signup.html).
 */

// --- UTILIDADES DE LOGGING (Entorno-aware) ---
/**
 * Detecta si la aplicación corre en entorno de desarrollo.
 * @returns {boolean} True si está en localhost o 127.0.0.1
 */
const isDevelopment = () => {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
};

/**
 * Log de depuración (solo en desarrollo).
 * @param {...any} args - Argumentos a loguear
 */
const logDebug = (...args) => {
    if (isDevelopment()) console.log(...args);
};

/**
 * Log de advertencia (solo en desarrollo).
 * @param {...any} args - Argumentos a loguear
 */
const logWarn = (...args) => {
    if (isDevelopment()) console.warn(...args);
};

/**
 * Log de error (solo en desarrollo, sin exponer detalles en producción).
 * @param {...any} args - Argumentos a loguear
 */
const logError = (...args) => {
    if (isDevelopment()) console.error(...args);
};

document.addEventListener('DOMContentLoaded', () => {

    // --- SELECCIÓN DE ELEMENTOS ---
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;

    const emailInput = document.getElementById('email');
    const githubInput = document.getElementById('githubUsername');
    const matriculaInput = document.getElementById('matricula');
    const grupoInput = document.getElementById('grupo');
    const togglePwdBtns = document.querySelectorAll('.toggle-password');
    const allFormInputs = Array.from(registerForm.querySelectorAll('input, select'));
    const submitBtn = registerForm.querySelector('.submit-btn');

    // --- ESTADO DE LA APLICACIÓN ---
    let githubTimeout;
    let githubAbortController = null;
    let isSubmitting = false;

    // --- LÓGICA DE NEGOCIO Y EVENTOS ---

    /**
     * Envía el formulario de registro, valida datos, crea usuario en Firebase Auth y Firestore, y gestiona redirección.
     * Implementa rollback si falla la escritura en Firestore.
     *
     * @param {Event} e - Evento submit del formulario.
     * @returns {Promise<void>}
     */
    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        
        // Prevenir doble envío
        if (isSubmitting) {
            logWarn('⚠️ Intento de doble submit bloqueado');
            return;
        }
        
        isSubmitting = true;
        setLoading(true);

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

        // --- Validaciones ---
        if (!validateEmail(formData.email)) {
            showMessage('error', 'Por favor, usa una dirección de Gmail (@gmail.com) o institucional de ITSOEH (@itsoeh.edu.mx)');
            setAccessibilityError(emailInput, 'emailError');
            resetSubmitState();
            return;
        }
        if (formData.password.length < 6) {
            showMessage('error', 'La contraseña debe tener al menos 6 caracteres');
            const passwordInput = document.getElementById('password');
            if (passwordInput) {
                setAccessibilityError(passwordInput, null);
                passwordInput.focus();
            }
            resetSubmitState();
            return;
        }
        if (formData.matricula.length === 0) {
            showMessage('error', 'Por favor, ingresa tu matrícula');
            setAccessibilityError(matriculaInput, null);
            resetSubmitState();
            return;
        }
        if (formData.grupo.length === 0) {
            showMessage('error', 'Por favor, ingresa tu grupo (A, B, C, etc.)');
            setAccessibilityError(grupoInput, null);
            resetSubmitState();
            return;
        }
        const isGitHubValid = await validateGitHub(formData.githubUsername);
        if (!isGitHubValid) {
            showMessage('error', 'Usuario de GitHub no válido. Por favor, verifícalo.');
            setAccessibilityError(githubInput, 'githubError');
            resetSubmitState();
            return;
        }

        // --- INTEGRACIÓN REAL DE FIREBASE CON ROLLBACK ---
        let userCredential = null;
        try {
            // 1. Crear usuario en Auth
            userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;
            logDebug('✅ Usuario creado en Auth:', user.uid);

            // 2. Enviar correo de verificación
            try {
                await sendEmailVerification(user);
                logDebug('✅ Correo de verificación enviado');
            } catch (verificationError) {
                logWarn("⚠️ Error al enviar correo de verificación:", verificationError.code);
            }

            // 3. Reservar githubUsername y matrícula con transacción atómica
            delete formData.password;
            try {
                await reserveUniqueIdentifiers(user.uid, formData.githubUsername, formData.matricula, formData);
                logDebug('✅ Datos guardados en Firestore con identificadores únicos');
            } catch (reservationError) {
                logError('❌ Error crítico al reservar identificadores, ejecutando rollback:', reservationError.message);
                
                // ROLLBACK: Borrar usuario de Auth si falla la reserva
                try {
                    await user.delete();
                    logDebug('✅ Rollback exitoso: usuario eliminado de Auth');
                } catch (deleteError) {
                    logError('❌ Fallo crítico en rollback:', deleteError.code);
                }
                
                // Propagar el error con mensaje específico
                throw reservationError;
            }

            // 4. Éxito y redirección a verificación
            const email = emailInput.value.trim();
            const isAdmin = isAdminEmail(email);
            
            if (isAdmin) {
                showMessage('success', '¡Cuenta de ADMINISTRADOR creada! Revisa tu correo para verificarla. Tendrás acceso al Panel de Admin.');
            } else {
                showMessage('success', '¡Cuenta creada! Revisa tu correo para verificarla.');
            }
            
            setTimeout(() => {
                window.location.href = 'verify-email.html';
            }, 3000);

        } catch (error) {
            // --- MANEJO DE ERRORES ---
            logError("❌ Error en Sign Up:", error.code || error.message);
            let message = 'No se pudo crear la cuenta.';

            // Errores de reserva de identificadores únicos
            if (error.message && error.message.includes('GitHub username ya está en uso')) {
                message = 'Este usuario de GitHub ya está registrado. Por favor, usa otro.';
                setAccessibilityError(githubInput, 'githubError');
            } else if (error.message && error.message.includes('Matrícula ya está en uso')) {
                message = 'Esta matrícula ya está registrada. Contacta a soporte si esto es un error.';
                setAccessibilityError(matriculaInput, null);
            } else {
                // Firebase Auth errors
                switch(error.code) {
                    case 'auth/email-already-in-use':
                        message = 'Este correo electrónico ya está en uso.';
                        setAccessibilityError(emailInput, 'emailError');
                        break;
                    case 'auth/weak-password':
                        message = 'La contraseña es muy débil (debe tener al menos 6 caracteres).';
                        break;
                    case 'auth/invalid-email':
                        message = 'El formato del correo electrónico no es válido.';
                        setAccessibilityError(emailInput, 'emailError');
                        break;
                    case 'auth/operation-not-allowed':
                        message = 'El registro está temporalmente deshabilitado.';
                        break;
                    case 'auth/network-request-failed':
                        message = 'Error de conexión. Verifica tu internet.';
                        break;
                    default:
                        // Error genérico o del rollback
                        if (error.message && !error.code) {
                            message = error.message;
                        }
                }
            }
            
            showMessage('error', message);
        } finally {
            resetSubmitState();
        }
    };

    /**
     * Resetea el estado de envío del formulario.
     */
    const resetSubmitState = () => {
        isSubmitting = false;
        setLoading(false);
    };

    /**
     * Controla el estado visual y funcional del botón de submit.
     *
     * @param {boolean} isLoading - Si está cargando o no.
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
     * Filtra el input de grupo (solo una letra mayúscula A-Z).
     */
    const handleGrupoInput = () => {
        let value = grupoInput.value;
        value = value.toUpperCase().replace(/[^A-Z]/g, '');
        if (value.length > 1) value = value.charAt(0);
        grupoInput.value = value;
    };

    /**
     * Filtra el input de matrícula (solo números).
     */
    const handleMatriculaInput = () => {
        matriculaInput.value = matriculaInput.value.replace(/[^0-9]/g, '');
    };

    /**
     * Valida el email en tiempo real al perder el foco.
     */
    const handleEmailBlur = () => {
        const email = emailInput.value.trim();
        if (email && !validateEmail(email)) {
            showError('emailError', 'Solo se permiten direcciones @gmail.com o @itsoeh.edu.mx');
            setAccessibilityError(emailInput, 'emailError');
            emailInput.style.borderColor = '#ef4444';
        } else {
            clearError('emailError');
            clearAccessibilityError(emailInput);
            emailInput.style.borderColor = '#333';
        }
    };

    /**
     * Valida el usuario de GitHub en tiempo real (con debounce y AbortController).
     * Cancela requests anteriores para evitar condiciones de carrera.
     */
    const handleGitHubInput = () => {
        // Cancelar request anterior si existe
        if (githubAbortController) {
            githubAbortController.abort();
            logDebug('🚫 Request anterior de GitHub cancelado');
        }
        
        clearTimeout(githubTimeout);
        const username = githubInput.value.trim();
        
        // Limpiar estilos y errores si el campo está vacío
        if (username.length === 0) {
            clearError('githubError');
            clearAccessibilityError(githubInput);
            githubInput.style.borderColor = '#333';
            return;
        }
        
        // Solo validar si tiene al menos 3 caracteres
        if (username.length >= 3) {
            githubInput.style.borderColor = '#666';
            clearError('githubError');
            clearAccessibilityError(githubInput);
            
            // Esperar 1.5 segundos después de que el usuario deje de escribir
            githubTimeout = setTimeout(async () => {
                // Crear nuevo AbortController para este request
                githubAbortController = new AbortController();
                
                const isValid = await validateGitHub(username, githubAbortController.signal);
                
                // Solo actualizar UI si el request no fue abortado
                if (isValid !== null) {
                    if (!isValid) {
                        showError('githubError', 'Usuario de GitHub no encontrado');
                        setAccessibilityError(githubInput, 'githubError');
                        githubInput.style.borderColor = '#ef4444';
                    } else {
                        clearError('githubError');
                        clearAccessibilityError(githubInput);
                        githubInput.style.borderColor = '#22c55e';
                    }
                }
            }, 1500);
        } else {
            githubInput.style.borderColor = '#333';
            clearError('githubError');
            clearAccessibilityError(githubInput);
        }
    };

    /**
     * Alterna la visibilidad de la contraseña en el input correspondiente.
     *
     * @param {MouseEvent} e - Evento click del botón de toggle.
     */
    const togglePasswordVisibility = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const btn = e.currentTarget;
        const passwordInputContainer = btn.closest('.password-input');
        if (!passwordInputContainer) return;
        
        const input = passwordInputContainer.querySelector('input[type="password"], input[type="text"]');
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        // Icono de ojo abierto (ver contraseña)
        const eyeOpenIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        
        // Icono de ojo cerrado (ocultar contraseña)
        const eyeClosedIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        
        btn.innerHTML = isPassword ? eyeClosedIcon : eyeOpenIcon;
    };

    // --- 3. ASIGNACIÓN DE EVENT LISTENERS ---
    registerForm.addEventListener('submit', handleRegisterSubmit);
    emailInput.addEventListener('blur', handleEmailBlur);
    githubInput.addEventListener('input', handleGitHubInput);
    if (matriculaInput) matriculaInput.addEventListener('input', handleMatriculaInput);
    if (grupoInput) grupoInput.addEventListener('input', handleGrupoInput);
    togglePwdBtns.forEach(btn => btn.addEventListener('click', togglePasswordVisibility));
    allFormInputs.forEach(input => { /* focus/blur */ });
    allFormInputs.forEach((input, index) => { /* Enter key */ });

}); // Fin de 'DOMContentLoaded'


// --- 4. FUNCIONES DE UTILIDAD (Puras) ---
/**
 * Valida si un string es un correo electrónico de Gmail o institucional ITSOEH válido.
 *
 * @param {string} email - Email a validar.
 * @returns {boolean} True si el email es válido, false si no.
 */
function validateEmail(email) {
    const gmailRegex = /^[a-zA-Z0-9.+_-]+@gmail\.com$/;
    const itsoehRegex = /^[a-zA-Z0-9.+_-]+@itsoeh\.edu\.mx$/;
    const emailLowerCase = String(email).toLowerCase();
    return gmailRegex.test(emailLowerCase) || itsoehRegex.test(emailLowerCase);
}

/**
 * Valida si un usuario de GitHub existe usando la API pública de GitHub.
 * Implementa cancelación de requests con AbortController.
 *
 * @param {string} username - Username de GitHub a validar.
 * @param {AbortSignal} [signal] - Señal de AbortController para cancelar el request.
 * @returns {Promise<boolean|null>} True si el usuario existe, false si no, null si fue abortado.
 */
async function validateGitHub(username, signal = null) {
    if (!username || username.length < 3) return false;
    
    try {
        const fetchOptions = signal ? { signal } : {};
        const response = await fetch(`https://api.github.com/users/${username}`, fetchOptions);
        
        if (response.ok) {
            logDebug('✅ Usuario de GitHub válido:', username);
            return true;
        } else {
            logDebug('⚠️ Usuario de GitHub no encontrado:', username);
            return false;
        }
    } catch (error) {
        // Request fue abortado (no es un error real)
        if (error.name === 'AbortError') {
            logDebug('🚫 Request de GitHub abortado para:', username);
            return null;
        }
        
        logError('❌ Error validando GitHub:', error.message);
        return false;
    }
}

/**
 * Muestra un mensaje de error en el elemento especificado.
 *
 * @param {string} elementId - ID del elemento donde mostrar el error.
 * @param {string} message - Mensaje de error.
 */
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = message; el.style.display = 'block'; }
}

/**
 * Limpia el mensaje de error del elemento especificado.
 *
 * @param {string} elementId - ID del elemento a limpiar.
 */
function clearError(elementId) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

/**
 * Muestra un mensaje de éxito o error en el formulario de registro.
 *
 * @param {'success'|'error'} type - Tipo de mensaje.
 * @param {string} message - Mensaje a mostrar.
 */
function showMessage(type, message) {
    const activeForm = document.getElementById('registerForm');
    if (!activeForm) return;
    const existingMessage = activeForm.querySelector('.message.alert-message');
    if (existingMessage) existingMessage.remove();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} show alert-message`;
    messageDiv.setAttribute('role', 'alert');
    messageDiv.setAttribute('aria-live', 'assertive');
    messageDiv.textContent = message;
    activeForm.prepend(messageDiv);
    
    // Enfocar el mensaje para screen readers
    messageDiv.setAttribute('tabindex', '-1');
    messageDiv.focus();
    
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => messageDiv.remove(), 500);
    }, 5000);
}

/**
 * Configura atributos de accesibilidad para inputs con errores.
 *
 * @param {HTMLInputElement} input - Input element.
 * @param {string|null} errorElementId - ID del elemento de error asociado.
 */
function setAccessibilityError(input, errorElementId) {
    if (!input) return;
    input.setAttribute('aria-invalid', 'true');
    if (errorElementId) {
        input.setAttribute('aria-describedby', errorElementId);
    }
    input.focus();
}

/**
 * Limpia atributos de accesibilidad de error en inputs.
 *
 * @param {HTMLInputElement} input - Input element.
 */
function clearAccessibilityError(input) {
    if (!input) return;
    input.setAttribute('aria-invalid', 'false');
    input.removeAttribute('aria-describedby');
}

/**
 * Reserva identificadores únicos (githubUsername y matrícula) usando transacciones atómicas.
 * Previene race conditions y garantiza unicidad en la base de datos.
 *
 * @param {string} uid - ID del usuario en Firebase Auth.
 * @param {string} githubUsername - Username de GitHub a reservar.
 * @param {string} matricula - Matrícula del estudiante a reservar.
 * @param {object} userData - Datos completos del usuario a guardar.
 * @returns {Promise<void>}
 * @throws {Error} Si el username o matrícula ya están en uso.
 */
async function reserveUniqueIdentifiers(uid, githubUsername, matricula, userData) {
    try {
        await runTransaction(db, async (transaction) => {
            // Referencias a documentos de mapeo
            const githubMappingRef = doc(db, 'github_usernames', githubUsername.toLowerCase());
            const matriculaMappingRef = doc(db, 'matriculas', matricula);
            const userDocRef = doc(db, 'usuarios', uid);

            // 1. Verificar si el githubUsername ya existe
            const githubDoc = await transaction.get(githubMappingRef);
            if (githubDoc.exists()) {
                throw new Error('GitHub username ya está en uso');
            }

            // 2. Verificar si la matrícula ya existe
            const matriculaDoc = await transaction.get(matriculaMappingRef);
            if (matriculaDoc.exists()) {
                throw new Error('Matrícula ya está en uso');
            }

            // 3. Si ambos están disponibles, escribir en transacción atómica
            
            // Reservar githubUsername
            transaction.set(githubMappingRef, {
                uid: uid,
                email: userData.email,
                createdAt: new Date().toISOString()
            });

            // Reservar matrícula
            transaction.set(matriculaMappingRef, {
                uid: uid,
                email: userData.email,
                createdAt: new Date().toISOString()
            });

            // Escribir datos del usuario
            transaction.set(userDocRef, {
                ...userData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // 4. SI ES ADMIN: Crear documento en colección 'admins' automáticamente
            if (isAdminEmail(userData.email)) {
                const adminDocRef = doc(db, 'admins', userData.email);
                transaction.set(adminDocRef, {
                    email: userData.email,
                    uid: uid,
                    githubUsername: githubUsername,
                    matricula: matricula,
                    firstName: userData.firstName,
                    lastName: `${userData.apellidoPaterno || ''} ${userData.apellidoMaterno || ''}`.trim(),
                    role: 'admin',
                    createdAt: new Date().toISOString(),
                    permissions: DEFAULT_ADMIN_PERMISSIONS
                });
                logDebug('✅ Usuario detectado como ADMIN - Agregado a colección admins');
            }

            logDebug('✅ Transacción completada: identificadores reservados y usuario creado');
        });
    } catch (error) {
        // Propagar errores de transacción
        if (error.message.includes('GitHub username ya está en uso')) {
            throw new Error('GitHub username ya está en uso');
        } else if (error.message.includes('Matrícula ya está en uso')) {
            throw new Error('Matrícula ya está en uso');
        } else {
            logError('❌ Error en transacción de Firestore:', error);
            throw new Error('No se pudieron guardar tus datos. Por favor, intenta de nuevo.');
        }
    }
}