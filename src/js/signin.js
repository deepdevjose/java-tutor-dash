/**
 * @file signin.js
 * Lógica encapsulada para el formulario de inicio de sesión (signin.html).
 * Se inicializa al cargar el DOM.
*/

// Usamos 'DOMContentLoaded' para asegurar que el script se ejecuta solo 
// cuando el HTML está completamente cargado.
// Toda la lógica vive dentro de este bloque, protegiendo el scope global.
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SELECCIÓN DE ELEMENTOS ---
    // Centralizamos todos los selectores del DOM.
    // Usamos 'const' para asegurar que no sean reasignados.
    const signinForm = document.getElementById('registerForm');
    
    // Si el formulario no existe en esta página, detenemos la ejecución 
    // de este script para evitar errores en consola. (Guarda Temprana)
    if (!signinForm) {
        // console.warn('Script de Sign-In cargado, pero no se encontró el formulario.');
        return; 
    }

    // Almacenamos referencias a los elementos que usaremos repetidamente
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = signinForm.querySelector('.submit-btn');
    const togglePwdBtns = document.querySelectorAll('.toggle-password');
    // Creamos un array de los inputs para facilitar la navegación con 'Enter'
    const formInputs = Array.from(signinForm.querySelectorAll('input:not([type="checkbox"]), select'));

    
    // --- 2. LÓGICA DE NEGOCIO Y EVENTOS ---

    /**
     * Handler (manejador) principal para el envío del formulario.
     * Es asíncrono ('async') para poder usar 'await' con Firebase o simulaciones.
     * @param {Event} e - El objeto de evento 'submit'
     */
    const handleFormSubmit = async (e) => {
        e.preventDefault(); // Prevenimos el envío HTML tradicional que recarga la página

        // Obtenemos y limpiamos los valores de los inputs
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // --- Validación de Entradas (Validación del lado del cliente) ---
        if (!validateEmail(email)) {
            showAlert('error', 'Usa una dirección de Gmail válida (@gmail.com)', signinForm);
            return; // Detenemos la ejecución si la validación falla
        }

        if (password.length < 6) {
            showAlert('error', 'La contraseña debe tener al menos 6 caracteres', signinForm);
            return; // Detenemos la ejecución
        }

        setLoading(true); // Activar estado de carga (spinner y botón deshabilitado)

        // 
        // --- [INICIO] SIMULACIÓN DE API ---
        // (Este bloque se reemplazará con Firebase)
        //
        console.log('Iniciando sesión con:', { email, password });
        try {
            // Simulación de una llamada de red que toma 1.5 segundos
            // 'await new Promise' es una forma de pausar la ejecución asíncrona
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Simulación de éxito
            showAlert('success', '¡Inicio de sesión exitoso! Redirigiendo...', signinForm);
            
            // Redirigir SÓLO después de mostrar el mensaje
            setTimeout(() => {
                // OJO: tu archivo se llama 'dashborad.html', no 'dashboard.html'
                window.location.href = 'dashboard.html';
            }, 2000);

        } catch (error) {
            // Simulación de un error de red o de autenticación
            console.error('Error en simulación:', error);
            showAlert('error', 'Correo o contraseña incorrectos.', signinForm);
        
        } finally {
            // El bloque 'finally' se ejecuta siempre, haya éxito o error.
            // Perfecto para desactivar el estado de carga.
            setLoading(false); 
        }
        //
        // --- [FIN] SIMULACIÓN DE API ---
        //
        
        /* // --- [INICIO] INTEGRACIÓN REAL DE FIREBASE ---
        // (Este será el código real)
        try {
            // const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // console.log(userCredential.user);
            
            showAlert('success', '¡Inicio de sesión exitoso! Redirigiendo...', signinForm);
            
            setTimeout(() => {
                window.location.href = 'dashborad.html';
            }, 2000);

        } catch (error) {
            console.error("Error en Sign In:", error.code);
            let message = 'Error al iniciar sesión.';
            
            // Códigos de error comunes de Firebase Auth
            if (error.code === 'auth/user-not-found' || 
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-credential') {
                message = 'Correo o contraseña incorrectos.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Demasiados intentos. Intenta más tarde.';
            }
            
            showAlert('error', message, signinForm);
        } finally {
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
        if (!submitBtn) return; // Guarda por si el botón no existe
        
        if (isLoading) {
            submitBtn.disabled = true; // Deshabilitar para evitar doble click
            submitBtn.classList.add('loading');
            // Guardamos el texto original en un 'data-attribute' para poder restaurarlo
            if (!submitBtn.dataset.originalText) {
                submitBtn.dataset.originalText = submitBtn.textContent;
            }
            submitBtn.textContent = ''; // Ocultar texto para mostrar el spinner CSS
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            // Restauramos el texto original guardado
            submitBtn.textContent = submitBtn.dataset.originalText || 'Iniciar sesión';
        }
    };

    /**
     * Permite al usuario navegar entre inputs usando la tecla 'Enter'.
     * @param {KeyboardEvent} e - El evento de teclado ('keypress')
     * @param {number} currentIndex - Índice del input actual en el array 'formInputs'
     */
    const handleEnterKeyNavigation = (e, currentIndex) => {
        // Solo actuar si la tecla presionada es 'Enter'
        if (e.key === 'Enter') {
            e.preventDefault(); // Evitar que 'Enter' envíe el formulario por defecto
            
            if (currentIndex < formInputs.length - 1) {
                // Si no es el último input, pasar al siguiente
                formInputs[currentIndex + 1].focus();
            } else {
                // Si es el último input, simular click en el botón de submit
                submitBtn.click();
            }
        }
    };

    /**
     * Alterna la visibilidad de un campo de contraseña (texto/password).
     * @param {Event} e - El evento de click del botón-ojo
     */
    const togglePasswordVisibility = (e) => {
        // 'currentTarget' se refiere al botón en el que se asignó el listener
        const btn = e.currentTarget; 
        // Buscamos el input que es "hermano" del botón, dentro del mismo 'div'
        const input = btn.closest('.password-input')?.querySelector('input');
        
        if (!input) return; // Si no se encuentra el input, no hacer nada

        // Alternar el atributo 'type'
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        // Cambia el color del ícono (ojo) para dar feedback visual
        btn.style.color = type === 'text' ? '#a855f7' : '#999'; 
    };

    
    // --- 3. ASIGNACIÓN DE EVENT LISTENERS ---
    // Aquí es donde "conectamos" nuestras funciones a las acciones del usuario.
    
    // Conectar la función 'handleFormSubmit' al evento 'submit' del formulario
    signinForm.addEventListener('submit', handleFormSubmit);

    // Conectar 'togglePasswordVisibility' a CADA botón de ojo
    togglePwdBtns.forEach(btn => {
        btn.addEventListener('click', togglePasswordVisibility);
    });

    // Conectar 'handleEnterKeyNavigation' a CADA input del formulario
    formInputs.forEach((input, index) => {
        input.addEventListener('keypress', (e) => handleEnterKeyNavigation(e, index));
    });

}); // Fin de 'DOMContentLoaded'


