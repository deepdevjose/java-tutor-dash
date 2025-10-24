// Importar módulos de Firebase Auth y Firestore
import { auth, db } from './firebase-init.js';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * @file signin.js
 * Lógica encapsulada para el formulario de inicio de sesión (signin.html).
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- SELECCIÓN DE ELEMENTOS ---
    const signinForm = document.getElementById('registerForm');

    if (!signinForm) {
        return;
    }

    const emailInput = document.getElementById('email'); // Este es type="text"
    const passwordInput = document.getElementById('password');
    const submitBtn = signinForm.querySelector('.submit-btn');
    const togglePwdBtns = document.querySelectorAll('.toggle-password');
    const formInputs = Array.from(signinForm.querySelectorAll('input:not([type="checkbox"]), select'));
    const keepLoggedInCheckbox = document.getElementById('keepLoggedIn');

    // --- LÓGICA DE NEGOCIO Y EVENTOS ---
    /**
     * Handler principal para el envío del formulario.
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

        // --- INTEGRACIÓN REAL DE FIREBASE ---
        try {
            // 1. Establecer la persistencia ANTES de iniciar sesión
            // Verifica si el checkbox existe antes de intentar leerlo
            const persistenceType = keepLoggedInCheckbox && keepLoggedInCheckbox.checked
                ? browserLocalPersistence // Duradera (meses)
                : browserSessionPersistence; // Solo hasta cerrar navegador

            await setPersistence(auth, persistenceType);
            console.log(`Persistencia establecida a: ${keepLoggedInCheckbox && keepLoggedInCheckbox.checked ? 'local' : 'session'}`);

            // 2. Obtener el email real del usuario
            const email = await getEmailFromIdentifier(loginIdentifier);

            if (!email) {
                // Usuario no encontrado por ningún identificador
                showAlert('error', 'Correo, matrícula o usuario de GitHub no encontrado.', signinForm);
                setLoading(false); // Detener carga antes de salir
                return;
            }

            // 3. Si encontramos el email, iniciar sesión
            console.log('Usuario encontrado. Iniciando sesión con email:', email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Usuario ha iniciado sesión:', userCredential.user.uid);

            // 4. Éxito: mostrar mensaje y redirigir
            showAlert('success', '¡Inicio de sesión exitoso! Redirigiendo...', signinForm);

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);

        } catch (error) {
            // Manejar errores de Firebase
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
        // --- FIN INTEGRACIÓN FIREBASE ---
    };

    /**
     * Busca en Firestore un email basado en un identificador.
     * @param {string} identifier - Lo que el usuario escribió.
     * @returns {Promise<string|null>} - El email del usuario o null si no se encuentra.
     */
    async function getEmailFromIdentifier(identifier) {
        if (validateEmail(identifier)) {
            console.log("Identificador es un email.");
            return identifier;
        }

        if (/^[0-9]+$/.test(identifier)) {
            console.log('Buscando por matrícula:', identifier);
            const matriculaQuery = query(
                collection(db, "usuarios"),
                where("matricula", "==", identifier),
                limit(1)
            );
            const querySnapshot = await getDocs(matriculaQuery);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                console.log("Encontrado por matrícula. Email:", userDoc.data().email);
                return userDoc.data().email;
            }
        }

        console.log('Buscando por GitHub:', identifier);
        const githubQuery = query(
            collection(db, "usuarios"),
            where("githubUsername", "==", identifier),
            limit(1)
        );
        const querySnapshot = await getDocs(githubQuery);

        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            console.log("Encontrado por GitHub. Email:", userDoc.data().email);
            return userDoc.data().email;
        }

        console.log('No se encontró ningún usuario con ese identificador.');
        return null;
    }


    /**
     * Controla el estado visual y funcional del botón de submit.
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
            submitBtn.textContent = submitBtn.dataset.originalText || 'Iniciar sesión';
        }
    };

    /**
     * Permite al usuario navegar entre inputs usando la tecla 'Enter'.
     */
    const handleEnterKeyNavigation = (e, currentIndex) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentIndex < formInputs.length - 1) {
                formInputs[currentIndex + 1].focus();
            } else {
                submitBtn.click();
            }
        }
    };

    /**
     * Alterna la visibilidad de un campo de contraseña (texto/password).
     */
    const togglePasswordVisibility = (e) => {
        const btn = e.currentTarget;
        const input = btn.closest('.password-input')?.querySelector('input');

        if (!input) return;

        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);

        btn.style.color = type === 'text' ? '#a855f7' : '#999';
    };


    // --- 3. ASIGNACIÓN DE EVENT LISTENERS ---
    signinForm.addEventListener('submit', handleFormSubmit);

    togglePwdBtns.forEach(btn => {
        btn.addEventListener('click', togglePasswordVisibility);
    });

    formInputs.forEach((input, index) => {
        input.addEventListener('keypress', (e) => handleEnterKeyNavigation(e, index));
    });

}); // Fin de 'DOMContentLoaded'


// --- 4. FUNCIONES DE UTILIDAD (Puras) ---
/**
 * Muestra una alerta de éxito o error dentro del formulario.
 */
function showAlert(type, message, formElement) {
    const existingAlert = formElement.querySelector('.alert-message');
    if (existingAlert) {
        existingAlert.remove();
    }
    const alertDiv = document.createElement('div');
    const cssClass = type === 'success' ? 'success' : 'error';
    alertDiv.className = `message ${cssClass} show alert-message`;
    alertDiv.style.display = 'block';
    alertDiv.style.marginBottom = '20px';
    alertDiv.setAttribute('role', 'alert');
    const icon = type === 'success'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    alertDiv.innerHTML = `${icon}<span>${message}</span>`;
    formElement.prepend(alertDiv);
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 500);
    }, 5000);
}

/**
 * Valida si un string es un correo de @gmail.com.
 */
function validateEmail(email) {
    const gmailRegex = /^[a-zA-Z0-9.+_-]+@gmail\.com$/;
    return gmailRegex.test(String(email).toLowerCase());
}