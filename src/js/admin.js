/**
 * admin.js - Panel de Administración
 * Gestión completa de ejercicios con tests dinámicos
 */

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let currentUser = null;
let isAdmin = false;
let currentExerciseId = null;

// ==========================================
// DOM ELEMENTS
// ==========================================
const elements = {
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    mobileSidebarToggle: document.getElementById('mobileSidebarToggle'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    adminName: document.getElementById('adminName'),
    
    // Navigation
    navItems: document.querySelectorAll('.nav-item[data-section]'),
    contentSections: document.querySelectorAll('.content-section'),
    pageTitle: document.getElementById('pageTitle'),
    pageSubtitle: document.getElementById('pageSubtitle'),
    
    // Exercises
    exercisesGrid: document.getElementById('exercisesGrid'),
    createExerciseBtn: document.getElementById('createExerciseBtn'),
    
    // Modal
    exerciseModal: document.getElementById('exerciseModal'),
    closeExerciseModal: document.getElementById('closeExerciseModal'),
    exerciseForm: document.getElementById('exerciseForm'),
    modalTitle: document.getElementById('modalTitle'),
    
    // Form fields
    exerciseTitle: document.getElementById('exerciseTitle'),
    exerciseCategory: document.getElementById('exerciseCategory'),
    exerciseDifficulty: document.getElementById('exerciseDifficulty'),
    exercisePoints: document.getElementById('exercisePoints'),
    exerciseDescription: document.getElementById('exerciseDescription'),
    exerciseTemplate: document.getElementById('exerciseTemplate'),
    exerciseTestCode: document.getElementById('exerciseTestCode'),
    cancelExerciseBtn: document.getElementById('cancelExerciseBtn'),
    saveExerciseBtn: document.getElementById('saveExerciseBtn'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Admin Panel inicializando...');
    
    // Setup auth listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await checkAdminAccess(user);
        } else {
            // Redirect to signin if not authenticated
            window.location.href = 'signin.html';
        }
    });
    
    setupEventListeners();
});

// ==========================================
// AUTH & PERMISSIONS
// ==========================================
async function checkAdminAccess(user) {
    console.log('🔐 Verificando acceso de administrador...');
    
    try {
        // Check if user is in admins collection
        const adminDoc = await getDoc(doc(db, 'admins', user.email));
        
        if (adminDoc.exists()) {
            isAdmin = true;
            console.log('✅ Usuario es administrador');
            
            // Load admin data
            const adminData = adminDoc.data();
            if (elements.adminName) {
                elements.adminName.textContent = adminData.githubUsername || user.email.split('@')[0];
            }
            
            // Initialize admin panel
            initializeAdminPanel();
        } else {
            // Not an admin, redirect to dashboard
            console.log('❌ Usuario no es administrador, redirigiendo...');
            showToast('error', 'Acceso Denegado', 'No tienes permisos de administrador');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        }
    } catch (error) {
        console.error('❌ Error al verificar permisos:', error);
        showToast('error', 'Error', 'No se pudo verificar los permisos');
    }
}

function initializeAdminPanel() {
    console.log('✅ Inicializando panel de administración');
    loadExercises();
    loadStats();
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Sidebar toggle
    if (elements.sidebarToggle) {
        elements.sidebarToggle.addEventListener('click', () => {
            elements.sidebar.classList.toggle('collapsed');
            localStorage.setItem('adminSidebarCollapsed', elements.sidebar.classList.contains('collapsed'));
        });
    }
    
    // Mobile sidebar toggle
    if (elements.mobileSidebarToggle) {
        elements.mobileSidebarToggle.addEventListener('click', () => {
            elements.sidebar.classList.toggle('collapsed');
            elements.sidebarOverlay.classList.toggle('active');
        });
    }
    
    // Sidebar overlay
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', () => {
            elements.sidebar.classList.remove('collapsed');
            elements.sidebarOverlay.classList.remove('active');
        });
    }
    
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });
    
    // Create exercise button
    if (elements.createExerciseBtn) {
        elements.createExerciseBtn.addEventListener('click', () => {
            openExerciseModal();
        });
    }
    
    // Close modal
    if (elements.closeExerciseModal) {
        elements.closeExerciseModal.addEventListener('click', closeExerciseModal);
    }
    
    // Cancel button
    if (elements.cancelExerciseBtn) {
        elements.cancelExerciseBtn.addEventListener('click', closeExerciseModal);
    }
    
    // Form submission
    if (elements.exerciseForm) {
        elements.exerciseForm.addEventListener('submit', handleExerciseSubmit);
    }
    
    // Close modal on outside click
    if (elements.exerciseModal) {
        elements.exerciseModal.addEventListener('click', (e) => {
            if (e.target === elements.exerciseModal) {
                closeExerciseModal();
            }
        });
    }
    
    // Restore sidebar state
    const sidebarCollapsed = localStorage.getItem('adminSidebarCollapsed') === 'true';
    if (sidebarCollapsed && elements.sidebar) {
        elements.sidebar.classList.add('collapsed');
    }
}

