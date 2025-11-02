// Importar módulos de Firebase Auth y Firestore
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * @file dashboard.js
 * Lógica principal para la página del dashboard.
 * Integrado con Firebase Auth y Firestore, incluye cierre de sesión por inactividad y verificación de correo.
 */

// --- UTILIDADES DE LOGGING (Entorno-aware) ---
/**
 * Detecta si la aplicación corre en entorno de desarrollo.
 * @returns {boolean} True si está en localhost o 127.0.0.1
 */
const isDevelopment = () => {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
};

/**
 * Log de depuración (solo en desarrollo).
 * @param {...any} args - Argumentos a loguear
 */
const logDebug = (...args) => {
    if (isDevelopment()) console.log(...args);
};

/**
 * Log de información (solo en desarrollo).
 * @param {...any} args - Argumentos a loguear
 */
const logInfo = (...args) => {
    if (isDevelopment()) console.info(...args);
};

/**
 * Log de advertencia (solo en desarrollo).
 * @param {...any} args - Argumentos a loguear
 */
const logWarn = (...args) => {
    if (isDevelopment()) console.warn(...args);
};

/**
 * Log de error (solo en desarrollo, sin exponer detalles en producción).
 * @param {...any} args - Argumentos a loguear
 */
const logError = (...args) => {
    if (isDevelopment()) console.error(...args);
};

// --- ESTADO GLOBAL Y CLEANUP ---
let unsubscribeSnapshot = null;
let unsubscribeAuth = null;
let inactivityListeners = [];
let avatarCache = new Map(); // Cache para avatares de GitHub

document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DE AUTENTICACIÓN Y CARGA DE DATOS ---
    unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- USUARIO AUTENTICADO ---
            logDebug('✅ Usuario autenticado');

            // --- COMPROBACIÓN DE CORREO VERIFICADO ---
            if (user.emailVerified) {
                // SI está verificado -> Cargar Dashboard
                logDebug('✅ Correo verificado. Cargando dashboard...');
                loadDashboardData(user.uid);
                startInactivityMonitoring();
            } else {
                // NO está verificado -> Redirigir a página de verificación
                logWarn('⚠️ Correo NO verificado. Redirigiendo a verificación...');
                cleanupBeforeNavigation();
                window.location.href = 'verify-email.html';
            }

        } else {
            // --- USUARIO NO AUTENTICADO ---
            logDebug('❌ Usuario no autenticado. Redirigiendo a signin...');
            cleanupBeforeNavigation();
            window.location.href = 'signin.html';
        }
    });

    // --- LÓGICA DEL MENÚ LATERAL ---
    setupSidebar();

    // --- CONTROL MULTI-TAB: Detectar logout en otra pestaña ---
    window.addEventListener('storage', handleStorageChange);
});


/**
 * Carga los datos del dashboard desde Firestore en tiempo real.
 *
 * @param {string} uid - El ID de usuario único de Firebase Auth.
 * @returns {void}
 */
function loadDashboardData(uid) {
    const userDocRef = doc(db, 'usuarios', uid);
    
    // Mostrar skeleton loaders
    showSkeletonLoaders();

    unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            logDebug("✅ Datos del usuario cargados desde Firestore");

            // Actualizar UI con datos del perfil
            loadUserData(userData);
            updateLastCommit(userData);
            
            // Verificar si es administrador y mostrar enlace al panel admin
            checkAdminAccess(uid);
            
            // Cargar estadísticas de ejercicios desde la colección results
            loadExerciseStatistics(uid);
            
            // Cargar envíos recientes
            loadRecentSubmissions(uid);
            
            // Mostrar toast de bienvenida (solo la primera vez)
            if (!sessionStorage.getItem('welcomeShown')) {
                setTimeout(() => {
                    showToast('success', '¡Bienvenido!', `Hola ${userData.firstName || 'Usuario'}, tus datos están actualizados.`);
                    sessionStorage.setItem('welcomeShown', 'true');
                }, 500);
            }

        } else {
            hideSkeletonLoaders();
            logError("❌ Error: No se encontró el documento del usuario en Firestore");
            showUserFriendlyError("No se pudo cargar tu perfil. Por favor, intenta recargar la página.");
        }
    }, (error) => {
        hideSkeletonLoaders();
        logError("❌ Error al obtener datos de Firestore:", error.code);
        showUserFriendlyError("Error de conexión. Verifica tu internet y recarga la página.");
    });
}


