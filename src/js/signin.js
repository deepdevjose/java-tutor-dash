// Importar módulos de Firebase Auth y Firestore
import { auth, db } from './firebase-init.js';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * @file signin.js
 * Lógica encapsulada para el formulario de inicio de sesión (signin.html), incluyendo modal de restablecimiento.
 */

// --- CONSTANTES ---
const BUTTON_TEXT = {
    SIGNIN: 'Iniciar Sesión',
    SIGNING_IN: 'Iniciando sesión...',
    RESEND: 'Enviar Enlace',
    SENDING: 'Enviando...'
};

const MESSAGES = {
    EMPTY_IDENTIFIER: 'Ingresa tu correo, matrícula o usuario de GitHub',
    SHORT_PASSWORD: 'La contraseña debe tener al menos 6 caracteres',
    NOT_FOUND: 'Correo, matrícula o usuario de GitHub no encontrado.',
    UNVERIFIED_EMAIL: 'Tu correo electrónico aún no ha sido verificado. Revisa tu bandeja de entrada.',
    SUCCESS: '¡Inicio de sesión exitoso! Redirigiendo...',
    INVALID_CREDENTIALS: 'Credenciales incorrectas. Verifica tus datos.',
    TOO_MANY_REQUESTS: 'Demasiados intentos. Intenta más tarde.',
    USER_NOT_FOUND: 'No existe una cuenta con este correo electrónico.',
    WRONG_PASSWORD: 'La contraseña es incorrecta. Inténtalo de nuevo.',
    INVALID_EMAIL: 'El formato del correo electrónico no es válido.',
    NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.',
    GENERIC_ERROR: 'Error al iniciar sesión.'
};

