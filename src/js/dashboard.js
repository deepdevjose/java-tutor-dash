// Importar módulos de Firebase Auth y Firestore
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js"; // Import signOut
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * @file dashboard.js
 * Lógica principal para la página del dashboard.
 * Integrado con Firebase Auth y Firestore, incluye cierre de sesión por inactividad y verificación de correo.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DE AUTENTICACIÓN Y CARGA DE DATOS ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- USUARIO AUTENTICADO ---
            console.log('Usuario autenticado:', user.uid);

            // --- ¡COMPROBACIÓN DE CORREO VERIFICADO ACTUALIZADA AQUÍ! ---
            if (user.emailVerified) {
                // SI está verificado -> Cargar Dashboard
                console.log('Correo verificado. Cargando dashboard...');
                loadDashboardData(user.uid);
                startInactivityMonitoring();
            } else {
                // NO está verificado -> Redirigir a página de verificación
                console.warn('Correo NO verificado. Redirigiendo a verify-email.html...');
                // Opcional: Mostrar un mensaje antes de redirigir
                // alert("Tu correo electrónico aún no ha sido verificado. Serás redirigido para verificarlo.");
                window.location.href = 'verify-email.html'; // Lo mandamos a verificar
            }
            // --- FIN COMPROBACIÓN ---

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
                testsPassed: userData.testsPassed || 0,
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
            // signOut(auth);
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

    const toggleSidebar = () => {
        const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', !isCurrentlyCollapsed);
    };

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    if (mobileSidebarToggle) {
         mobileSidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Cargar estado inicial
    const isMobile = window.innerWidth <= 1024;
    const savedStateCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isMobile) {
        sidebar.classList.add('collapsed'); // Empezar oculto en móvil
        // No forzar LS en móvil aquí, puede causar conflicto si se redimensiona
    } else {
        if (savedStateCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }

    // Submenús
    submenuItems.forEach(item => {
        const link = item.querySelector('a');
        link.addEventListener('click', (e) => {
            // Solo permitir expansión/colapso de submenú si el sidebar NO está colapsado
            if (!sidebar.classList.contains('collapsed')) {
                 e.preventDefault();
                 item.classList.toggle('submenu-open');
            } else {
                 // Si está colapsado Y es móvil, expandir sidebar al clickear submenú
                 if (isMobile) {
                    e.preventDefault(); // Evitar navegación
                    sidebar.classList.remove('collapsed');
                    localStorage.setItem('sidebarCollapsed', 'false');
                 }
                 // En desktop colapsado, los enlaces deberían funcionar (si tienen href)
            }
        });
    });

    // Logout
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                console.log('Usuario cerró sesión manualmente');
                window.location.href = 'signin.html';
            }).catch((error) => {
                console.error('Error al cerrar sesión:', error);
            });
        });
     }
}


/**
 * Carga datos del perfil (nombre y avatar de GitHub) en la UI.
 * @param {object} userData - Datos del documento de Firestore.
 */
async function loadUserData(userData) {
    const fullName = `${userData.firstName || ''} ${userData.apellidoPaterno || ''}`.trim();
    const userNameElement = document.getElementById('userName');
    if (userNameElement) userNameElement.textContent = fullName || 'Usuario';

    const userAvatarElement = document.getElementById('userAvatar');
    const githubUsername = userData.githubUsername;
    const defaultAvatar = 'https://via.placeholder.com/40'; // URL por defecto

    if (userAvatarElement && githubUsername) {
        try {
            const response = await fetch(`https://api.github.com/users/${githubUsername}`);
            if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
            const githubData = await response.json();
            if (githubData.avatar_url) {
                userAvatarElement.src = githubData.avatar_url;
                console.log('Avatar de GitHub cargado:', githubData.avatar_url);
            } else {
                 userAvatarElement.src = defaultAvatar;
            }
        } catch (error) {
            console.error("Error al obtener avatar de GitHub:", error);
            userAvatarElement.src = defaultAvatar;
        }
    } else if (userAvatarElement) {
        userAvatarElement.src = defaultAvatar;
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
    if (totalExercisesEl) totalExercisesEl.textContent = stats.totalExercises;

    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = '0%';
        requestAnimationFrame(() => { requestAnimationFrame(() => { progressFill.style.width = stats.courseProgress + '%'; }); });
    }
}


/**
 * Anima un número de inicio a fin en un elemento HTML.
 */
function animateCounter(elementId, start, end, duration, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;
    const finalValue = (isNaN(end) || end === undefined) ? 0 : end;
    const range = finalValue - start;
    if (range === 0) { element.textContent = start + suffix; return; }
    let startTime = null;
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        const current = start + (range * Math.min(progress / duration, 1));
        element.textContent = Math.floor(current) + suffix;
        if (progress < duration) { requestAnimationFrame(step); }
        else { element.textContent = finalValue + suffix; }
    }
    requestAnimationFrame(step);
}


/**
 * Actualiza la información del último commit (simulado).
 */
function updateLastCommit(userData) {
    const lastCommitDateEl = document.getElementById('lastCommitDate');
    const lastActivityTimeEl = document.getElementById('lastActivityTime');
    const lastAttemptTimeEl = document.getElementById('lastAttemptTime');
    const githubUser = userData.githubUsername || 'usuario';
    const now = new Date();
    const simulatedDate = new Date(now - Math.random() * 5 * 60 * 60 * 1000);
    const formattedDate = formatRelativeTime(simulatedDate);
    if (lastCommitDateEl) lastCommitDateEl.textContent = `Commit de @${githubUser}`;
    if (lastActivityTimeEl) lastActivityTimeEl.textContent = formattedDate;
    if (lastAttemptTimeEl) {
        const attemptDate = new Date(simulatedDate.getTime() + 15 * 60 * 1000);
        lastAttemptTimeEl.textContent = formatRelativeTime(attemptDate);
    }
}


/**
 * Formatea una fecha a tiempo relativo.
 */
function formatRelativeTime(date) {
    if (!(date instanceof Date) || isNaN(date)) return "Fecha inválida";
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
    signOut(auth).then(() => {
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
    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, { capture: true, passive: true });
    });
    resetInactivityTimer(); // Inicia el temporizador
    console.log("Monitoreo de inactividad iniciado.");
}
// --- Fin de la lógica de inactividad ---