/**
 * Verifica si el usuario actual es administrador y muestra el enlace al panel admin
 * 
 * @param {string} uid - UID del usuario autenticado
 * @returns {void}
 */
async function checkAdminAccess(uid) {
    try {
        // Obtener el email del usuario desde Auth
        const user = auth.currentUser;
        if (!user || !user.email) return;
        
        // Verificar si existe en la colección de admins
        const adminDoc = await getDoc(doc(db, 'admins', user.email));
        
        if (adminDoc.exists()) {
            // Es administrador, mostrar el enlace
            const adminMenuItem = document.getElementById('adminMenuItem');
            if (adminMenuItem) {
                adminMenuItem.style.display = 'block';
                logDebug('✅ Usuario es administrador, mostrando enlace al panel admin');
            }
        }
    } catch (error) {
        logDebug('⚠️ Error al verificar acceso de admin:', error.code);
        // No hacer nada, simplemente no mostrar el enlace
    }
}


/**
 * Carga y monitorea las estadísticas de ejercicios desde la colección results.
 * Calcula: ejercicios completados, puntos totales, tests pasados, progreso del curso.
 *
 * @param {string} uid - UID del usuario autenticado.
 * @returns {void}
 */
async function loadExerciseStatistics(uid) {
    logInfo("📈 Cargando estadísticas de ejercicios para UID:", uid);

    try {
        // Listener en tiempo real para results del usuario
        const resultsQuery = query(
            collection(db, 'results'),
            where('userId', '==', uid)
        );

        onSnapshot(resultsQuery, async (resultsSnapshot) => {
            logDebug(`✅ ${resultsSnapshot.size} resultados encontrados`);

            // Agrupar resultados por exerciseId y quedarnos solo con el más reciente de cada uno
            const latestResultsByExercise = new Map();
            
            resultsSnapshot.forEach(doc => {
                const result = doc.data();
                const exerciseId = result.exerciseId;
                const completedAt = result.completedAt?.toDate() || new Date(0);
                
                // Si no existe o este es más reciente, lo guardamos
                if (!latestResultsByExercise.has(exerciseId)) {
                    latestResultsByExercise.set(exerciseId, { ...result, docId: doc.id, completedAt });
                } else {
                    const existing = latestResultsByExercise.get(exerciseId);
                    if (completedAt > existing.completedAt) {
                        latestResultsByExercise.set(exerciseId, { ...result, docId: doc.id, completedAt });
                    }
                }
            });

            logDebug(`🎯 Ejercicios únicos encontrados: ${latestResultsByExercise.size}`);

            // Calcular estadísticas solo con los últimos intentos
            const completedExerciseIds = new Set();
            let totalTestsPassed = 0;
            let totalTestsFailed = 0;

            latestResultsByExercise.forEach((result, exerciseId) => {
                // Extraer valores con manejo robusto
                const testsPassed = parseInt(result.testsPassed) || 0;
                const testsFailed = parseInt(result.testsFailed) || 0;
                const testsRun = parseInt(result.testsRun) || 0;
                
                // Si testsRun existe pero testsPassed/testsFailed no, calcular
                let finalTestsPassed = testsPassed;
                let finalTestsFailed = testsFailed;
                
                if (testsRun > 0 && (testsPassed === 0 && testsFailed === 0)) {
                    // Si status es success, todos pasaron
                    if (result.status === 'success') {
                        finalTestsPassed = testsRun;
                        finalTestsFailed = 0;
                    } else {
                        // Si hay error pero no sabemos cuántos fallaron, marcar todos como fallidos
                        finalTestsPassed = 0;
                        finalTestsFailed = testsRun;
                    }
                }
                
                logDebug(`📊 Ejercicio ${exerciseId}:`, {
                    status: result.status,
                    testsPassed: result.testsPassed,
                    testsFailed: result.testsFailed,
                    testsRun: result.testsRun,
                    finalTestsPassed,
                    finalTestsFailed
                });
                
                if (result.status === 'success') {
                    completedExerciseIds.add(exerciseId);
                }
                
                totalTestsPassed += finalTestsPassed;
                totalTestsFailed += finalTestsFailed;
            });

            const completedCount = completedExerciseIds.size;
            logDebug(`✅ Ejercicios completados exitosamente: ${completedCount}`);

            // Obtener puntos de los ejercicios completados
            let totalPoints = 0;
            if (completedCount > 0) {
                const exercisesQuery = query(collection(db, 'exercises'));
                const exercisesSnapshot = await getDocs(exercisesQuery);
                
                exercisesSnapshot.forEach(doc => {
                    const exercise = doc.data();
                    if (completedExerciseIds.has(doc.id)) {
                        // Intentar leer el campo points con varios formatos posibles
                        let points = exercise.points || exercise[' points'] || exercise['"points"'] || 0;
                        
                        // Convertir a número si es string
                        if (typeof points === 'string') {
                            points = parseInt(points.replace(/['"]/g, ''), 10) || 0;
                        }
                        
                        logDebug(`💎 Ejercicio ${doc.id}: ${points} puntos`);
                        totalPoints += points;
                    }
                });
            }

            logDebug(`💰 Puntos totales calculados: ${totalPoints}`);

            // Obtener total de ejercicios para calcular progreso
            const totalExercisesSnapshot = await getDocs(collection(db, 'exercises'));
            const totalExercises = totalExercisesSnapshot.size;

            // Calcular estadísticas
            const testsTotal = totalTestsPassed + totalTestsFailed;
            const successRate = testsTotal > 0 ? Math.round((totalTestsPassed / testsTotal) * 100) : 0;
            const courseProgress = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;

            const stats = {
                testsPassed: totalTestsPassed,
                testsFailed: totalTestsFailed,
                testsTotal: testsTotal,
                successRate: successRate,
                courseProgress: courseProgress,
                completedExercises: completedCount,
                totalExercises: totalExercises,
                totalPoints: totalPoints
            };

            logDebug("📊 Estadísticas calculadas:", stats);

            // Actualizar UI
            hideSkeletonLoaders();
            animateStats(stats);

        }, (error) => {
            logError("❌ Error al cargar estadísticas:", error);
            hideSkeletonLoaders();
            // Mostrar stats vacías si hay error
            animateStats({
                testsPassed: 0,
                testsFailed: 0,
                testsTotal: 0,
                successRate: 0,
                courseProgress: 0,
                completedExercises: 0,
                totalExercises: 0
            });
        });

    } catch (error) {
        logError("❌ Error al configurar listener de estadísticas:", error);
        hideSkeletonLoaders();
    }
}


/**
 * Carga y muestra los envíos recientes del usuario
 * 
 * @param {string} uid - UID del usuario autenticado
 * @returns {void}
 */
async function loadRecentSubmissions(uid) {
    logInfo("📋 Cargando envíos recientes para UID:", uid);

    try {
        // Consultar los últimos 10 resultados del usuario, ordenados por fecha
        const resultsQuery = query(
            collection(db, 'results'),
            where('userId', '==', uid)
        );

        onSnapshot(resultsQuery, async (resultsSnapshot) => {
            logDebug(`✅ ${resultsSnapshot.size} resultados encontrados`);

            // Convertir a array y ordenar por fecha (más reciente primero)
            const results = [];
            resultsSnapshot.forEach(doc => {
                const result = doc.data();
                results.push({
                    id: doc.id,
                    ...result,
                    completedAt: result.completedAt?.toDate() || new Date(0)
                });
            });

            // Ordenar por fecha descendente y tomar los últimos 5
            results.sort((a, b) => b.completedAt - a.completedAt);
            const recentResults = results.slice(0, 5);

            logDebug(`📊 Mostrando ${recentResults.length} envíos recientes`);

            // Obtener nombres de ejercicios
            const exerciseNames = new Map();
            if (recentResults.length > 0) {
                const exercisesSnapshot = await getDocs(collection(db, 'exercises'));
                exercisesSnapshot.forEach(doc => {
                    const data = doc.data();
                    exerciseNames.set(doc.id, data.title || data.name || `Ejercicio ${doc.id}`);
                });
            }

            // Renderizar los envíos
            renderRecentSubmissions(recentResults, exerciseNames);

        }, (error) => {
            logError("❌ Error al cargar envíos recientes:", error);
        });

    } catch (error) {
        logError("❌ Error al configurar listener de envíos recientes:", error);
    }
}


/**
 * Renderiza la lista de envíos recientes en el DOM
 * 
 * @param {Array} results - Array de resultados
 * @param {Map} exerciseNames - Mapa de IDs a nombres de ejercicios
 * @returns {void}
 */
function renderRecentSubmissions(results, exerciseNames) {
    const container = document.getElementById('recentSubmissions');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-feather="inbox"></i>
                <p>No hay envíos recientes</p>
            </div>
        `;
        feather.replace();
        return;
    }

    container.innerHTML = results.map(result => {
        const testsPassed = parseInt(result.testsPassed) || 0;
        const testsFailed = parseInt(result.testsFailed) || 0;
        const testsRun = parseInt(result.testsRun) || 0;
        const status = result.status === 'success' ? 'success' : (testsPassed > 0 ? 'partial' : 'failed');
        const exerciseName = exerciseNames.get(result.exerciseId) || 'Ejercicio desconocido';
        const timeAgo = formatRelativeTime(result.completedAt);

        // Iconos por estado
        const icons = {
            success: 'check-circle',
            failed: 'x-circle',
            partial: 'alert-circle'
        };

        return `
            <div class="submission-item">
                <div class="submission-status ${status}">
                    <i data-feather="${icons[status]}"></i>
                </div>
                <div class="submission-info">
                    <div class="submission-exercise-name">${exerciseName}</div>
                    <div class="submission-time">${timeAgo}</div>
                </div>
                <div class="submission-stats">
                    <div class="submission-stat">
                        <div class="submission-stat-value success">${testsPassed}</div>
                        <div class="submission-stat-label">✓</div>
                    </div>
                    <div class="submission-stat">
                        <div class="submission-stat-value failed">${testsFailed}</div>
                        <div class="submission-stat-label">✗</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Reemplazar iconos de feather
    feather.replace();
}


/**
 * Configura la lógica del menú lateral (sidebar) y el botón de logout.
 *
 * @returns {void}
 */
function setupSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle'); // Desktop
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle'); // Mobile
    const sidebarOverlay = document.getElementById('sidebarOverlay'); // Overlay
    const submenuItems = document.querySelectorAll('.has-submenu');
    const logoutLink = document.querySelector('.logout-link');

    const toggleSidebar = () => {
        const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        
        // Manejar overlay en móviles
        const isMobile = window.innerWidth <= 1024;
        if (isMobile && sidebarOverlay) {
            if (isCurrentlyCollapsed) {
                // Sidebar se está abriendo
                sidebarOverlay.classList.add('active');
            } else {
                // Sidebar se está cerrando
                sidebarOverlay.classList.remove('active');
            }
        }
        
        localStorage.setItem('sidebarCollapsed', !isCurrentlyCollapsed);
    };
    
    // Cerrar sidebar al hacer clic en el overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
            sidebarOverlay.classList.remove('active');
            localStorage.setItem('sidebarCollapsed', true);
        });
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
        
        // A11y: Soporte para teclado
        sidebarToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSidebar();
            }
        });
        sidebarToggle.setAttribute('role', 'button');
        sidebarToggle.setAttribute('tabindex', '0');
        sidebarToggle.setAttribute('aria-label', 'Toggle sidebar');
    }
    
    if (mobileSidebarToggle) {
        mobileSidebarToggle.addEventListener('click', toggleSidebar);
        
        // A11y: Soporte para teclado
        mobileSidebarToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSidebar();
            }
        });
        mobileSidebarToggle.setAttribute('role', 'button');
        mobileSidebarToggle.setAttribute('tabindex', '0');
        mobileSidebarToggle.setAttribute('aria-label', 'Toggle mobile sidebar');
    }

    // Cargar estado inicial
    const isMobile = window.innerWidth <= 1024;
    const savedStateCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isMobile) {
        sidebar.classList.add('collapsed');
        // Asegurar que el overlay esté oculto
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
    } else {
        if (savedStateCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
        // En desktop nunca mostrar overlay
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
    }

    // Actualizar aria-expanded
    if (sidebar && sidebarToggle) {
        sidebarToggle.setAttribute('aria-expanded', !sidebar.classList.contains('collapsed'));
    }
    
    // Manejar resize de ventana para ocultar overlay en desktop
    window.addEventListener('resize', () => {
        const isMobileNow = window.innerWidth <= 1024;
        if (!isMobileNow && sidebarOverlay) {
            // Al pasar a desktop, ocultar overlay
            sidebarOverlay.classList.remove('active');
        }
    });

    // Submenús con A11y
    submenuItems.forEach(item => {
        const link = item.querySelector('a');
        link.addEventListener('click', (e) => {
            if (!sidebar.classList.contains('collapsed')) {
                e.preventDefault();
                const isOpen = item.classList.toggle('submenu-open');
                link.setAttribute('aria-expanded', isOpen);
            } else {
                if (isMobile) {
                    e.preventDefault();
                    sidebar.classList.remove('collapsed');
                    localStorage.setItem('sidebarCollapsed', 'false');
                    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
                }
            }
        });
        
        // A11y: Configurar atributos iniciales
        link.setAttribute('aria-expanded', 'false');
    });

    // Logout con limpieza
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                cleanupBeforeNavigation();
                await signOut(auth);
                logDebug('✅ Usuario cerró sesión manualmente');
                
                // Señal para otras pestañas
                localStorage.setItem('authLogout', Date.now().toString());
                
                window.location.href = 'signin.html';
            } catch (error) {
                logError('❌ Error al cerrar sesión:', error.code);
                showUserFriendlyError('Error al cerrar sesión. Intenta de nuevo.');
            }
        });
    }
}