document.addEventListener('DOMContentLoaded', () => {

    // --- SELECCIÓN DE ELEMENTOS (Centralizado) ---
    const DOM = {
        signinForm: document.getElementById('registerForm'),
        emailInput: document.getElementById('email'),
        passwordInput: document.getElementById('password'),
        submitBtn: null, // Se asignará después
        togglePwdBtns: document.querySelectorAll('.toggle-password'),
        formInputs: null, // Se asignará después
        keepLoggedInCheckbox: document.getElementById('keepLoggedIn'),
        forgotPasswordLink: document.getElementById('forgotPasswordLink'),
        resetPasswordModal: document.getElementById('resetPasswordModal'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        resetEmailInput: document.getElementById('resetEmail'),
        sendResetEmailBtn: document.getElementById('sendResetEmailBtn'),
        modalAlertContainer: document.getElementById('modalAlertContainer')
    };

    if (!DOM.signinForm) {
        console.error('❌ Error crítico: Formulario de signin no encontrado en el DOM');
        return;
    }

    DOM.submitBtn = DOM.signinForm.querySelector('.submit-btn');
    DOM.formInputs = Array.from(DOM.signinForm.querySelectorAll('input:not([type="checkbox"]), select'));

    // --- LÓGICA DE NEGOCIO Y EVENTOS ---

    /**
     * Envía el formulario de inicio de sesión, gestiona persistencia, validación y redirección.
     *
     * @param {Event} e - Evento submit del formulario.
     * @returns {Promise<void>}
     */
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const loginIdentifier = DOM.emailInput.value.trim();
        const password = DOM.passwordInput.value;

        // Validaciones simples
        if (loginIdentifier.length === 0) {
            showAlert('error', MESSAGES.EMPTY_IDENTIFIER, DOM.signinForm);
            return;
        }
        if (password.length < 6) {
            showAlert('error', MESSAGES.SHORT_PASSWORD, DOM.signinForm);
            return;
        }

        setLoading(true);

        try {
            // 1. Establecer la persistencia
            const persistenceType = DOM.keepLoggedInCheckbox && DOM.keepLoggedInCheckbox.checked
                ? browserLocalPersistence
                : browserSessionPersistence;
            await setPersistence(auth, persistenceType);
            logDebug(`Persistencia establecida a: ${DOM.keepLoggedInCheckbox && DOM.keepLoggedInCheckbox.checked ? 'local' : 'session'}`);

            // 2. Obtener el email real
            const email = await getEmailFromIdentifier(loginIdentifier);
            if (!email) {
                showAlert('error', MESSAGES.NOT_FOUND, DOM.signinForm);
                setLoading(false);
                return;
            }

            // 3. Iniciar sesión
            logDebug('Usuario encontrado. Iniciando sesión...');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            logDebug('Inicio de sesión exitoso');

            // 4. Comprobar verificación de correo
            if (!userCredential.user.emailVerified) {
                logWarn("Intento de login con correo no verificado");
                showAlert('error', MESSAGES.UNVERIFIED_EMAIL, DOM.signinForm);
                await signOut(auth);
                logDebug("Usuario deslogueado por correo no verificado");
                setLoading(false);
                return;
            }

            // 5. Éxito y redirección
            showAlert('success', MESSAGES.SUCCESS, DOM.signinForm);
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);

        } catch (error) {
            logError("Error en Sign In:", error.code);
            let message = MESSAGES.GENERIC_ERROR;
            
            // Mapeo completo de códigos de error de Firebase Auth
            switch (error.code) {
                case 'auth/invalid-credential':
                    message = MESSAGES.INVALID_CREDENTIALS;
                    break;
                case 'auth/user-not-found':
                    message = MESSAGES.USER_NOT_FOUND;
                    break;
                case 'auth/wrong-password':
                    message = MESSAGES.WRONG_PASSWORD;
                    break;
                case 'auth/invalid-email':
                    message = MESSAGES.INVALID_EMAIL;
                    break;
                case 'auth/too-many-requests':
                    message = MESSAGES.TOO_MANY_REQUESTS;
                    break;
                case 'auth/network-request-failed':
                    message = MESSAGES.NETWORK_ERROR;
                    break;
                default:
                    message = MESSAGES.GENERIC_ERROR;
            }
            
            showAlert('error', message, DOM.signinForm);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Muestra el modal de restablecimiento de contraseña y precarga el email si está disponible.
     */
    const showResetModal = () => {
        if (DOM.resetPasswordModal && DOM.resetEmailInput) {
            DOM.resetEmailInput.value = DOM.emailInput.value.trim();
            DOM.modalAlertContainer.innerHTML = '';
            DOM.resetPasswordModal.classList.add('visible');
            DOM.resetEmailInput.focus();
        }
    };

    /**
     * Oculta el modal de restablecimiento de contraseña.
     */
    const hideResetModal = () => {
        if (DOM.resetPasswordModal) {
            DOM.resetPasswordModal.classList.remove('visible');
        }
    };

    /**
     * Envía el correo de restablecimiento de contraseña desde el modal.
     *
     * @returns {Promise<void>}
     */
    const handleSendResetEmail = async () => {
        const email = DOM.resetEmailInput.value.trim();

        if (!email) {
            showAlertInModal('error', 'Por favor, ingresa tu correo electrónico.');
            DOM.resetEmailInput.focus();
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            showAlertInModal('error', 'Ingresa un correo electrónico válido.');
            DOM.resetEmailInput.focus();
            return;
        }

        DOM.sendResetEmailBtn.disabled = true;
        DOM.sendResetEmailBtn.textContent = BUTTON_TEXT.SENDING;
        DOM.modalAlertContainer.innerHTML = '';

        try {
            await sendPasswordResetEmail(auth, email);
            showAlertInModal('success', `Correo enviado a ${email}. Revisa tu bandeja de entrada (y spam).`);
        } catch (error) {
            logError("Error al enviar correo de restablecimiento:", error.code);
            // No revelamos si el usuario existe (práctica de seguridad)
            const message = 'Si tu correo está registrado, recibirás un enlace.';
            showAlertInModal('info', message);
        } finally {
            DOM.sendResetEmailBtn.disabled = false;
            DOM.sendResetEmailBtn.textContent = BUTTON_TEXT.RESEND;
        }
    };

    /**
     * Muestra una alerta dentro del modal de restablecimiento usando DOM API seguro.
     *
     * @param {'success'|'info'|'error'} type - Tipo de alerta.
     * @param {string} message - Mensaje a mostrar.
     */
    function showAlertInModal(type, message) {
        const alertDiv = document.createElement('div');
        const cssClass = type === 'success' ? 'success' : (type === 'info' ? 'info' : 'error');
        alertDiv.className = `message ${cssClass} show alert-message`;
        
        const iconSpan = document.createElement('span');
        iconSpan.style.marginRight = '8px';
        const icon = type === 'success' ? '✅' : (type === 'info' ? 'ℹ️' : '❌');
        iconSpan.textContent = icon;
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        
        alertDiv.appendChild(iconSpan);
        alertDiv.appendChild(messageSpan);

        DOM.modalAlertContainer.innerHTML = '';
        DOM.modalAlertContainer.appendChild(alertDiv);
    }

    /**
     * Busca en Firestore el email de un usuario a partir de un identificador (email, matrícula o GitHub username).
     * Usa colecciones de mapeo para garantizar O(1) lookup y unicidad.
     *
     * @param {string} identifier - Email, matrícula o username de GitHub.
     * @returns {Promise<string|null>} Email encontrado o null si no existe.
     * @throws {Error} Si ocurre un error de permisos en Firestore.
     */
    async function getEmailFromIdentifier(identifier) {
        try {
            // Si parece un email válido, usarlo directamente
            if (validateEmail(identifier)) {
                logDebug('Identificador es un email válido');
                return identifier;
            }

            // Si es solo números, buscar por matrícula en colección de mapeo
            if (/^[0-9]+$/.test(identifier)) {
                logDebug('Buscando usuario por matrícula en mapeo...');
                const matriculaRef = doc(db, 'matriculas', identifier);
                const matriculaDoc = await getDoc(matriculaRef);

                if (matriculaDoc.exists()) {
                    const email = matriculaDoc.data().email;
                    logDebug('Usuario encontrado por matrícula');
                    return email;
                }
                logDebug('No se encontró usuario con esa matrícula');
                return null;
            }

            // Si no es email ni matrícula, buscar por username de GitHub en colección de mapeo
            logDebug('Buscando usuario por GitHub username en mapeo...');
            const githubRef = doc(db, 'github_usernames', identifier.toLowerCase());
            const githubDoc = await getDoc(githubRef);

            if (githubDoc.exists()) {
                const email = githubDoc.data().email;
                logDebug('Usuario encontrado por GitHub username');
                return email;
            }
            logDebug('No se encontró usuario con ese GitHub username');

            return null;
        } catch (error) {
            logError('Error al buscar usuario:', error.code);

            // Si el error es de permisos, dar instrucciones claras
            if (error.code === 'permission-denied') {
                logError('Error de permisos en Firestore');
                logError('Verifica las reglas de seguridad en Firebase Console');
            }

            return null;
        }
    }

    /**
     * Controla el estado visual y funcional del botón de submit principal.
     *
     * @param {boolean} isLoading - Si está cargando o no.
     */
    const setLoading = (isLoading) => {
        if (!DOM.submitBtn) return;
        if (isLoading) {
            DOM.submitBtn.disabled = true;
            DOM.submitBtn.textContent = BUTTON_TEXT.SIGNING_IN;
            DOM.submitBtn.style.opacity = '0.7';
            DOM.submitBtn.style.cursor = 'not-allowed';
        } else {
            DOM.submitBtn.disabled = false;
            DOM.submitBtn.textContent = BUTTON_TEXT.SIGNIN;
            DOM.submitBtn.style.opacity = '1';
            DOM.submitBtn.style.cursor = 'pointer';
        }
    };

    /**
     * Permite navegar entre inputs del formulario usando Enter.
     *
     * @param {KeyboardEvent} e - Evento de teclado.
     * @param {number} currentIndex - Índice del input actual.
     */
    const handleEnterKeyNavigation = (e, currentIndex) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextIndex = currentIndex + 1;
            if (nextIndex < DOM.formInputs.length) {
                DOM.formInputs[nextIndex].focus();
            } else {
                DOM.signinForm.requestSubmit();
            }
        }
    };

    /**
     * Alterna la visibilidad de la contraseña en el input correspondiente usando DOM API seguro.
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

        // Crear iconos SVG usando createElementNS (más seguro que innerHTML)
        btn.innerHTML = ''; // Limpiar contenido
        const svg = createSVGIcon(isPassword ? 'eye-closed' : 'eye-open');
        btn.appendChild(svg);
    };

    // --- ASIGNACIÓN DE EVENT LISTENERS ---
    DOM.signinForm.addEventListener('submit', handleFormSubmit);

    if (DOM.forgotPasswordLink) {
        DOM.forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showResetModal();
        });
    }

    if (DOM.closeModalBtn) {
        DOM.closeModalBtn.addEventListener('click', hideResetModal);
    }

    if (DOM.resetPasswordModal) {
        DOM.resetPasswordModal.addEventListener('click', (e) => {
            if (e.target === DOM.resetPasswordModal) {
                hideResetModal();
            }
        });
    }

    if (DOM.sendResetEmailBtn && DOM.resetEmailInput) {
        DOM.sendResetEmailBtn.addEventListener('click', handleSendResetEmail);
        DOM.resetEmailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSendResetEmail();
            }
        });
    }

    DOM.togglePwdBtns.forEach(btn => btn.addEventListener('click', togglePasswordVisibility));
    DOM.formInputs.forEach((input, index) => input.addEventListener('keypress', (e) => handleEnterKeyNavigation(e, index)));

});

// --- FUNCIONES DE UTILIDAD ---

/**
 * Crea un SVG icon de forma segura usando DOM API.
 *
 * @param {'eye-open'|'eye-closed'|'success'|'info'|'error'} type - Tipo de icono.
 * @returns {SVGElement} Elemento SVG.
 */
function createSVGIcon(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    if (type === 'eye-open') {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '3');
        svg.appendChild(path);
        svg.appendChild(circle);
    } else if (type === 'eye-closed') {
        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('d', 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '1');
        line.setAttribute('y1', '1');
        line.setAttribute('x2', '23');
        line.setAttribute('y2', '23');
        svg.appendChild(path1);
        svg.appendChild(line);
    }

    return svg;
}

