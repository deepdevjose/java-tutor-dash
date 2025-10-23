/**
 * @file dashboard.js
 * Lógica para el dashboard, incluyendo el menú lateral colapsable y animaciones.
 */
document.addEventListener('DOMContentLoaded', () => {

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
    }

    // 2. Cargar estado del menú desde localStorage
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }

    // 3. Manejar la apertura y cierre de submenús
    submenuItems.forEach(item => {
        const link = item.querySelector('a');
        link.addEventListener('click', (e) => {
            // Prevenir navegación si el menú está colapsado
            if (sidebar.classList.contains('collapsed')) {
                 e.preventDefault();
                 sidebar.classList.remove('collapsed'); // Expandir al hacer click
            }
            
            // Si no está colapsado, abrir submenú
            if (!sidebar.classList.contains('collapsed')) {
                e.preventDefault();
                item.classList.toggle('submenu-open');
            }
        });
    });

    // 4. Cargar datos del usuario desde localStorage
    loadUserData();

    // 5. Simular datos del dashboard (datos de ejemplo)
    animateStats();

    // 6. Actualizar fecha del último commit (simulado)
    updateLastCommit();
});

/**
 * Cargar datos del usuario desde localStorage
 */
function loadUserData() {
    const userName = localStorage.getItem('userName') || 'DeepDevJose';
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userName;
    }
}

/**
 * Animar las estadísticas con efecto de conteo
 */
function animateStats() {
    // Datos de ejemplo (en producción, estos vendrían de Firebase)
    const stats = {
        testsPassed: 28,
        testsFailed: 7,
        testsTotal: 35,
        successRate: 80,
        courseProgress: 56,
        completedExercises: 28,
        totalExercises: 50
    };

    // Animar cada estadística
    animateCounter('testsPassed', 0, stats.testsPassed, 1500);
    animateCounter('testsFailed', 0, stats.testsFailed, 1500);
    animateCounter('testsTotal', 0, stats.testsTotal, 1500);
    animateCounter('successRate', 0, stats.successRate, 2000, '%');
    animateCounter('courseProgress', 0, stats.courseProgress, 2000, '%');
    animateCounter('completedExercises', 0, stats.completedExercises, 1500);

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
 */
function animateCounter(elementId, start, end, duration, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;

    const range = end - start;
    const increment = range / (duration / 16); // 60 FPS
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current) + suffix;
    }, 16);
}

/**
 * Actualizar información del último commit (simulado)
 */
function updateLastCommit() {
    // En producción, esto vendría de la API de GitHub
    const lastCommitDate = document.getElementById('lastCommitDate');
    const lastActivityTime = document.getElementById('lastActivityTime');
    const lastAttemptTime = document.getElementById('lastAttemptTime');

    // Fecha de ejemplo (hace 2 horas)
    const now = new Date();
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
    const formattedDate = formatRelativeTime(twoHoursAgo);

    if (lastCommitDate) {
        lastCommitDate.textContent = formattedDate;
    }
    if (lastActivityTime) {
        lastActivityTime.textContent = formattedDate;
    }
    if (lastAttemptTime) {
        lastAttemptTime.textContent = 'Hace 30 minutos';
    }
}

/**
 * Formatear tiempo relativo (ej: "Hace 2 horas")
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