/**
 * Carga datos del perfil (nombre y avatar de GitHub) en la UI.
 * Implementa cache y retry con exponential backoff para GitHub API.
 *
 * @param {object} userData - Datos del documento de Firestore.
 * @returns {Promise<void>}
 */
async function loadUserData(userData) {
    const fullName = `${userData.firstName || ''} ${userData.apellidoPaterno || ''}`.trim();
    const userNameElement = document.getElementById('userName');
    if (userNameElement) userNameElement.textContent = fullName || 'Usuario';

    const userAvatarElement = document.getElementById('userAvatar');
    const githubUsername = userData.githubUsername;
    const defaultAvatar = 'https://via.placeholder.com/40';

    if (userAvatarElement) {
        // Mostrar placeholder inmediatamente
        userAvatarElement.src = defaultAvatar;
        
        if (githubUsername) {
            // Verificar cache primero
            if (avatarCache.has(githubUsername)) {
                const cachedData = avatarCache.get(githubUsername);
                const cacheAge = Date.now() - cachedData.timestamp;
                
                // Cache válido por 1 hora
                if (cacheAge < 60 * 60 * 1000) {
                    userAvatarElement.src = cachedData.url;
                    logDebug('✅ Avatar cargado desde cache');
                    return;
                }
            }
            
            // Fetch con retry
            const avatarUrl = await fetchGitHubAvatarWithRetry(githubUsername);
            if (avatarUrl) {
                userAvatarElement.src = avatarUrl;
                
                // Guardar en cache
                avatarCache.set(githubUsername, {
                    url: avatarUrl,
                    timestamp: Date.now()
                });
                logDebug('✅ Avatar de GitHub cargado y cacheado');
            }
        }
    }
}

