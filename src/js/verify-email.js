// src/js/verify-email.js
import { auth } from './firebase-init.js';
import { onAuthStateChanged, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

/**
 * @file verify-email.js
 * Lógica para la verificación de correo electrónico y reenvío en la página de verificación.
 */
document.addEventListener('DOMContentLoaded', () => {
    const userEmailElement = document.getElementById('userEmail');
    const resendEmailBtn = document.getElementById('resendEmailBtn');
    const verificationMessageElement = document.getElementById('verificationMessage');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const logoutBtn = document.getElementById('logoutBtn');

    let verificationCheckInterval; // Para guardar el intervalo de chequeo

    // Observador del estado de autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuario está logueado
            console.log('Usuario actual:', user.email, 'Verificado:', user.emailVerified);
            userEmailElement.textContent = user.email; // Mostrar el email

            if (user.emailVerified) {
                // Si YA está verificado, redirigir inmediatamente
                console.log('Correo ya verificado. Redirigiendo al dashboard...');
                clearInterval(verificationCheckInterval); // Detener chequeos
                window.location.href = 'dashboard.html';
            } else {
                // Si NO está verificado, empezar a chequear periódicamente
                startVerificationCheck(user);
                loadingSpinner.style.display = 'block'; // Mostrar spinner
            }
        } else {
            // No hay usuario logueado, redirigir al login
            console.log('No hay usuario logueado. Redirigiendo a signin...');
            clearInterval(verificationCheckInterval); // Detener chequeos
            window.location.href = 'signin.html';
        }
    });

    // Botón para reenviar correo
    if (resendEmailBtn) {
        resendEmailBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    resendEmailBtn.disabled = true; // Deshabilitar mientras se envía
                    resendEmailBtn.textContent = 'Enviando...';
                    await sendEmailVerification(user);
                    verificationMessageElement.textContent = `Se ha reenviado un correo a ${user.email}. Por favor, revisa tu bandeja de entrada.`;
                    console.log('Correo de verificación reenviado.');
                    // Rehabilitar después de un tiempo para evitar spam
                    setTimeout(() => {
                         resendEmailBtn.disabled = false;
                         resendEmailBtn.textContent = 'Reenviar Correo';
                    }, 30000); // Esperar 30 segundos
                } catch (error) {
                    console.error("Error al reenviar correo:", error);
                    verificationMessageElement.textContent = "Error al reenviar el correo. Intenta de nuevo más tarde.";
                    resendEmailBtn.disabled = false;
                    resendEmailBtn.textContent = 'Reenviar Correo';
                }
            }
        });
    }
    
    // Botón de logout
     if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                clearInterval(verificationCheckInterval); // Detener chequeos al salir
                window.location.href = 'signin.html';
            });
        });
    }

    /**
     * Inicia el chequeo periódico del estado de verificación del usuario.
     *
     * @param {import('firebase/auth').User} currentUser - Usuario actual de Firebase Auth.
     */
    function startVerificationCheck(currentUser) {
        // Limpiar intervalo anterior si existe
        clearInterval(verificationCheckInterval);

        // Chequear cada 5 segundos
        verificationCheckInterval = setInterval(async () => {
            try {
                // Recargar el estado del usuario desde Firebase
                await currentUser.reload();
                const freshUser = auth.currentUser; // Obtener el estado más reciente

                console.log('Chequeando verificación...', freshUser.emailVerified);

                if (freshUser && freshUser.emailVerified) {
                    // ¡Verificado! Detener el chequeo y redirigir
                    console.log('¡Correo verificado! Redirigiendo al dashboard...');
                    clearInterval(verificationCheckInterval);
                    loadingSpinner.style.display = 'none'; // Ocultar spinner
                    window.location.href = 'dashboard.html';
                }
                // Si no está verificado, el intervalo continuará
            } catch (error) {
                console.error("Error recargando estado del usuario:", error);
                // Podría ser un error de red, no necesariamente detener el chequeo
            }
        }, 5000); // 5000 ms = 5 segundos
    }
    
     // Limpiar intervalo si el usuario navega fuera de la página
     window.addEventListener('beforeunload', () => {
        clearInterval(verificationCheckInterval);
    });

});