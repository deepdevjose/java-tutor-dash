// import firebase auth and firestore modules
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


/**
 * @file signup.js
 * Lógica encapsulada para el formulario de registro (signup.html).
 * Se inicializa al cargar el DOM.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- SELECCIÓN DE ELEMENTOS ---
    const registerForm = document.getElementById('registerForm');

    if (!registerForm) {
        return;
    }

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
     * Handler (manejador) principal para el envío del formulario de registro.
     * @param {Event} e - El objeto de evento 'submit'
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

        // --- Validaciones (sin cambios) ---
        if (!validateEmail(formData.email)) {
            showMessage('error', 'Por favor, usa una dirección de Gmail válida (@gmail.com)');
            setLoading(false);
            return;
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
        const isGitHubValid = await validateGitHub(formData.githubUsername);
        if (!isGitHubValid) {
            showMessage('error', 'Usuario de GitHub no válido. Por favor, verifícalo.');
            setLoading(false);
            return;
        }


        // --- [INICIO] INTEGRACIÓN REAL DE FIREBASE ---
        // ¡Este es el código que reemplaza tu simulación!
        try {
            // 1. Crear el usuario en Firebase Auth (Autenticación)
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;
            console.log('Usuario creado en Auth:', user.uid);

            // 2. ¡MUY IMPORTANTE! Borrar la contraseña del objeto
            delete formData.password;

            // 3. Guardar el resto de los datos en Firestore (Base de Datos)
            // Esto crea un documento en: coleccion "usuarios" -> documento "uid_del_usuario"
            await setDoc(doc(db, "usuarios", user.uid), formData);
            console.log('Datos guardados en Firestore');

            // 4. Éxito y redirección
            showMessage('success', '¡Cuenta creada! Redirigiendo al dashboard...');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);

        } catch (error) {
            // Manejar errores de Firebase
            console.error("Error en Sign Up:", error.code, error.message);
            let message = 'No se pudo crear la cuenta.';
            if (error.code === 'auth/email-already-in-use') {
                message = 'Este correo electrónico ya está en uso.';
            } else if (error.code === 'auth/weak-password') {
                message = 'La contraseña es muy débil.';
            }
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
        // --- [FIN] INTEGRACIÓN REAL DE FIREBASE ---
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
     */
    const handleGrupoInput = () => {
        let value = grupoInput.value;
        value = value.toUpperCase().replace(/[^A-Z]/g, '');
        if (value.length > 1) {
            value = value.charAt(0);
        }
        grupoInput.value = value;
    };

    /**
     * Filtra el input de matrícula para que solo acepte dígitos (0-9).
     */
    const handleMatriculaInput = () => {
        matriculaInput.value = matriculaInput.value.replace(/[^0-9]/g, '');
    };

    /**
     * Valida el email cuando el usuario sale del campo ('blur').
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
     * Valida el usuario de GitHub en tiempo real, usando 'debounce'.
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
     * Alterna la visibilidad de la contraseña (texto/password).
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
    if (matriculaInput) {
        matriculaInput.addEventListener('input', handleMatriculaInput);
    }
    if (grupoInput) {
        grupoInput.addEventListener('input', handleGrupoInput);
    }

    togglePwdBtns.forEach(btn => {
        btn.addEventListener('click', togglePasswordVisibility);
    });

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

    allFormInputs.forEach((input, index) => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (index < allFormInputs.length - 1) {
                    allFormInputs[index + 1].focus();
                } else {
                    submitBtn.click();
                }
            }
        });
    });

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
        console.error('Error validando GitHub:', error);
        return false;
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

function showMessage(type, message) {
    const activeForm = document.getElementById('registerForm');
    if (!activeForm) return;

    const existingMessage = activeForm.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} show`;
    messageDiv.setAttribute('role', 'alert');
    messageDiv.textContent = message;

    activeForm.prepend(messageDiv);

    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => messageDiv.remove(), 500);
    }, 5000);
}