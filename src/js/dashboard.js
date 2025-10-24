// Importar módulos de Firebase Auth y Firestore
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js"; // Import signOut
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * @file dashboard.js
 * Lógica principal para la página del dashboard.
 * Integrado con Firebase Auth y Firestore, incluye cierre de sesión por inactividad.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DE AUTENTICACIÓN Y CARGA DE DATOS ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- USUARIO AUTENTICADO ---
            console.log('Usuario autenticado:', user.uid);
            loadDashboardData(user.uid);
            startInactivityMonitoring(); // <--- INICIAR MONITOREO DE INACTIVIDAD
        } else {
            // --- USUARIO NO AUTENTICADO ---
            console.log('Usuario no autenticado. Redirigiendo a signin...');
            window.location.href = 'signin.html';
        }
    });

    // --- LÓGICA DEL MENÚ LATERAL ---
    setupSidebar();
});


/**
 * Carga los datos del dashboard desde Firestore en tiempo real.
 * @param {string} uid - El ID de usuario único de Firebase Auth.
 */
function loadDashboardData(uid) {
    const userDocRef = doc(db, 'usuarios', uid);

    onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            console.log("Datos del usuario recibidos:", userData);

            // Actualizar UI
            loadUserData(userData);
            const stats = {
                testsPassed: userData.testsPassed || 0, // Usar 0 como default si no existe
                testsFailed: userData.testsFailed || 0,
                testsTotal: userData.testsTotal || 0,
                successRate: userData.successRate || 0,
                courseProgress: userData.courseProgress || 0,
                completedExercises: userData.completedExercises || 0,
                totalExercises: 50 // O un valor de la BD si lo tienes
            };
            animateStats(stats);
            updateLastCommit(userData); // Aún simulado

        } else {
            console.error("Error: No se encontró el documento del usuario en Firestore.");
            alert("Hubo un error al cargar tu perfil. Contacta a soporte.");
            // signOut(auth); // Descomentar para desloguear si el perfil no existe
        }
    }, (error) => {
        console.error("Error al obtener datos de Firestore:", error);
        alert("Error de conexión. No se pudieron cargar tus datos.");
    });
}


/**
 * Configura la lógica del menú lateral (sidebar) y el botón de logout.
 */
function setupSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle'); // Desktop
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle'); // Mobile
    const submenuItems = document.querySelectorAll('.has-submenu');
    const logoutLink = document.querySelector('.logout-link');

    // Función unificada para mostrar/ocultar
    const toggleSidebar = () => {
        const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');

        // Acción principal: Añadir o quitar la clase
        sidebar.classList.toggle('collapsed');

        // Actualizar localStorage (solo relevante para desktop, pero no hace daño)
        localStorage.setItem('sidebarCollapsed', !isCurrentlyCollapsed); 
    };

    // Listener para Desktop
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Listener para Móvil
    if (mobileSidebarToggle) {
         mobileSidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Cargar estado inicial
    const isMobile = window.innerWidth <= 1024;
    const savedStateCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

    if (isMobile) {
        // En móvil, SIEMPRE empezar OCULTO
        sidebar.classList.add('collapsed');
        localStorage.setItem('sidebarCollapsed', 'true'); // Sincronizar LS
    } else {
        // En desktop, cargar estado guardado
        if (savedStateCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }

    // Submenús (sin cambios)
    submenuItems.forEach(item => { /* ... */ });
    // Logout (sin cambios)
    if (logoutLink) { /* ... */ }
}

/**
 * ACTUALIZADO: Carga datos del perfil (nombre y avatar de GitHub) en la UI.
 * @param {object} userData - Datos del documento de Firestore.
 */
async function loadUserData(userData) { // <-- Añadir 'async' aquí
    // Cargar Nombre
    const fullName = `${userData.firstName || ''} ${userData.apellidoPaterno || ''}`.trim();
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = fullName || 'Usuario';
    }

    // Cargar Avatar de GitHub
    const userAvatarElement = document.getElementById('userAvatar');
    const githubUsername = userData.githubUsername;

    if (userAvatarElement && githubUsername) {
        try {
            // Hacer la llamada a la API pública de GitHub
            const response = await fetch(`https://api.github.com/users/${githubUsername}`);

            if (!response.ok) {
                // Si el usuario no existe en GitHub o hay otro error
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const githubData = await response.json();

            // Actualizar la imagen si obtenemos la URL del avatar
            if (githubData.avatar_url) {
                userAvatarElement.src = githubData.avatar_url;
                console.log('Avatar de GitHub cargado:', githubData.avatar_url);
            } else {
                // Mantener placeholder si no hay avatar_url
                userAvatarElement.src = 'https://via.placeholder.com/40';
            }

        } catch (error) {
            console.error("Error al obtener avatar de GitHub:", error);
            // Si falla la API, mantener la imagen de placeholder
            userAvatarElement.src = 'https://via.placeholder.com/40';
        }
    } else if (userAvatarElement) {
        // Si no hay githubUsername en Firestore, mantener placeholder
        userAvatarElement.src = 'https://via.placeholder.com/40';
    }
}

/**
 * Anima las estadísticas en la UI.
 * @param {object} stats - Objeto con las estadísticas.
 */
function animateStats(stats) {
    animateCounter('testsPassed', 0, stats.testsPassed, 1500);
    animateCounter('testsFailed', 0, stats.testsFailed, 1500);
    animateCounter('testsTotal', 0, stats.testsTotal, 1500);
    animateCounter('successRate', 0, stats.successRate, 2000, '%');
    animateCounter('courseProgress', 0, stats.courseProgress, 2000, '%');
    animateCounter('completedExercises', 0, stats.completedExercises, 1500);

    const totalExercisesEl = document.getElementById('totalExercises');
    if (totalExercisesEl) {
        totalExercisesEl.textContent = stats.totalExercises;
    }

    // Animar barra de progreso (sin setTimeout innecesario)
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        // Forzar reflow para reiniciar animación si el valor es el mismo
        progressFill.style.width = '0%';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { // Doble requestAnimationFrame para asegurar
                progressFill.style.width = stats.courseProgress + '%';
            });
        });
    }
}

