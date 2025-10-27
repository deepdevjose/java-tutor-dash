// Importar módulos de Firebase Auth y Firestore
import { auth, db } from './firebase-init.js';
// ¡Añadir sendPasswordResetEmail aquí! V
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * @file signin.js
 * Lógica encapsulada para el formulario de inicio de sesión (signin.html), incluyendo modal de restablecimiento.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- SELECCIÓN DE ELEMENTOS ---
    const signinForm = document.getElementById('registerForm');
    if (!signinForm) return;

    const emailInput = document.getElementById('email'); // Campo principal de login (type="text")
    const passwordInput = document.getElementById('password');
    const submitBtn = signinForm.querySelector('.submit-btn');
    const togglePwdBtns = document.querySelectorAll('.toggle-password');
    const formInputs = Array.from(signinForm.querySelectorAll('input:not([type="checkbox"]), select'));
    const keepLoggedInCheckbox = document.getElementById('keepLoggedIn');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // --- Selección de Elementos del Modal ---
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const resetEmailInput = document.getElementById('resetEmail'); // Input DENTRO del modal
    const sendResetEmailBtn = document.getElementById('sendResetEmailBtn');
    const modalAlertContainer = document.getElementById('modalAlertContainer');
    // --- FIN Selección Modal ---


    // --- LÓGICA DE NEGOCIO Y EVENTOS ---

    /**
     * Handler principal para el envío del formulario de INICIO DE SESIÓN.
     */
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const loginIdentifier = emailInput.value.trim();
        const password = passwordInput.value;

        // Validaciones simples
        if (loginIdentifier.length === 0) {
            showAlert('error', 'Ingresa tu correo, matrícula o usuario de GitHub', signinForm);
            return;
        }
        if (password.length < 6) {
            showAlert('error', 'La contraseña debe tener al menos 6 caracteres', signinForm);
            return;
        }

        setLoading(true);

        try {
            // 1. Establecer la persistencia
            const persistenceType = keepLoggedInCheckbox && keepLoggedInCheckbox.checked
                ? browserLocalPersistence
                : browserSessionPersistence;
            await setPersistence(auth, persistenceType);
            console.log(`Persistencia establecida a: ${keepLoggedInCheckbox && keepLoggedInCheckbox.checked ? 'local' : 'session'}`);

            // 2. Obtener el email real
            const email = await getEmailFromIdentifier(loginIdentifier);
            if (!email) {
                showAlert('error', 'Correo, matrícula o usuario de GitHub no encontrado.', signinForm);
                setLoading(false);
                return;
            }

            // 3. Iniciar sesión
            console.log('Usuario encontrado. Iniciando sesión con email:', email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Usuario ha iniciado sesión:', userCredential.user.uid);

            // 4. Comprobar verificación de correo
            if (!userCredential.user.emailVerified) {
                console.warn("Intento de login con correo no verificado:", userCredential.user.email);
                showAlert('error', 'Tu correo electrónico aún no ha sido verificado. Revisa tu bandeja de entrada.', signinForm);
                await signOut(auth); // Desloguear
                console.log("Usuario deslogueado por correo no verificado.");
                setLoading(false);
                return; // No redirigir
            }

            // 5. Éxito y redirección
            showAlert('success', '¡Inicio de sesión exitoso! Redirigiendo...', signinForm);
            setTimeout(() => {
                window.location.href = 'dashboard.html'; // Asegúrate que el nombre sea correcto
            }, 2000);

        } catch (error) {
            console.error("Error en Sign In:", error.code, error.message);
            let message = 'Error al iniciar sesión.';
            if (error.code === 'auth/invalid-credential') {
                message = 'Credenciales incorrectas. Verifica tus datos.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Demasiados intentos. Intenta más tarde.';
            }
            showAlert('error', message, signinForm);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Muestra el modal de restablecer contraseña.
     */
    const showResetModal = () => {
        if (resetPasswordModal) {
            resetEmailInput.value = emailInput.value.trim(); // Pre-rellenar
            modalAlertContainer.innerHTML = ''; // Limpiar alertas
            resetPasswordModal.classList.add('visible');
            resetEmailInput.focus(); // Poner foco en el input del modal
        }
    };

    /**
     * Oculta el modal de restablecer contraseña.
     */
    const hideResetModal = () => {
        if (resetPasswordModal) {
            resetPasswordModal.classList.remove('visible');
        }
    };

    /**
     * Handler para ENVIAR el correo de restablecimiento desde el modal.
     */
    const handleSendResetEmail = async () => {
        const email = resetEmailInput.value.trim();

        if (!email) {
            showAlertInModal('error', 'Por favor, ingresa tu correo electrónico.');
            resetEmailInput.focus();
            return;
        }
        // Validación simple de formato email (no solo @gmail)
        if (!/\S+@\S+\.\S+/.test(email)) {
             showAlertInModal('error', 'Ingresa un correo electrónico válido.');
             resetEmailInput.focus();
             return;
        }

        sendResetEmailBtn.disabled = true;
        sendResetEmailBtn.textContent = 'Enviando...';
        modalAlertContainer.innerHTML = '';

        try {
            await sendPasswordResetEmail(auth, email);
            showAlertInModal('success', `Correo enviado a ${email}. Revisa tu bandeja de entrada (y spam).`);
            // setTimeout(hideResetModal, 4000); // Cerrar después de 4 seg
        } catch (error) {
            console.error("Error al enviar correo de restablecimiento:", error.code, error.message);
            let message = 'No se pudo enviar el correo.';
            // Ser vago intencionalmente por seguridad
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
                message = 'Si tu correo está registrado, recibirás un enlace.';
                showAlertInModal('info', message);
            } else {
                 showAlertInModal('error', message);
            }
        } finally {
            sendResetEmailBtn.disabled = false;
            sendResetEmailBtn.textContent = 'Enviar Enlace';
        }
    };

    /**
     * Función auxiliar para mostrar alertas DENTRO del modal.
     */
    function showAlertInModal(type, message) {
        const alertDiv = document.createElement('div');
        const cssClass = type === 'success' ? 'success' : (type === 'info' ? 'info' : 'error');
        // Reutilizar clases CSS existentes para .message
        alertDiv.className = `message ${cssClass} show alert-message`; 
        // Iconos simples o podrías usar los mismos SVG
        const icon = type === 'success' ? '✅' : (type === 'info' ? 'ℹ️' : '❌');
        alertDiv.innerHTML = `<span style="margin-right: 8px;">${icon}</span><span>${message}</span>`;
        
        modalAlertContainer.innerHTML = ''; // Limpiar previas
        modalAlertContainer.appendChild(alertDiv);
    }

    /**
     * Busca en Firestore un email basado en un identificador.
     */
    async function getEmailFromIdentifier(identifier) {
        // ... (código sin cambios) ...
        if (validateEmail(identifier)) { return identifier; }
        if (/^[0-9]+$/.test(identifier)) {
            const q = query(collection(db, "usuarios"), where("matricula", "==", identifier), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) return snapshot.docs[0].data().email;
        }
        const q = query(collection(db, "usuarios"), where("githubUsername", "==", identifier), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return snapshot.docs[0].data().email;
        return null;
    }

    /**
     * Controla el estado visual y funcional del botón de submit principal.
     */
    const setLoading = (isLoading) => {
        // ... (código sin cambios) ...
        if (!submitBtn) return;
        if (isLoading) { /* ... */ } else { /* ... */ }
    };

    /**
     * Navegación con Enter en el formulario principal.
     */
    const handleEnterKeyNavigation = (e, currentIndex) => {
        // ... (código sin cambios) ...
        if (e.key === 'Enter') { /* ... */ }
    };

    /**
     * Alterna la visibilidad de la contraseña.
     */
    const togglePasswordVisibility = (e) => {
        // ... (código sin cambios) ...
        const btn = e.currentTarget; /* ... */
    };


    // --- 3. ASIGNACIÓN DE EVENT LISTENERS ---
    signinForm.addEventListener('submit', handleFormSubmit);

    // Listener para ABRIR el modal
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showResetModal();
        });
    }

    // Listeners para CERRAR el modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideResetModal);
    }
    if (resetPasswordModal) {
        resetPasswordModal.addEventListener('click', (e) => {
            if (e.target === resetPasswordModal) {
                hideResetModal();
            }
        });
    }

    // Listener para ENVIAR desde el modal
    if (sendResetEmailBtn) {
        sendResetEmailBtn.addEventListener('click', handleSendResetEmail);
        resetEmailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSendResetEmail();
            }
        });
    }

    // Listeners existentes
    togglePwdBtns.forEach(btn => btn.addEventListener('click', togglePasswordVisibility));
    formInputs.forEach((input, index) => input.addEventListener('keypress', (e) => handleEnterKeyNavigation(e, index)));

}); // Fin de 'DOMContentLoaded'


