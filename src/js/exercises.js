/**
 * exercises.js - Gestión de ejercicios de Java
 * Maneja la carga, filtrado, envío y validación de ejercicios
 */

// ==========================================
// IMPORTS
// ==========================================
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    addDoc,
    setDoc,
    deleteDoc,
    query, 
    where, 
    orderBy,
    serverTimestamp,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

// ==========================================
// GLOBAL STATE
// ==========================================
let currentUser = null;
let allExercises = [];
let currentExercise = null;
let currentSubmissionId = null;
let resultsListener = null;
let autoSaveTimeout = null;

// ==========================================
// DOM ELEMENTS
// ==========================================
const elements = {
    // Containers
    exercisesContainer: document.getElementById('exercisesContainer'),
    
    // Filters
    difficultyToggle: document.getElementById('difficultyToggle'),
    categoryFilter: document.getElementById('categoryFilter'),
    statusToggle: document.getElementById('statusToggle'),
    
    // Modal
    exerciseModal: document.getElementById('exerciseModal'),
    closeExerciseModal: document.getElementById('closeExerciseModal'),
    exerciseTitle: document.getElementById('exerciseTitle'),
    difficultyBadge: document.getElementById('difficultyBadge'),
    pointsBadge: document.getElementById('pointsBadge'),
    exerciseDescription: document.getElementById('exerciseDescription'),
    codeEditor: document.getElementById('codeEditor'),
    resetCodeBtn: document.getElementById('resetCodeBtn'),
    testCodeBtn: document.getElementById('testCodeBtn'),
    submitCodeBtn: document.getElementById('submitCodeBtn'),
    
    // Results
    resultsSection: document.getElementById('resultsSection'),
    resultSummary: document.getElementById('resultSummary'),
    resultDetails: document.getElementById('resultDetails'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    mobileSidebarToggle: document.getElementById('mobileSidebarToggle'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    
    // User profile in sidebar
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    logoutLink: document.getElementById('logoutLink'),
    
    // User profile in global header
    headerUserAvatar: document.getElementById('headerUserAvatar'),
    headerUserName: document.getElementById('headerUserName'),
    headerLogoutLink: document.getElementById('headerLogoutLink'),
    
    // Help
    helpBtn: document.getElementById('helpBtn'),
    helpModal: document.getElementById('helpModal'),
    helpModalClose: document.getElementById('helpModalClose'),
    copyEmailBtn: document.getElementById('copyEmailBtn')
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando página de ejercicios...');
    
    // Verificar autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log('✅ Usuario autenticado:', user.email);
            await initializePage();
            // Verificar si es admin
            await checkAdminAccess();
        } else {
            console.log('❌ Usuario no autenticado, redirigiendo...');
            window.location.href = '../../index.html';
        }
    });
    
    // Inicializar event listeners
    initializeEventListeners();
    
    // Inicializar Feather icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
});

// ==========================================
// PAGE INITIALIZATION
// ==========================================
async function initializePage() {
    try {
        // Cargar perfil del usuario
        await loadUserProfile();
        
        // Cargar ejercicios
        await loadExercises();
        
        // Inicializar filtros
        populateCategoryFilter();
        
        // Renderizar ejercicios
        renderExercises();
        
    } catch (error) {
        console.error('❌ Error al inicializar página:', error);
        showToast('error', 'Error', 'No se pudieron cargar los ejercicios');
    }
}

// ==========================================
// CHECK ADMIN ACCESS
// ==========================================
async function checkAdminAccess() {
    try {
        if (!currentUser || !currentUser.email) return;
        
        // Verificar si existe en la colección de admins
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.email));
        
        if (adminDoc.exists()) {
            // Es administrador, mostrar el enlace
            const adminMenuItem = document.getElementById('adminMenuItem');
            if (adminMenuItem) {
                adminMenuItem.style.display = 'block';
                console.log('✅ Usuario es administrador, mostrando enlace al panel admin');
            }
        }
    } catch (error) {
        console.log('⚠️ Error al verificar acceso de admin:', error.code);
        // No hacer nada, simplemente no mostrar el enlace
    }
}