/**
 * Anima un número de inicio a fin en un elemento HTML.
 */
function animateCounter(elementId, start, end, duration, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Si el valor final es NaN o undefined, mostrar 0 o un guión
    const finalValue = (isNaN(end) || end === undefined) ? 0 : end;

    const range = finalValue - start;
    if (range === 0) {
        element.textContent = start + suffix;
        return;
    }

    const increment = range / (duration / 16); // Apunta a ~60 FPS
    let current = start;
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        current = start + (range * Math.min(progress / duration, 1)); // Usa progreso basado en tiempo

        element.textContent = Math.floor(current) + suffix;

        if (progress < duration) {
            requestAnimationFrame(step); // Llama al siguiente frame
        } else {
            element.textContent = finalValue + suffix; // Asegurar valor final exacto
        }
    }
    requestAnimationFrame(step); // Inicia la animación
}


/**
 * Actualiza la información del último commit (simulado).
 * @param {object} userData - Datos del usuario.
 */
function updateLastCommit(userData) {
    const lastCommitDateEl = document.getElementById('lastCommitDate');
    const lastActivityTimeEl = document.getElementById('lastActivityTime');
    const lastAttemptTimeEl = document.getElementById('lastAttemptTime');
    const githubUser = userData.githubUsername || 'usuario';

    // Fecha simulada
    const now = new Date();
    const simulatedDate = new Date(now - Math.random() * 5 * 60 * 60 * 1000); // Hasta 5 horas atrás
    const formattedDate = formatRelativeTime(simulatedDate);

    if (lastCommitDateEl) {
        lastCommitDateEl.textContent = `Commit de @${githubUser}`; // Mantenemos esto
    }
    if (lastActivityTimeEl) {
        lastActivityTimeEl.textContent = formattedDate; // Usamos fecha simulada
    }
    if (lastAttemptTimeEl) {
        // Simular intento un poco después del commit
        const attemptDate = new Date(simulatedDate.getTime() + 15 * 60 * 1000);
        lastAttemptTimeEl.textContent = formatRelativeTime(attemptDate);
    }
}

/**
 * Formatea una fecha a tiempo relativo (ej: "Hace 2 horas").
 */
function formatRelativeTime(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return "Fecha inválida"; // Manejar fechas inválidas
    }
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 5) return 'Ahora mismo';
    if (minutes < 1) return `Hace ${seconds} seg.`;
    if (hours < 1) return `Hace ${minutes} min.`;
    if (days < 1) return `Hace ${hours} hr${hours > 1 ? 's' : ''}`;
    return `Hace ${days} día${days > 1 ? 's' : ''}`;
}


// --- LÓGICA DE CIERRE DE SESIÓN POR INACTIVIDAD ---
let inactivityTimer;
const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutos

function logoutDueToInactivity() {
    console.log("Cerrando sesión por inactividad...");
    signOut(auth).then(() => { // Usar la función importada signOut
        alert("Tu sesión ha expirado por inactividad.");
        window.location.href = 'signin.html';
    }).catch((error) => {
        console.error('Error al cerrar sesión por inactividad:', error);
    });
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT);
}

function startInactivityMonitoring() {
    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click']; // Añadir 'click'

    // Usar 'once: true' y re-agregar listener puede ser más eficiente para algunos eventos
    activityEvents.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, { capture: true, passive: true });
    });

    resetInactivityTimer(); // Inicia el temporizador
    console.log("Monitoreo de inactividad iniciado.");
}
// --- Fin de la lógica de inactividad ---