// ==========================================
// NAVIGATION
// ==========================================
function switchSection(sectionName) {
    // Update nav items
    elements.navItems.forEach(item => {
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update content sections
    elements.contentSections.forEach(section => {
        if (section.id === `${sectionName}-section`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
    
    // Update header
    const titles = {
        exercises: {
            title: 'Gestión de Ejercicios',
            subtitle: 'Crea y administra ejercicios de Java'
        },
        users: {
            title: 'Gestión de Usuarios',
            subtitle: 'Administra los usuarios del sistema'
        },
        submissions: {
            title: 'Envíos Recientes',
            subtitle: 'Revisa los envíos de los estudiantes'
        },
        analytics: {
            title: 'Analíticas del Sistema',
            subtitle: 'Estadísticas y métricas generales'
        }
    };
    
    const sectionData = titles[sectionName];
    if (sectionData) {
        elements.pageTitle.textContent = sectionData.title;
        elements.pageSubtitle.textContent = sectionData.subtitle;
    }
    
    // Load section data
    if (sectionName === 'users') {
        loadUsers();
    } else if (sectionName === 'submissions') {
        loadSubmissions();
    } else if (sectionName === 'analytics') {
        loadStats();
    }
}

// ==========================================
// LOAD EXERCISES
// ==========================================
async function loadExercises() {
    console.log('📚 Cargando ejercicios...');
    
    try {
        const exercisesSnapshot = await getDocs(collection(db, 'exercises'));
        const exercises = [];
        
        exercisesSnapshot.forEach(doc => {
            exercises.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`✅ ${exercises.length} ejercicios cargados`);
        renderExercises(exercises);
        
    } catch (error) {
        console.error('❌ Error al cargar ejercicios:', error);
        showToast('error', 'Error', 'No se pudieron cargar los ejercicios');
    }
}

function renderExercises(exercises) {
    if (!elements.exercisesGrid) return;
    
    if (exercises.length === 0) {
        elements.exercisesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-tertiary);">
                <i data-feather="inbox" style="width: 48px; height: 48px; margin-bottom: 16px;"></i>
                <p>No hay ejercicios creados</p>
                <p style="font-size: 14px; margin-top: 8px;">Haz clic en "Nuevo Ejercicio" para crear uno</p>
            </div>
        `;
        feather.replace();
        return;
    }
    
    elements.exercisesGrid.innerHTML = exercises.map(exercise => `
        <div class="exercise-card" data-id="${exercise.id}">
            <div class="exercise-card-header">
                <div>
                    <h3 class="exercise-title">${exercise.title || 'Sin título'}</h3>
                    <div class="exercise-meta">
                        <span class="badge difficulty-${exercise.difficulty}">${getDifficultyLabel(exercise.difficulty)}</span>
                        <span class="badge category">${exercise.category || 'General'}</span>
                    </div>
                </div>
            </div>
            
            <p class="exercise-description">${exercise.description || 'Sin descripción'}</p>
            
            <div class="exercise-stats">
                <span><i data-feather="award"></i> ${exercise.points || 0} puntos</span>
                <span><i data-feather="check-circle"></i> ${exercise.tests?.length || 0} tests</span>
            </div>
            
            <div class="exercise-actions">
                <button class="icon-btn" onclick="editExercise('${exercise.id}')" title="Editar">
                    <i data-feather="edit-2"></i>
                </button>
                <button class="icon-btn delete" onclick="deleteExercise('${exercise.id}')" title="Eliminar">
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    feather.replace();
}

function getDifficultyLabel(difficulty) {
    const labels = {
        easy: 'Fácil',
        medium: 'Medio',
        hard: 'Difícil'
    };
    return labels[difficulty] || difficulty;
}

// ==========================================
// MODAL MANAGEMENT
// ==========================================
function openExerciseModal(exerciseId = null) {
    currentExerciseId = exerciseId;
    
    if (exerciseId) {
        // Edit mode
        elements.modalTitle.textContent = 'Editar Ejercicio';
        loadExerciseData(exerciseId);
    } else {
        // Create mode
        elements.modalTitle.textContent = 'Crear Nuevo Ejercicio';
        resetForm();
    }
    
    elements.exerciseModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeExerciseModal() {
    elements.exerciseModal.classList.remove('active');
    document.body.style.overflow = '';
    resetForm();
}

function resetForm() {
    elements.exerciseForm.reset();
    currentExerciseId = null;
}

async function loadExerciseData(exerciseId) {
    try {
        const exerciseDoc = await getDoc(doc(db, 'exercises', exerciseId));
        
        if (!exerciseDoc.exists()) {
            showToast('error', 'Error', 'Ejercicio no encontrado');
            closeExerciseModal();
            return;
        }
        
        const exercise = exerciseDoc.data();
        
        // Fill form
        elements.exerciseTitle.value = exercise.title || '';
        elements.exerciseCategory.value = exercise.category || '';
        elements.exerciseDifficulty.value = exercise.difficulty || '';
        elements.exercisePoints.value = exercise.points || 0;
        elements.exerciseDescription.value = exercise.description || '';
        elements.exerciseTemplate.value = exercise.templateCode || '';
        elements.exerciseTestCode.value = exercise.testCode || '';
        
    } catch (error) {
        console.error('❌ Error al cargar ejercicio:', error);
        showToast('error', 'Error', 'No se pudo cargar el ejercicio');
    }
}

// ==========================================
// FORM SUBMISSION
// ==========================================
async function handleExerciseSubmit(e) {
    e.preventDefault();
    
    if (!isAdmin) {
        showToast('error', 'Acceso Denegado', 'No tienes permisos para realizar esta acción');
        return;
    }
    
    try {
        // Disable button
        elements.saveExerciseBtn.disabled = true;
        elements.saveExerciseBtn.innerHTML = '<i data-feather="loader"></i> Guardando...';
        feather.replace();
        
        // Collect form data
        const exerciseData = {
            title: elements.exerciseTitle.value.trim(),
            category: elements.exerciseCategory.value,
            difficulty: elements.exerciseDifficulty.value,
            points: parseInt(elements.exercisePoints.value) || 0,
            description: elements.exerciseDescription.value.trim(),
            templateCode: elements.exerciseTemplate.value.trim(),
            testCode: elements.exerciseTestCode.value.trim(),
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.email
        };
        
        // Validation
        if (!exerciseData.testCode || exerciseData.testCode.length === 0) {
            showToast('error', 'Validación', 'Debes agregar el código del test');
            elements.saveExerciseBtn.disabled = false;
            elements.saveExerciseBtn.innerHTML = '<i data-feather="save"></i> Guardar Ejercicio';
            feather.replace();
            return;
        }
        
        if (currentExerciseId) {
            // Update existing exercise
            await updateDoc(doc(db, 'exercises', currentExerciseId), exerciseData);
            console.log('✅ Ejercicio actualizado:', currentExerciseId);
            showToast('success', 'Éxito', 'Ejercicio actualizado correctamente');
        } else {
            // Create new exercise
            exerciseData.createdAt = serverTimestamp();
            exerciseData.createdBy = currentUser.email;
            
            const docRef = await addDoc(collection(db, 'exercises'), exerciseData);
            console.log('✅ Ejercicio creado:', docRef.id);
            showToast('success', 'Éxito', 'Ejercicio creado correctamente');
        }
        
        // Reload exercises and close modal
        loadExercises();
        closeExerciseModal();
        
    } catch (error) {
        console.error('❌ Error al guardar ejercicio:', error);
        showToast('error', 'Error', 'No se pudo guardar el ejercicio: ' + error.message);
        
        // Re-enable button
        elements.saveExerciseBtn.disabled = false;
        elements.saveExerciseBtn.innerHTML = '<i data-feather="save"></i> Guardar Ejercicio';
        feather.replace();
    }
}

// ==========================================
// EDIT/DELETE EXERCISE
// ==========================================
window.editExercise = function(exerciseId) {
    openExerciseModal(exerciseId);
};

window.deleteExercise = async function(exerciseId) {
    if (!isAdmin) {
        showToast('error', 'Acceso Denegado', 'No tienes permisos para realizar esta acción');
        return;
    }
    
    const confirmed = confirm('¿Estás seguro de que deseas eliminar este ejercicio? Esta acción no se puede deshacer.');
    
    if (!confirmed) return;
    
    try {
        await deleteDoc(doc(db, 'exercises', exerciseId));
        console.log('✅ Ejercicio eliminado:', exerciseId);
        showToast('success', 'Éxito', 'Ejercicio eliminado correctamente');
        loadExercises();
    } catch (error) {
        console.error('❌ Error al eliminar ejercicio:', error);
        showToast('error', 'Error', 'No se pudo eliminar el ejercicio');
    }
};

// ==========================================
// LOAD STATS
// ==========================================
async function loadStats() {
    try {
        // Total users
        const usersSnapshot = await getDocs(collection(db, 'usuarios'));
        document.getElementById('totalUsers').textContent = usersSnapshot.size;
        
        // Total exercises
        const exercisesSnapshot = await getDocs(collection(db, 'exercises'));
        document.getElementById('totalExercises').textContent = exercisesSnapshot.size;
        
        // Total submissions
        const submissionsSnapshot = await getDocs(collection(db, 'submissions'));
        document.getElementById('totalSubmissions').textContent = submissionsSnapshot.size;
        
        // Success rate
        const resultsSnapshot = await getDocs(collection(db, 'results'));
        let successCount = 0;
        resultsSnapshot.forEach(doc => {
            if (doc.data().status === 'success') {
                successCount++;
            }
        });
        const successRate = resultsSnapshot.size > 0 
            ? Math.round((successCount / resultsSnapshot.size) * 100) 
            : 0;
        document.getElementById('successRate').textContent = successRate + '%';
        
    } catch (error) {
        console.error('❌ Error al cargar estadísticas:', error);
    }
}

// ==========================================
// LOAD USERS
// ==========================================
async function loadUsers() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'usuarios'));
        const users = [];
        
        usersSnapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        
        renderUsers(users);
    } catch (error) {
        console.error('❌ Error al cargar usuarios:', error);
        showToast('error', 'Error', 'No se pudieron cargar los usuarios');
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No hay usuarios registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.firstName || ''} ${user.lastName || ''}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.matricula || 'N/A'}</td>
            <td>${user.githubUsername || 'N/A'}</td>
            <td>0</td>
            <td>
                <button class="icon-btn" title="Ver detalles">
                    <i data-feather="eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    feather.replace();
}

// ==========================================
// LOAD SUBMISSIONS
// ==========================================
async function loadSubmissions() {
    try {
        const submissionsSnapshot = await getDocs(
            query(collection(db, 'submissions'), orderBy('createdAt', 'desc'))
        );
        
        const submissions = [];
        submissionsSnapshot.forEach(doc => {
            submissions.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`✅ ${submissions.length} envíos cargados`);
        // TODO: Render submissions
    } catch (error) {
        console.error('❌ Error al cargar envíos:', error);
    }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(type, title, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        info: 'info'
    };
    
    toast.innerHTML = `
        <i data-feather="${icons[type]}" class="toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    elements.toastContainer.appendChild(toast);
    feather.replace();
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