/**
 * Obtiene el avatar de GitHub con retry exponencial.
 *
 * @param {string} username - Username de GitHub.
 * @param {number} [maxRetries=3] - Número máximo de reintentos.
 * @returns {Promise<string|null>} URL del avatar o null si falla.
 */
async function fetchGitHubAvatarWithRetry(username, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(`https://api.github.com/users/${username}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    logWarn(`⚠️ Usuario de GitHub no encontrado: ${username}`);
                    return null;
                }
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            const githubData = await response.json();
            return githubData.avatar_url || null;
            
        } catch (error) {
            logError(`❌ Error al obtener avatar (intento ${attempt + 1}/${maxRetries}):`, error.message);
            
            // Exponential backoff: esperar antes de reintentar
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    logWarn('⚠️ Fallback a avatar por defecto tras múltiples fallos');
    return null;
}


/**
 * Anima las estadísticas en la UI.
 *
 * @param {object} stats - Objeto con las estadísticas.
 * @returns {void}
 */
function animateStats(stats) {
    animateCounter('testsPassed', 0, stats.testsPassed, 1500);
    animateCounter('testsFailed', 0, stats.testsFailed, 1500);
    animateCounter('testsTotal', 0, stats.testsTotal, 1500);
    animateCounter('successRate', 0, stats.successRate, 2000, '%');
    animateCounter('totalPoints', 0, stats.totalPoints || 0, 1500);
    animateCounter('courseProgress', 0, stats.courseProgress, 2000, '%');
    animateCounter('completedExercises', 0, stats.completedExercises, 1500);

    const totalExercisesEl = document.getElementById('totalExercises');
    if (totalExercisesEl) totalExercisesEl.textContent = stats.totalExercises;

    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = '0%';
        requestAnimationFrame(() => { requestAnimationFrame(() => { progressFill.style.width = stats.courseProgress + '%'; }); });
    }

    // Highlight tests failed widget if there are any failures
    const testsFailedWidget = document.getElementById('testsFailed')?.closest('.widget');
    if (testsFailedWidget) {
        if (stats.testsFailed > 0) {
            testsFailedWidget.classList.add('has-failures');
        } else {
            testsFailedWidget.classList.remove('has-failures');
        }
    }
}


/**
 * Anima un número de inicio a fin en un elemento HTML.
 *
 * @param {string} elementId - ID del elemento HTML.
 * @param {number} start - Valor inicial.
 * @param {number} end - Valor final.
 * @param {number} duration - Duración de la animación en ms.
 * @param {string} [suffix] - Sufijo opcional para mostrar (ej. '%').
 * @returns {void}
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
 *
 * @param {object} userData - Datos del usuario.
 * @returns {void}
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
 *
 * @param {Date} date - Fecha a formatear.
 * @returns {string} Tiempo relativo en formato legible.
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


// --- FUNCIONES DE CLEANUP Y UTILIDAD ---

/**
 * Limpia todas las subscripciones y listeners antes de navegar.
 * @returns {void}
 */
function cleanupBeforeNavigation() {
    // Desuscribir de Firebase listeners
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
        logDebug('✅ Snapshot listener limpiado');
    }
    
    if (unsubscribeAuth) {
        unsubscribeAuth();
        unsubscribeAuth = null;
        logDebug('✅ Auth listener limpiado');
    }
    
    // Remover listeners de inactividad
    inactivityListeners.forEach(({ event, handler }) => {
        document.removeEventListener(event, handler, { capture: true });
    });
    inactivityListeners = [];
    
    // Limpiar timers
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);
    
    // Limpiar modal de inactividad
    const modal = document.getElementById('inactivityWarningModal');
    if (modal) {
        const interval = modal.dataset.countdownInterval;
        if (interval) clearInterval(parseInt(interval));
        modal.remove();
    }
    
    logDebug('✅ Cleanup completo antes de navegación');
}

/**
 * Maneja cambios en localStorage (control multi-tab).
 * @param {StorageEvent} e - Evento de storage.
 * @returns {void}
 */
function handleStorageChange(e) {
    // Detectar logout en otra pestaña
    if (e.key === 'authLogout') {
        logDebug('🔄 Logout detectado en otra pestaña');
        cleanupBeforeNavigation();
        
        // Verificar si hay razón de logout
        const reason = localStorage.getItem('logoutReason');
        if (reason === 'inactivity') {
            alert('Tu sesión ha expirado por inactividad.');
            localStorage.removeItem('logoutReason');
        }
        
        window.location.href = 'signin.html';
    }
}

/**
 * Muestra un mensaje de error amigable al usuario.
 * @param {string} message - Mensaje a mostrar.
 * @returns {void}
 */
function showUserFriendlyError(message) {
    // Buscar contenedor de errores o crear uno
    let errorContainer = document.getElementById('dashboardErrorContainer');
    
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'dashboardErrorContainer';
        errorContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            padding: 1rem;
            background: #fee;
            border-left: 4px solid #e00;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 9999;
        `;
        errorContainer.setAttribute('role', 'alert');
        errorContainer.setAttribute('aria-live', 'assertive');
        document.body.appendChild(errorContainer);
    }
    
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    
    // Auto-ocultar después de 10 segundos
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 10000);
}