/**
 * Muestra una alerta de éxito, info o error antes del formulario especificado usando DOM API seguro.
 *
 * @param {'success'|'info'|'error'} type - Tipo de alerta.
 * @param {string} message - Mensaje a mostrar.
 * @param {HTMLFormElement} formElement - Formulario donde se muestra la alerta.
 */
function showAlert(type, message, formElement) {
    const parentContainer = formElement.parentNode;
    if (!parentContainer) return;

    const existingAlert = parentContainer.querySelector('.alert-message');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    const cssClass = type === 'success' ? 'success' : (type === 'info' ? 'info' : 'error');
    alertDiv.className = `message ${cssClass} show alert-message`;
    alertDiv.style.display = 'block';
    alertDiv.setAttribute('role', 'alert');

    // Crear icono SVG de forma segura
    const iconContainer = document.createElement('span');
    iconContainer.style.verticalAlign = 'middle';
    iconContainer.style.marginRight = '8px';
    iconContainer.textContent = type === 'success' ? '✅' : (type === 'info' ? 'ℹ️' : '❌');

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    alertDiv.appendChild(iconContainer);
    alertDiv.appendChild(messageSpan);
    parentContainer.insertBefore(alertDiv, formElement);

    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 500);
    }, 5000);
}

/**
 * Valida si un string es un correo electrónico válido.
 *
 * @param {string} email - Email a validar.
 * @returns {boolean} True si el email es válido, false si no.
 */
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(String(email).toLowerCase());
}

// --- LOGGING UTILITIES (Centralizadas para control en producción) ---

/**
 * Log de debug (solo en desarrollo).
 * @param {...any} args - Argumentos a loguear.
 */
function logDebug(...args) {
    if (isDevelopment()) {
        console.log('✅', ...args);
    }
}

/**
 * Log de warning.
 * @param {...any} args - Argumentos a loguear.
 */
function logWarn(...args) {
    if (isDevelopment()) {
        console.warn('⚠️', ...args);
    }
}

/**
 * Log de error (siempre visible pero sin detalles sensibles en producción).
 * @param {...any} args - Argumentos a loguear.
 */
function logError(...args) {
    if (isDevelopment()) {
        console.error('❌', ...args);
    } else {
        // En producción, loguear solo mensajes genéricos
        console.error('Error occurred');
    }
}

/**
 * Verifica si estamos en modo desarrollo.
 * @returns {boolean} True si es desarrollo.
 */
function isDevelopment() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}