/**
 * Muestra una alerta de éxito o error ANTES del formulario especificado.
 * @param {'success' | 'error' | 'info'} type - El tipo de alerta
 * @param {string} message - El mensaje a mostrar
 * @param {HTMLElement} formElement - El elemento <form> ANTES del cual se insertará la alerta
 */
function showAlert(type, message, formElement) {
    const parentContainer = formElement.parentNode; // Obtener el contenedor padre (ej. .form-container)
    if (!parentContainer) return; // Salir si no hay padre

    // Remover alertas previas DENTRO DEL CONTENEDOR PADRE
    const existingAlert = parentContainer.querySelector('.alert-message');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Crear el nuevo elemento de alerta
    const alertDiv = document.createElement('div');
    const cssClass = type === 'success' ? 'success' : (type === 'info' ? 'info' : 'error');
    alertDiv.className = `message ${cssClass} show alert-message`; 
    alertDiv.style.display = 'block'; 
    // Quitar margen inferior si prefieres que esté pegado al título
    // alertDiv.style.marginBottom = '20px'; 
    alertDiv.setAttribute('role', 'alert');

    // Iconografía (puedes ajustar o quitar si prefieres)
    const icon = type === 'success'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
        : (type === 'info' 
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
          );
        
    alertDiv.innerHTML = `${icon}<span>${message}</span>`;
    
    // --- ¡CAMBIO CLAVE AQUÍ! ---
    // Insertar la alerta ANTES del formulario, en el contenedor padre
    parentContainer.insertBefore(alertDiv, formElement); 

    // Auto-ocultar (sin cambios)
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 500); 
    }, 5000);
}

/**
 * Valida si un string es un correo de @gmail.com (usado por getEmailFromIdentifier).
 */
function validateEmail(email) {
    // ... (código sin cambios) ...
    const gmailRegex = /^[a-zA-Z0-9.+_-]+@gmail\.com$/;
    return gmailRegex.test(String(email).toLowerCase());
}