// --- LÓGICA DE CIERRE DE SESIÓN POR INACTIVIDAD ---
let inactivityTimer;
let warningTimer;
const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutos
const WARNING_BEFORE_LOGOUT = 2 * 60 * 1000; // Avisar 2 minutos antes

/**
 * Muestra modal de advertencia antes del logout por inactividad.
 * @returns {void}
 */
function showInactivityWarning() {
    const remainingTime = 120; // 2 minutos en segundos
    let countdown = remainingTime;
    
    // Crear modal si no existe
    let modal = document.getElementById('inactivityWarningModal');
    if (!modal) {
        modal = createInactivityModal();
        document.body.appendChild(modal);
    }
    
    const countdownEl = modal.querySelector('#inactivityCountdown');
    const stayLoggedInBtn = modal.querySelector('#stayLoggedInBtn');
    
    // Actualizar cuenta regresiva
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) {
            const minutes = Math.floor(countdown / 60);
            const seconds = countdown % 60;
            countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
    
    // Mostrar modal
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    stayLoggedInBtn?.focus();
    
    // Botón para mantener sesión
    const handleStayLoggedIn = () => {
        clearInterval(countdownInterval);
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        resetInactivityTimer();
        stayLoggedInBtn.removeEventListener('click', handleStayLoggedIn);
    };
    
    stayLoggedInBtn?.addEventListener('click', handleStayLoggedIn);
    
    // Guardar referencia al intervalo para limpiar después
    modal.dataset.countdownInterval = countdownInterval;
}