// ==========================================
// LOAD USER PROFILE
// ==========================================
async function loadUserProfile() {
    try {
        const userDoc = await getDoc(doc(db, 'usuarios', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Actualizar nombre en ambos lugares
            const fullName = `${userData.firstName || ''} ${userData.apellidoPaterno || ''}`.trim();
            
            // Actualizar en header global
            if (elements.headerUserName) {
                elements.headerUserName.textContent = fullName || 'Usuario';
            }
            
            // Actualizar en sidebar
            if (elements.userName) {
                elements.userName.textContent = fullName || 'Usuario';
            }
            
            // Cargar avatar de GitHub
            const githubUsername = userData.githubUsername;
            if (githubUsername) {
                try {
                    const response = await fetch(`https://api.github.com/users/${githubUsername}`);
                    if (response.ok) {
                        const githubData = await response.json();
                        
                        // Actualizar en header global
                        if (elements.headerUserAvatar) {
                            elements.headerUserAvatar.src = githubData.avatar_url;
                        }
                        
                        // Actualizar en sidebar
                        if (elements.userAvatar) {
                            elements.userAvatar.src = githubData.avatar_url;
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ No se pudo cargar avatar de GitHub');
                }
            }
        }
    } catch (error) {
        console.error('❌ Error al cargar perfil:', error);
    }
}

// ==========================================
// LOAD EXERCISES
// ==========================================
async function loadExercises() {
    try {
        console.log('📚 Cargando ejercicios...');
        
        const exercisesRef = collection(db, 'exercises');
        console.log('✅ Referencia a colección creada');
        
        // Cargar todos los documentos (sin filtro)
        const snapshot = await getDocs(exercisesRef);
        console.log('✅ Snapshot obtenido, documentos:', snapshot.size);
        
        allExercises = [];
        console.log('🔄 Iterando sobre documentos...');
        snapshot.forEach((doc) => {
            console.log('📄 Procesando documento:', doc.id);
            const data = doc.data();
            console.log('📦 Datos del documento:', data);
            
            // Intentar leer el campo points con varios formatos posibles
            let points = data.points || data[' points'] || data['"points"'] || 0;
            
            // Si es string, limpiar y convertir a número
            if (typeof points === 'string') {
                points = parseInt(points.replace(/['"]/g, ''), 10) || 0;
            }
            
            console.log('💎 Puntos del ejercicio:', points);
            
            // NO filtrar por isActive, cargar todo
            const cleanData = {
                id: doc.id,
                title: typeof data.title === 'string' ? data.title.replace(/^"|"$/g, '') : data.title,
                description: typeof data.description === 'string' ? data.description.replace(/^"|"$/g, '') : data.description,
                difficulty: typeof data.difficulty === 'string' ? data.difficulty.replace(/^"|"$/g, '') : data.difficulty,
                category: typeof data.category === 'string' ? data.category.replace(/^"|"$/g, '') : data.category,
                templateCode: typeof data.templateCode === 'string' ? data.templateCode.replace(/^"|"$/g, '') : data.templateCode,
                testCode: data.testCode,
                points: points,
                order: data.order,
                isActive: data.isActive,
                tags: data.tags || []
            };
            console.log('✨ Datos limpios:', cleanData);
            allExercises.push(cleanData);
            console.log('✅ Ejercicio agregado, total ahora:', allExercises.length);
        });
        console.log('🏁 Iteración completada');
        
        // Ordenar manualmente por 'order'
        allExercises.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        console.log(`✅ ${allExercises.length} ejercicios cargados`);
        console.log('📋 Ejercicios:', allExercises);
        
        // Cargar progreso del usuario
        await loadUserProgress();
        
    } catch (error) {
        console.error('❌ Error al cargar ejercicios:', error);
        throw error;
    }
}

// ==========================================
// LOAD USER PROGRESS
// ==========================================
async function loadUserProgress() {
    try {
        const resultsRef = collection(db, 'results');
        const q = query(resultsRef, where('userId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        
        const completedExercises = new Set();
        snapshot.forEach((doc) => {
            const result = doc.data();
            if (result.status === 'success') {
                completedExercises.add(result.exerciseId);
            }
        });
        
        // Marcar ejercicios como completados
        allExercises.forEach(exercise => {
            exercise.completed = completedExercises.has(exercise.id);
        });
        
        console.log(`✅ ${completedExercises.size} ejercicios completados`);
        
    } catch (error) {
        console.error('❌ Error al cargar progreso:', error);
    }
}

// ==========================================
// UPDATE STATS BAR
// ==========================================
function updateStatsBar() {
    const completedCount = allExercises.filter(ex => ex.completed).length;
    const pendingCount = allExercises.filter(ex => !ex.completed).length;
    const totalExercises = allExercises.length;
    const progressPercentage = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;
    
    // Calcular puntos ganados
    const totalPoints = allExercises
        .filter(ex => ex.completed)
        .reduce((sum, ex) => {
            let points = ex.points || 0;
            // Convertir a número si es string
            if (typeof points === 'string') {
                points = parseInt(points.replace(/['"]/g, ''), 10) || 0;
            }
            return sum + points;
        }, 0);
    
    // Actualizar DOM
    const completedCountEl = document.getElementById('completedCount');
    const pendingCountEl = document.getElementById('pendingCount');
    const totalPointsEarnedEl = document.getElementById('totalPointsEarned');
    const progressPercentageEl = document.getElementById('progressPercentage');
    
    if (completedCountEl) completedCountEl.textContent = completedCount;
    if (pendingCountEl) pendingCountEl.textContent = pendingCount;
    if (totalPointsEarnedEl) totalPointsEarnedEl.textContent = totalPoints;
    if (progressPercentageEl) progressPercentageEl.textContent = `${progressPercentage}%`;
    
    console.log('📊 Stats actualizados:', { completedCount, pendingCount, totalPoints, progressPercentage });
}

// ==========================================
// SEARCH FILTER
// ==========================================
function filterExercisesBySearch(searchTerm) {
    const cards = elements.exercisesContainer.querySelectorAll('.exercise-card');
    
    cards.forEach(card => {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const description = card.querySelector('p')?.textContent.toLowerCase() || '';
        const category = card.querySelector('.category-badge')?.textContent.toLowerCase() || '';
        
        const matches = title.includes(searchTerm) || 
                       description.includes(searchTerm) || 
                       category.includes(searchTerm);
        
        if (matches || searchTerm === '') {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// ==========================================
// RENDER EXERCISES
// ==========================================
function renderExercises() {
    console.log('🎨 Iniciando renderizado de ejercicios');
    console.log('📦 Total ejercicios en allExercises:', allExercises.length);
    
    // Actualizar barra de estadísticas
    updateStatsBar();
    
    // Obtener valores de los filtros toggle
    const difficultyFilter = elements.difficultyToggle?.querySelector('.toggle-btn.active')?.dataset.value || 'all';
    const categoryFilter = elements.categoryFilter?.value || 'all';
    const statusFilter = elements.statusToggle?.querySelector('.toggle-btn.active')?.dataset.value || 'all';
    
    console.log('🔍 Filtros aplicados:', { difficultyFilter, categoryFilter, statusFilter });
    
    // Filtrar ejercicios
    let filteredExercises = allExercises.filter(exercise => {
        const matchesDifficulty = difficultyFilter === 'all' || exercise.difficulty === difficultyFilter;
        const matchesCategory = categoryFilter === 'all' || exercise.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || 
            (statusFilter === 'completed' && exercise.completed) ||
            (statusFilter === 'pending' && !exercise.completed);
        
        return matchesDifficulty && matchesCategory && matchesStatus;
    });
    
    console.log('✨ Ejercicios después del filtrado:', filteredExercises.length);
    
    // Limpiar contenedor
    elements.exercisesContainer.innerHTML = '';
    console.log('🧹 Contenedor limpiado');
    
    if (filteredExercises.length === 0) {
        console.log('⚠️ No hay ejercicios filtrados, mostrando empty state');
        elements.exercisesContainer.innerHTML = `
            <div class="empty-state">
                <i data-feather="inbox"></i>
                <h3>No se encontraron ejercicios</h3>
                <p>Intenta cambiar los filtros</p>
            </div>
        `;
        feather.replace();
        return;
    }
    
    console.log('🔨 Creando tarjetas de ejercicios...');
    // Renderizar cada ejercicio
    filteredExercises.forEach((exercise, index) => {
        console.log(`  📝 Creando tarjeta ${index + 1}:`, exercise.title);
        const card = createExerciseCard(exercise);
        elements.exercisesContainer.appendChild(card);
    });
    
    console.log('✅ Tarjetas creadas, reemplazando iconos Feather');
    feather.replace();
    console.log('🎉 Renderizado completado');
}

// ==========================================
// CREATE EXERCISE CARD
// ==========================================
function createExerciseCard(exercise) {
    const card = document.createElement('div');
    card.className = `exercise-card ${exercise.completed ? 'completed' : ''}`;
    card.onclick = () => openExercise(exercise);
    
    // Valores por defecto para campos undefined
    const title = exercise.title || 'Sin título';
    const description = exercise.description || 'Sin descripción';
    const difficulty = exercise.difficulty || 'medium';
    const category = exercise.category || 'General';
    
    // Procesar puntos - asegurar que sea un número
    let points = exercise.points || 0;
    if (typeof points === 'string') {
        points = parseInt(points.replace(/['"]/g, ''), 10) || 0;
    }
    
    // Truncar descripción
    const shortDescription = description.split('\n')[0].substring(0, 100) + '...';
    
    card.innerHTML = `
        <h3>${title}</h3>
        <p>${shortDescription}</p>
        <div class="exercise-meta">
            <span class="difficulty-badge ${difficulty}">
                <i data-feather="trending-up"></i>
                ${getDifficultyText(difficulty)}
            </span>
            <span class="points-badge">
                <i data-feather="award"></i>
                ${points} punto${points !== 1 ? 's' : ''}
            </span>
            <span class="category-badge">
                <i data-feather="tag"></i>
                ${category}
            </span>
        </div>
        <div class="exercise-status ${exercise.completed ? 'completed' : 'pending'}">
            <i data-feather="${exercise.completed ? 'check-circle' : 'clock'}"></i>
            <span>${exercise.completed ? 'Completado' : 'Pendiente'}</span>
        </div>
    `;
    
    return card;
}

// ==========================================
// OPEN EXERCISE MODAL
// ==========================================
async function openExercise(exercise) {
    currentExercise = exercise;
    currentSubmissionId = null;
    
    // Procesar puntos - asegurar que sea un número
    let points = exercise.points || 0;
    if (typeof points === 'string') {
        points = parseInt(points.replace(/['"]/g, ''), 10) || 0;
    }
    
    // Llenar modal con datos del ejercicio
    elements.exerciseTitle.textContent = exercise.title;
    elements.difficultyBadge.textContent = getDifficultyText(exercise.difficulty);
    elements.difficultyBadge.className = `difficulty-badge ${exercise.difficulty}`;
    elements.pointsBadge.textContent = `${points} punto${points !== 1 ? 's' : ''}`;
    elements.exerciseDescription.textContent = exercise.description;
    
    // Intentar cargar código guardado previamente
    const savedCode = await loadSavedCode(exercise.id);
    elements.codeEditor.value = savedCode || exercise.templateCode;
    
    // Configurar auto-guardado mientras el usuario escribe
    elements.codeEditor.removeEventListener('input', handleCodeChange);
    elements.codeEditor.addEventListener('input', handleCodeChange);
    
    // Ocultar resultados
    elements.resultsSection.classList.add('hidden');
    
    // Mostrar modal
    elements.exerciseModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Reemplazar iconos
    feather.replace();
}

// ==========================================
// CLOSE EXERCISE MODAL
// ==========================================
function closeExercise() {
    elements.exerciseModal.classList.remove('active');
    document.body.style.overflow = 'auto';
    
    // Guardar código antes de cerrar
    if (currentExercise) {
        saveCodeDraft(currentExercise.id, elements.codeEditor.value);
    }
    
    // Limpiar listener de input
    elements.codeEditor.removeEventListener('input', handleCodeChange);
    
    // Detener listener de resultados si existe
    if (resultsListener) {
        resultsListener();
        resultsListener = null;
    }
}

// ==========================================
// AUTO-SAVE CODE FUNCTIONS
// ==========================================

// Manejar cambios en el editor (debounced)
function handleCodeChange() {
    if (!currentExercise) return;
    
    // Cancelar timeout anterior
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    
    // Guardar después de 2 segundos de inactividad
    autoSaveTimeout = setTimeout(() => {
        saveCodeDraft(currentExercise.id, elements.codeEditor.value);
    }, 2000);
}

// Guardar borrador de código en Firestore
async function saveCodeDraft(exerciseId, code) {
    if (!currentUser || !exerciseId) return;
    
    try {
        const draftRef = doc(db, 'code_drafts', `${currentUser.uid}_${exerciseId}`);
        await setDoc(draftRef, {
            userId: currentUser.uid,
            exerciseId: exerciseId,
            code: code,
            lastSaved: serverTimestamp()
        });
        console.log('💾 Código guardado automáticamente');
    } catch (error) {
        console.error('Error al guardar código:', error);
    }
}

// Cargar código guardado desde Firestore
async function loadSavedCode(exerciseId) {
    if (!currentUser || !exerciseId) return null;
    
    try {
        const draftRef = doc(db, 'code_drafts', `${currentUser.uid}_${exerciseId}`);
        const draftDoc = await getDoc(draftRef);
        
        if (draftDoc.exists()) {
            const data = draftDoc.data();
            console.log('📂 Código cargado desde borrador guardado');
            return data.code;
        }
    } catch (error) {
        console.error('Error al cargar código guardado:', error);
    }
    
    return null;
}

// ==========================================
// RESET CODE
// ==========================================
async function resetCode() {
    if (currentExercise) {
        elements.codeEditor.value = currentExercise.templateCode;
        
        // Eliminar borrador guardado
        try {
            const draftRef = doc(db, 'code_drafts', `${currentUser.uid}_${currentExercise.id}`);
            await deleteDoc(draftRef);
            console.log('🗑️ Borrador eliminado');
        } catch (error) {
            console.error('Error al eliminar borrador:', error);
        }
        
        showToast('info', 'Código restablecido', 'El código ha vuelto a la plantilla original');
    }
}

// ==========================================
// TEST CODE (LOCAL)
// ==========================================
function testCode() {
    showToast('info', 'Función en desarrollo', 'La validación local aún no está disponible. Usa "Enviar Solución" para validar en GitHub Actions.');
}

// ==========================================
// SUBMIT CODE
// ==========================================
async function submitCode() {
    if (!currentExercise) return;
    
    const studentCode = elements.codeEditor.value.trim();
    
    if (!studentCode) {
        showToast('error', 'Código vacío', 'Debes escribir tu solución antes de enviar');
        return;
    }
    
    try {
        // Mostrar loading
        elements.loadingOverlay.classList.remove('hidden');
        elements.submitCodeBtn.disabled = true;
        
        console.log('📤 Enviando código...');
        
        // 1. Guardar submission en Firestore
        const submissionData = {
            userId: currentUser.uid,
            exerciseId: currentExercise.id,
            code: studentCode,
            status: 'pending',
            submittedAt: serverTimestamp()
        };
        
        const submissionRef = await addDoc(collection(db, 'submissions'), submissionData);
        currentSubmissionId = submissionRef.id;
        
        console.log('✅ Submission guardada:', currentSubmissionId);
        
        // 2. Obtener token de GitHub desde Firestore
        const configDoc = await getDoc(doc(db, 'config', 'github'));
        if (!configDoc.exists()) {
            throw new Error('No se encontró la configuración de GitHub');
        }
        
        const githubConfig = configDoc.data();
        
        // 3. Trigger GitHub Action via repository_dispatch
        const response = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubConfig.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: 'validate_submission',
                client_payload: {
                    submissionId: currentSubmissionId,
                    userId: currentUser.uid,
                    exerciseId: currentExercise.id,
                    studentCode: studentCode
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error al disparar GitHub Action: ${response.status} ${errorText}`);
        }
        
        console.log('✅ GitHub Action disparado exitosamente');
        
        // 4. Escuchar resultados en tiempo real
        listenForResults();
        
        showToast('success', 'Código enviado', 'Tu solución está siendo validada...');
        
    } catch (error) {
        console.error('❌ Error al enviar código:', error);
        showToast('error', 'Error', error.message || 'No se pudo enviar el código');
        elements.loadingOverlay.classList.add('hidden');
        elements.submitCodeBtn.disabled = false;
    }
}

// ==========================================
// LISTEN FOR RESULTS
// ==========================================
function listenForResults() {
    if (!currentSubmissionId) return;
    
    console.log('👂 Escuchando resultados para:', currentSubmissionId);
    
    const resultsRef = collection(db, 'results');
    // Filtrar primero por userId (para cumplir reglas de seguridad), luego por submissionId
    const q = query(
        resultsRef, 
        where('userId', '==', currentUser.uid),
        where('submissionId', '==', currentSubmissionId)
    );
    
    resultsListener = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const result = change.doc.data();
                console.log('✅ Resultado recibido:', result);
                displayResults(result);
            }
        });
    }, (error) => {
        console.error('❌ Error en listener de resultados:', error);
        showToast('error', 'Error', 'No se pudieron obtener los resultados');
    });
}

// ==========================================
// DISPLAY RESULTS
// ==========================================
function displayResults(result) {
    // Ocultar loading
    elements.loadingOverlay.classList.add('hidden');
    elements.submitCodeBtn.disabled = false;
    
    // Mostrar sección de resultados
    elements.resultsSection.classList.remove('hidden');
    
    // Crear summary
    const isSuccess = result.status === 'success';
    elements.resultSummary.innerHTML = `
        <div class="result-stat">
            <div class="result-stat-value success">${result.testsPassed || 0}</div>
            <div class="result-stat-label">Tests Pasados</div>
        </div>
        <div class="result-stat">
            <div class="result-stat-value failed">${result.testsFailed || 0}</div>
            <div class="result-stat-label">Tests Fallidos</div>
        </div>
        <div class="result-stat">
            <div class="result-stat-value">${result.testsRun || 0}</div>
            <div class="result-stat-label">Total Tests</div>
        </div>
    `;
    
    // Crear detalles
    elements.resultDetails.className = `result-details ${isSuccess ? 'success' : 'failed'}`;
    
    if (isSuccess) {
        elements.resultDetails.innerHTML = `
            <h4 style="color: #10b981; margin: 0 0 12px 0;">
                <i data-feather="check-circle"></i>
                ¡Felicidades! Todos los tests pasaron
            </h4>
            <p style="margin: 0; color: #6b7280;">
                Has ganado <strong>${currentExercise.points} puntos</strong>.
                Tu solución es correcta y cumple con todos los requisitos.
            </p>
        `;
        
        // Actualizar estado del ejercicio
        currentExercise.completed = true;
        renderExercises();
        
        showToast('success', '¡Ejercicio completado!', `Has ganado ${currentExercise.points} puntos`);
        
    } else {
        elements.resultDetails.innerHTML = `
            <h4 style="color: #ef4444; margin: 0 0 12px 0;">
                <i data-feather="x-circle"></i>
                Algunos tests fallaron
            </h4>
            <div class="result-message">${result.errorReport || 'Revisa tu código e intenta de nuevo'}</div>
        `;
        
        showToast('error', 'Tests fallidos', 'Revisa los errores y intenta de nuevo');
    }
    
    feather.replace();
    
    // Scroll a resultados
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==========================================
// POPULATE CATEGORY FILTER
// ==========================================
function populateCategoryFilter() {
    const categories = new Set();
    allExercises.forEach(ex => categories.add(ex.category));
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.categoryFilter.appendChild(option);
    });
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function getDifficultyText(difficulty) {
    const texts = {
        easy: 'Fácil',
        medium: 'Media',
        hard: 'Difícil'
    };
    return texts[difficulty] || difficulty;
}

function showToast(type, title, message) {
    // Reutilizar función del dashboard
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconMap = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info'
    };
    
    toast.innerHTML = `
        <i data-feather="${iconMap[type]}"></i>
        <div>
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i data-feather="x"></i>
        </button>
    `;
    
    document.body.appendChild(toast);
    feather.replace();
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function initializeEventListeners() {
    // Toggle Filters - Difficulty
    if (elements.difficultyToggle) {
        const difficultyButtons = elements.difficultyToggle.querySelectorAll('.toggle-btn');
        difficultyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                difficultyButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderExercises();
            });
        });
    }
    
    // Toggle Filters - Status
    if (elements.statusToggle) {
        const statusButtons = elements.statusToggle.querySelectorAll('.toggle-btn');
        statusButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                statusButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderExercises();
            });
        });
    }
    
    // Category Filter (dropdown)
    elements.categoryFilter?.addEventListener('change', renderExercises);
    
    // Clear Filters Button
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // Reset difficulty toggle
            if (elements.difficultyToggle) {
                const difficultyButtons = elements.difficultyToggle.querySelectorAll('.toggle-btn');
                difficultyButtons.forEach(b => b.classList.remove('active'));
                difficultyButtons[0]?.classList.add('active'); // Set first (Todas) as active
            }
            
            // Reset category dropdown
            if (elements.categoryFilter) {
                elements.categoryFilter.value = 'all';
            }
            
            // Reset status toggle
            if (elements.statusToggle) {
                const statusButtons = elements.statusToggle.querySelectorAll('.toggle-btn');
                statusButtons.forEach(b => b.classList.remove('active'));
                statusButtons[0]?.classList.add('active'); // Set first (Todos) as active
            }
            
            // Clear search
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            
            renderExercises();
            showToast('info', 'Filtros limpiados', 'Mostrando todos los ejercicios');
        });
    }
    
    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterExercisesBySearch(searchTerm);
        });
    }
    
    // Modal
    elements.closeExerciseModal?.addEventListener('click', closeExercise);
    elements.exerciseModal?.addEventListener('click', (e) => {
        if (e.target === elements.exerciseModal) closeExercise();
    });
    
    // Actions
    elements.resetCodeBtn?.addEventListener('click', resetCode);
    elements.testCodeBtn?.addEventListener('click', testCode);
    elements.submitCodeBtn?.addEventListener('click', submitCode);
    
    // Sidebar toggles
    elements.sidebarToggle?.addEventListener('click', toggleSidebar);
    elements.mobileSidebarToggle?.addEventListener('click', toggleSidebar);
    elements.sidebarOverlay?.addEventListener('click', () => {
        elements.sidebar?.classList.add('collapsed');
        elements.sidebarOverlay?.classList.remove('active');
    });
    
    // Logout - Sidebar
    elements.logoutLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = '../../index.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    });
    
    // Logout - Global Header
    elements.headerLogoutLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = '../../index.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    });
    
    // Help Modal
    elements.helpBtn?.addEventListener('click', openHelpModal);
    elements.helpModalClose?.addEventListener('click', closeHelpModal);
    elements.helpModal?.addEventListener('click', (e) => {
        if (e.target === elements.helpModal) closeHelpModal();
    });
    elements.copyEmailBtn?.addEventListener('click', copyEmail);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC para cerrar modales
        if (e.key === 'Escape') {
            if (elements.exerciseModal?.classList.contains('active')) {
                closeExercise();
            } else if (elements.helpModal?.classList.contains('active')) {
                closeHelpModal();
            }
        }
    });
}

// ==========================================
// SIDEBAR TOGGLE
// ==========================================
function toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    elements.sidebar?.classList.toggle('collapsed');
    
    if (isMobile && elements.sidebarOverlay) {
        const isCollapsed = elements.sidebar?.classList.contains('collapsed');
        if (isCollapsed) {
            elements.sidebarOverlay.classList.remove('active');
        } else {
            elements.sidebarOverlay.classList.add('active');
        }
    }
}

// ==========================================
// WINDOW RESIZE
// ==========================================
window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile && elements.sidebarOverlay) {
        elements.sidebarOverlay.classList.remove('active');
    }
});

// ==========================================
// HELP MODAL FUNCTIONS
// ==========================================
function openHelpModal() {
    if (elements.helpModal) {
        elements.helpModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Reemplazar iconos
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }
}

function closeHelpModal() {
    if (elements.helpModal) {
        elements.helpModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function copyEmail() {
    const email = 'deepdevjose@itsoeh.edu.mx';
    
    try {
        await navigator.clipboard.writeText(email);
        
        // Cambiar icono temporalmente
        const icon = elements.copyEmailBtn?.querySelector('i');
        if (icon) {
            const originalIcon = icon.getAttribute('data-feather');
            icon.setAttribute('data-feather', 'check');
            elements.copyEmailBtn.classList.add('copied');
            
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            
            // Restaurar después de 2 segundos
            setTimeout(() => {
                icon.setAttribute('data-feather', originalIcon || 'copy');
                elements.copyEmailBtn.classList.remove('copied');
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }, 2000);
        }
        
        showToast('success', 'Copiado', 'Email copiado al portapapeles');
        
    } catch (error) {
        console.error('❌ Error al copiar email:', error);
        showToast('error', 'Error', 'No se pudo copiar el email');
    }
}