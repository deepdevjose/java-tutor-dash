
// Import firebase auth and firestore modules

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * @file dashboard.js
 * Principal logic from the dashboard page.
 * Now integrated with Firebase Auth and Firestore.
 */
document.addEventListener('DOMContentLoaded', () => {

    // Authentication state observer

    // onAuthStateChanged es el "vigilante" de Firebase.
    // Se dispara CADA VEZ que la página carga o el estado de login cambia.
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- 1. USUARIO AUTENTICADO ---
            console.log('Usuario autenticado:', user.uid);
            // El usuario ha iniciado sesión. Ahora podemos cargar sus datos.
            loadDashboardData(user.uid);

        } else {
            // --- 2. USUARIO NO AUTENTICADO ---
            // No hay nadie logueado. Proteger esta página.
            console.log('Usuario no autenticado. Redirigiendo a signin...');
            // Redirigir a la página de inicio de sesión
            window.location.href = 'signin.html';
        }
    });

    // --- LÓGICA DEL MENÚ LATERAL ---
    setupSidebar();
});


/**
 * NUEVO: Carga todos los datos del dashboard desde Firebase.
 * Esta función se llama una vez que sabemos QUIÉN es el usuario (tenemos su UID).
 * @param {string} uid - El ID de usuario único de Firebase Auth.
 */
function loadDashboardData(uid) {

    // 1. Apuntar al documento del usuario en Firestore
    // Creamos una referencia al documento: coleccion "usuarios" -> documento "uid"
    const userDocRef = doc(db, 'usuarios', uid);

    // 2. Suscribirse a los cambios de ese documento en TIEMPO REAL
    // onSnapshot es la magia de Firestore. Se dispara:
    //    a) Una vez al cargar, con los datos actuales.
    //    b) CADA VEZ que esos datos cambien en el servidor.
    onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            // El documento existe, ¡tenemos datos!
            const userData = doc.data();
            console.log("Datos del usuario recibidos:", userData);

            // 3. Actualizar la UI con los datos REALES

            // Cargar datos del perfil (nombre, etc.)
            loadUserData(userData);

            // Cargar estadísticas (aún simuladas, pero listas para conectar)
            // TODO: Reemplazar 'stats' con datos de userData cuando existan
            const stats = {
                testsPassed: userData.testsPassed || 28, // Usar datos de FB o simular
                testsFailed: userData.testsFailed || 7,
                testsTotal: userData.testsTotal || 35,
                successRate: userData.successRate || 80,
                courseProgress: userData.courseProgress || 56,
                completedExercises: userData.completedExercises || 28,
                totalExercises: 50 // Este puede ser un valor fijo
            };
            animateStats(stats); // Pasar los datos reales (o simulados)

            // Actualizar fecha del último commit (aún simulado)
            // TODO: Reemplazar esto con la llamada a la Cloud Function
            updateLastCommit(userData);

        } else {
            // Esto no debería pasar si el registro fue exitoso
            console.error("Error: No se encontró el documento del usuario en Firestore.");
            alert("Hubo un error al cargar tu perfil. Contacta a soporte.");
            // Opcional: desloguear al usuario
            // auth.signOut();
        }
    }, (error) => {
        // Manejar errores de lectura de Firestore
        console.error("Error al obtener datos de Firestore:", error);
        alert("Error de conexión. No se pudieron cargar tus datos.");
    });
}


/**
 * Configura la lógica del menú lateral (sidebar).
 */
function setupSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const submenuItems = document.querySelectorAll('.has-submenu');

    // 1. Toggle para colapsar/expandir el menú
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');

            // Guardar preferencia en localStorage
            if (sidebar.classList.contains('collapsed')) {
                localStorage.setItem('sidebarCollapsed', 'true');
            } else {
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        });
        // Dentro de setupSidebar()
        const logoutLink = document.querySelector('.logout-link');
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault(); // Prevenir que el enlace navegue
                auth.signOut().then(() => {
                    console.log('Usuario cerró sesión');
                    window.location.href = 'signin.html'; // Redirigir DESPUÉS de cerrar sesión
                }).catch((error) => {
                    console.error('Error al cerrar sesión:', error);
                });
            });
        }
    }

    // 2. Cargar estado del menú desde localStorage
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }

    // 3. Manejar la apertura y cierre de submenús
    submenuItems.forEach(item => {
        const link = item.querySelector('a');
        link.addEventListener('click', (e) => {
            if (sidebar.classList.contains('collapsed')) {
                e.preventDefault();
                sidebar.classList.remove('collapsed');
            }

            if (!sidebar.classList.contains('collapsed')) {
                e.preventDefault();
                item.classList.toggle('submenu-open');
            }
        });
    });
}

/**
 * ACTUALIZADO: Cargar datos del perfil del usuario.
 * @param {object} userData - El objeto de datos del documento de Firestore.
 */
function loadUserData(userData) {
    // Combinar nombre y apellidos
    const fullName = `${userData.firstName} ${userData.apellidoPaterno}`;

    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = fullName;
    }

    // (Opcional) Guardar en localStorage si aún lo quieres
    localStorage.setItem('userName', fullName);
}

/**
 * ACTUALIZADO: Animar las estadísticas con datos reales (o simulados si no existen).
 * @param {object} stats - Objeto con todas las estadísticas a mostrar.
 */
function animateStats(stats) {
    // Animar cada estadística
    animateCounter('testsPassed', 0, stats.testsPassed, 1500);
    animateCounter('testsFailed', 0, stats.testsFailed, 1500);
    animateCounter('testsTotal', 0, stats.testsTotal, 1500);
    animateCounter('successRate', 0, stats.successRate, 2000, '%');
    animateCounter('courseProgress', 0, stats.courseProgress, 2000, '%');
    animateCounter('completedExercises', 0, stats.completedExercises, 1500);

    // Actualizar el "total" de ejercicios
    const totalExercisesEl = document.getElementById('totalExercises');
    if (totalExercisesEl) {
        totalExercisesEl.textContent = stats.totalExercises;
    }

    // Animar barra de progreso
    setTimeout(() => {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = stats.courseProgress + '%';
        }
    }, 500);
}

/**
 * Animar contador con efecto de incremento
 * (Función sin cambios)
 */
function animateCounter(elementId, start, end, duration, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;

    const range = end - start;
    // Evitar división por cero si la duración es muy corta o el rango es 0
    if (range === 0) {
        element.textContent = start + suffix;
        return;
    }

    const increment = range / (duration / 16); // 60 FPS
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current) + suffix;
    }, 16);
}

/**
 * ACTUALIZADO: Actualizar información del último commit (simulado por ahora).
 * @param {object} userData - El objeto de datos del usuario.
 */
function updateLastCommit(userData) {
    // TODO: Reemplazar esto con la llamada a la Cloud Function
    // Por ahora, leemos el 'githubUsername' de la BD

    const lastCommitDate = document.getElementById('lastCommitDate');
    const lastActivityTime = document.getElementById('lastActivityTime');
    const lastAttemptTime = document.getElementById('lastAttemptTime');

    // Usamos el 'githubUsername' de la base de datos
    const githubUser = userData.githubUsername || 'usuario';

    // Fecha de ejemplo (hace 2 horas)
    const now = new Date();
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
    const formattedDate = formatRelativeTime(twoHoursAgo);

    if (lastCommitDate) {
        lastCommitDate.textContent = `Commit de @${githubUser}`;
    }
    if (lastActivityTime) {
        lastActivityTime.textContent = formattedDate;
    }
    if (lastAttemptTime) {
        lastAttemptTime.textContent = 'Hace 30 minutos'; // (Esto seguiría siendo simulado)
    }
}

/**
 * Formatear tiempo relativo (ej: "Hace 2 horas")
 * (Función sin cambios)
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return 'Hace unos segundos';
}