/**
 * Crea el modal de advertencia de inactividad.
 * @returns {HTMLElement} Elemento del modal.
 */
function createInactivityModal() {
    const modal = document.createElement('div');
    modal.id = 'inactivityWarningModal';
    modal.className = 'inactivity-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'inactivityModalTitle');
    modal.setAttribute('aria-hidden', 'true');
    
    modal.innerHTML = `
        <div class="inactivity-modal-content">
            <h2 id="inactivityModalTitle">⏱️ Sesión por expirar</h2>
            <p>Tu sesión expirará por inactividad en <strong id="inactivityCountdown">2:00</strong></p>
            <p>¿Deseas continuar trabajando?</p>
            <button id="stayLoggedInBtn" class="btn-primary">Seguir conectado</button>
        </div>
    `;
    
    // Estilos inline para asegurar visibilidad
    modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        align-items: center;
        justify-content: center;
    `;
    
    const content = modal.querySelector('.inactivity-modal-content');
    content.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 8px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    const btn = modal.querySelector('#stayLoggedInBtn');
    btn.style.cssText = `
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background: #4f46e5;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
    `;
    
    return modal;
}

/**
 * Cierra la sesión del usuario por inactividad.
 * @returns {void}
 */
async function logoutDueToInactivity() {
    logDebug("⏱️ Cerrando sesión por inactividad...");
    
    // Limpiar modal si existe
    const modal = document.getElementById('inactivityWarningModal');
    if (modal) {
        const interval = modal.dataset.countdownInterval;
        if (interval) clearInterval(parseInt(interval));
        modal.remove();
    }
    
    try {
        cleanupBeforeNavigation();
        await signOut(auth);
        localStorage.setItem('logoutReason', 'inactivity');
        localStorage.setItem('authLogout', Date.now().toString());
        window.location.href = 'signin.html';
    } catch (error) {
        logError('❌ Error al cerrar sesión por inactividad:', error.code);
    }
}

/**
 * Reinicia el temporizador de inactividad.
 * @returns {void}
 */
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);
    
    // Avisar 2 minutos antes del logout
    warningTimer = setTimeout(showInactivityWarning, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);
    
    // Logout después del tiempo completo
    inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT);
}

/**
 * Inicia el monitoreo de inactividad para cerrar sesión automáticamente.
 * @returns {void}
 */
function startInactivityMonitoring() {
    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
        const handler = () => resetInactivityTimer();
        document.addEventListener(event, handler, { capture: true, passive: true });
        
        // Guardar referencia para limpiar después
        inactivityListeners.push({ event, handler });
    });
    
    resetInactivityTimer();
    logDebug("✅ Monitoreo de inactividad iniciado (20 min con aviso a los 18 min)");
}


// --- UTILIDADES DE UI/UX ---

/**
 * Muestra skeleton loaders en todos los widgets.
 * @returns {void}
 */
function showSkeletonLoaders() {
    const widgets = document.querySelectorAll('.widget');
    widgets.forEach(widget => {
        widget.classList.add('loading');
    });
}

/**
 * Oculta skeleton loaders de todos los widgets.
 * @returns {void}
 */
function hideSkeletonLoaders() {
    const widgets = document.querySelectorAll('.widget');
    widgets.forEach(widget => {
        widget.classList.remove('loading');
    });
}

/**
 * Muestra un toast notification.
 * @param {'success'|'error'|'info'} type - Tipo de toast.
 * @param {string} title - Título del mensaje.
 * @param {string} message - Contenido del mensaje.
 * @returns {void}
 */
function showToast(type, title, message) {
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    
    // Determinar icono según tipo
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'x-circle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i data-feather="${iconName}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" aria-label="Cerrar">
            <i data-feather="x"></i>
        </button>
    `;
    
    document.body.appendChild(toast);
    
    // Reemplazar iconos de feather
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Event listener para cerrar
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => removeToast(toast), 5000);
}