// --- 4. FUNCIONES DE UTILIDAD (Puras) ---
// Estas funciones están fuera del 'DOMContentLoaded' porque no necesitan
// acceder al DOM directamente al ser definidas. Son herramientas reutilizables.

/**
 * Muestra una alerta de éxito o error dentro del formulario.
 * @param {'success' | 'error'} type - El tipo de alerta (usado para clases CSS)
 * @param {string} message - El mensaje a mostrar al usuario
 * @param {HTMLElement} formElement - El elemento <form> donde se insertará la alerta
 */
function showAlert(type, message, formElement) {
    // Remover alertas previas para evitar duplicados
    const existingAlert = formElement.querySelector('.alert-message');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Crear el nuevo elemento de alerta
    const alertDiv = document.createElement('div');
    
    // Usamos clases de 'signin.css' y una clase de control 'alert-message'
    const cssClass = type === 'success' ? 'success' : 'error';
    alertDiv.className = `message ${cssClass} show alert-message`; 
    alertDiv.style.display = 'block'; // Forzar visibilidad por si acaso
    alertDiv.style.marginBottom = '20px'; // Espaciado
    alertDiv.setAttribute('role', 'alert'); // Buena práctica de accesibilidad (a11y)

    // Iconografía (SVG inline para no depender de archivos externos)
    const icon = type === 'success'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        
    alertDiv.innerHTML = `${icon}<span>${message}</span>`;
    
    // Insertar la alerta al inicio del formulario, antes de cualquier otro hijo
    formElement.prepend(alertDiv);

    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        alertDiv.classList.remove('show');
        // Esperar a que termine la animación de 'fade out' (si existe) antes de eliminar
        setTimeout(() => alertDiv.remove(), 500); 
    }, 5000);
}

/**
 * Valida si un string es un correo de @gmail.com.
 * @param {string} email - El correo a validar
 * @returns {boolean} - True si es un email de Gmail válido
 */
function validateEmail(email) {
    // Regex (Expresión Regular):
    // ^[a-zA-Z0-9.+_-]+  -> Comienzo (^), seguido de uno o más caracteres de usuario (permite puntos, +, _, -)
    // @gmail\.com$       -> Seguido de '@gmail.com' exacto y fin del string ($)
    const gmailRegex = /^[a-zA-Z0-9.+_-]+@gmail\.com$/;
    // .test() devuelve true/false si el string coincide con el regex
    return gmailRegex.test(String(email).toLowerCase());
}