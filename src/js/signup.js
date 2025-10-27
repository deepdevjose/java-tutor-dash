// Importar módulos de Firebase Auth y Firestore
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * @file signup.js
 * Lógica encapsulada para el formulario de registro (signup.html).
 */
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

    let githubTimeout;

    // --- LÓGICA DE NEGOCIO Y EVENTOS ---

    /**
     * Handler principal para el envío del formulario de registro.
     */
    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
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
            showMessage('error', 'Por favor, usa una dirección de Gmail válida (@gmail.com)');
            setLoading(false); return;
        }
        if (formData.password.length < 6) {
            showMessage('error', 'La contraseña debe tener al menos 6 caracteres');
            setLoading(false); return;
        }
        if (formData.matricula.length === 0) {
            showMessage('error', 'Por favor, ingresa tu matrícula');
            setLoading(false); return;
        }
        if (formData.grupo.length === 0) {
            showMessage('error', 'Por favor, ingresa tu grupo (A, B, C, etc.)');
            setLoading(false); return;
        }
        const isGitHubValid = await validateGitHub(formData.githubUsername);
        if (!isGitHubValid) {
            showMessage('error', 'Usuario de GitHub no válido. Por favor, verifícalo.');
            setLoading(false); return;
        }

        // --- INTEGRACIÓN REAL DE FIREBASE ---
        try {
            // 1. Crear usuario en Auth
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;
            console.log('Usuario creado en Auth:', user.uid);

            // 2. Enviar correo de verificación
            try {
                await sendEmailVerification(user);
                console.log('Correo de verificación enviado.');
            } catch (verificationError) {
                console.error("Error al enviar correo de verificación:", verificationError);
            }

            // 3. Borrar contraseña y guardar en Firestore
            delete formData.password;
            await setDoc(doc(db, "usuarios", user.uid), formData);
            console.log('Datos guardados en Firestore');

            // 4. Éxito y redirección a verificación
            showMessage('success', '¡Cuenta creada! Revisa tu correo para verificarla.');
            setTimeout(() => {
                window.location.href = 'verify-email.html';
            }, 3000);

        } catch (error) {
            // --- MANEJO DE ERRORES CORREGIDO ---
            console.error("Error en Sign Up:", error.code, error.message);
            let message = 'No se pudo crear la cuenta.'; // Mensaje por defecto

            if (error.code === 'auth/email-already-in-use') {
                message = 'Este correo electrónico ya está en uso.'; // Mensaje específico
            } else if (error.code === 'auth/weak-password') {
                message = 'La contraseña es muy débil (debe tener al menos 6 caracteres).';
            } else if (error.code === 'auth/invalid-email') {
                 message = 'El formato del correo electrónico no es válido.';
            }
            // Muestra la alerta de error en el formulario de signup
            showMessage('error', message);
            // --- FIN DEL BLOQUE CORREGIDO ---
        } finally {
            setLoading(false);
        }
        // --- FIN INTEGRACIÓN FIREBASE ---
    };

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
            submitBtn.textContent = submitBtn.dataset.originalText || 'Registrarse';
        }
    };

    /**
     * Filtra el input de grupo (A-Z, mayúscula, 1 carácter).
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
     * Valida el email en tiempo real (al salir del campo).
     */
    const handleEmailBlur = () => {
        const email = emailInput.value.trim();
        if (email && !validateEmail(email)) {
            showError('emailError', 'Solo se permiten direcciones @gmail.com');
            emailInput.style.borderColor = '#ef4444';
        } else {
            clearError('emailError');
            emailInput.style.borderColor = '#333';
        }
    };

    /**
     * Valida el usuario de GitHub en tiempo real (con debounce).
     */
    const handleGitHubInput = () => {
        clearTimeout(githubTimeout);
        const username = githubInput.value.trim();
        if (username.length > 2) {
            githubInput.style.borderColor = '#666';
            githubTimeout = setTimeout(async () => {
                const isValid = await validateGitHub(username);
                if (!isValid) {
                    showError('githubError', 'Usuario de GitHub no encontrado');
                    githubInput.style.borderColor = '#ef4444';
                } else {
                    clearError('githubError');
                    githubInput.style.borderColor = '#22c55e';
                }
            }, 800);
        } else {
            clearError('githubError');
            githubInput.style.borderColor = '#333';
        }
    };

    /**
     * Alterna la visibilidad de la contraseña.
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
    emailInput.addEventListener('blur', handleEmailBlur);
    githubInput.addEventListener('input', handleGitHubInput);
    if (matriculaInput) matriculaInput.addEventListener('input', handleMatriculaInput);
    if (grupoInput) grupoInput.addEventListener('input', handleGrupoInput);
    togglePwdBtns.forEach(btn => btn.addEventListener('click', togglePasswordVisibility));
    allFormInputs.forEach(input => { /* focus/blur */ });
    allFormInputs.forEach((input, index) => { /* Enter key */ });

}); // Fin de 'DOMContentLoaded'


// --- 4. FUNCIONES DE UTILIDAD (Puras) ---
function validateEmail(email) {
    const gmailRegex = /^[a-zA-Z0-9.+_-]+@gmail\.com$/;
    return gmailRegex.test(String(email).toLowerCase());
}
async function validateGitHub(username) {
    if (!username || username.length < 1) return false;
    try {
        const response = await fetch(`https://api.github.com/users/${username}`);
        return response.ok;
    } catch (error) {
        console.error('Error validando GitHub:', error); return false;
    }
}
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = message; el.style.display = 'block'; }
}
function clearError(elementId) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}
function showMessage(type, message) {
    const activeForm = document.getElementById('registerForm');
    if (!activeForm) return;
    const existingMessage = activeForm.querySelector('.message.alert-message');
    if (existingMessage) existingMessage.remove();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} show alert-message`;
    messageDiv.setAttribute('role', 'alert');
    messageDiv.textContent = message; // Iconos opcionales
    activeForm.prepend(messageDiv); // O insertar antes con parentNode.insertBefore
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => messageDiv.remove(), 500);
    }, 5000);
}