/**
 * Remueve un toast del DOM con animación.
 * @param {HTMLElement} toast - Elemento toast a remover.
 * @returns {void}
 */
function removeToast(toast) {
    if (!toast) return;
    toast.style.animation = 'slideInFromRight 0.3s ease-out reverse';
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

/**
 * Agrega tooltips a elementos específicos.
 * @returns {void}
 */
function initializeTooltips() {
    // Agregar tooltip al icono de success rate
    const successRateWidget = document.querySelector('.widget:nth-child(4)');
    if (successRateWidget) {
        const icon = successRateWidget.querySelector('.widget-icon');
        if (icon) {
            icon.classList.add('tooltip');
            icon.setAttribute('data-tooltip', 'Porcentaje de tests pasados vs totales');
        }
    }
    
    // Agregar tooltip al progress bar
    const progressWidget = document.querySelector('.progress-widget');
    if (progressWidget) {
        const icon = progressWidget.querySelector('.widget-icon');
        if (icon) {
            icon.classList.add('tooltip');
            icon.setAttribute('data-tooltip', 'Tu progreso general en el curso');
        }
    }
    
    // Agregar tooltips a botones del header
    const bellBtn = document.querySelector('.header-actions .action-btn:nth-child(1)');
    if (bellBtn) {
        bellBtn.classList.add('tooltip');
        bellBtn.setAttribute('data-tooltip', 'Notificaciones');
    }
    
    const helpBtn = document.querySelector('.header-actions .action-btn:nth-child(2)');
    if (helpBtn) {
        helpBtn.classList.add('tooltip');
        helpBtn.setAttribute('data-tooltip', 'Ayuda y soporte');
    }
}

// Inicializar tooltips cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeTooltips, 1000);
});


// --- LÓGICA DEL MODAL DE AYUDA ---

/**
 * Inicializa el modal de ayuda/soporte.
 * @returns {void}
 */
function initializeHelpModal() {
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const helpModalClose = document.getElementById('helpModalClose');
    const copyEmailBtn = document.getElementById('copyEmailBtn');

    if (!helpBtn || !helpModal) return;

    // Abrir modal
    helpBtn.addEventListener('click', () => {
        helpModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevenir scroll
        
        // Reemplazar iconos de feather en el modal
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    });

    // Cerrar modal
    const closeModal = () => {
        helpModal.classList.remove('active');
        document.body.style.overflow = ''; // Restaurar scroll
    };

    if (helpModalClose) {
        helpModalClose.addEventListener('click', closeModal);
    }

    // Cerrar al hacer clic fuera del contenido
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            closeModal();
        }
    });

    // Cerrar con tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && helpModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Funcionalidad de copiar email
    if (copyEmailBtn) {
        copyEmailBtn.addEventListener('click', async () => {
            const email = 'deepdevjose@itsoeh.edu.mx';
            
            try {
                await navigator.clipboard.writeText(email);
                
                // Cambiar icono temporalmente
                const icon = copyEmailBtn.querySelector('i');
                if (icon) {
                    const originalIcon = icon.getAttribute('data-feather');
                    icon.setAttribute('data-feather', 'check');
                    copyEmailBtn.classList.add('copied');
                    
                    // Reemplazar solo los iconos del botón
                    if (typeof feather !== 'undefined') {
                        feather.replace();
                    }
                    
                    // Restaurar icono después de 2 segundos
                    setTimeout(() => {
                        icon.setAttribute('data-feather', originalIcon || 'copy');
                        copyEmailBtn.classList.remove('copied');
                        if (typeof feather !== 'undefined') {
                            feather.replace();
                        }
                    }, 2000);
                }
                
                // Mostrar toast
                showToast('success', 'Copiado', 'Email copiado al portapapeles');
                
            } catch (error) {
                logError('❌ Error al copiar email:', error);
                showToast('error', 'Error', 'No se pudo copiar el email');
            }
        });
    }
}

// Inicializar modal de ayuda cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    initializeHelpModal();
});