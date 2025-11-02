/**
 * settings.js - Gestión de configuración de usuario
 * Maneja actualización de datos personales, cambio de contraseña y eliminación de cuenta
 */

import { auth, db } from './firebase-init.js';
import {
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    deleteUser
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

// ==========================================
// LOGGING UTILITIES
// ==========================================

const isDevelopment = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function logDebug(...args) {
    if (isDevelopment()) console.log('[Settings Debug]', ...args);
}

function logError(...args) {
    console.error('[Settings Error]', ...args);
}

// ==========================================
// DOM ELEMENTS
// ==========================================

const elements = {
    // Forms
    personalInfoForm: document.getElementById('personalInfoForm'),
    securityForm: document.getElementById('securityForm'),
    
    // Personal Info Inputs
    firstName: document.getElementById('firstName'),
    middleName: document.getElementById('middleName'),
    apellidoPaterno: document.getElementById('apellidoPaterno'),
    apellidoMaterno: document.getElementById('apellidoMaterno'),
    semester: document.getElementById('semester'),
    group: document.getElementById('group'),
    
    // Security Inputs
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    
    // Password Strength
    passwordStrength: document.getElementById('passwordStrength'),
    strengthFill: document.getElementById('strengthFill'),
    strengthText: document.getElementById('strengthText'),
    
    // Delete Account Modal
    deleteAccountBtn: document.getElementById('deleteAccountBtn'),
    deleteAccountModal: document.getElementById('deleteAccountModal'),
    closeDeleteModal: document.getElementById('closeDeleteModal'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteInput: document.getElementById('confirmDeleteInput'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    
    // Sidebar
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    mobileSidebarToggle: document.getElementById('mobileSidebarToggle'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebar: document.querySelector('.sidebar')
};

// ==========================================
// SHOW TOAST NOTIFICATION
// ==========================================

function showToast(type, title, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    
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
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    
    setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast) {
    if (!toast) return;
    toast.style.animation = 'slideInFromRight 0.3s ease-out reverse';
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// ==========================================
// ERROR HANDLING
// ==========================================

function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    
    if (errorElement && inputElement) {
        errorElement.textContent = message;
        errorElement.classList.add('active');
        inputElement.classList.add('error');
    }
}

function clearFieldError(fieldId) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    
    if (errorElement && inputElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('active');
        inputElement.classList.remove('error');
    }
}

function clearAllErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    const errorInputs = document.querySelectorAll('.error');
    
    errorMessages.forEach(el => {
        el.textContent = '';
        el.classList.remove('active');
    });
    
    errorInputs.forEach(el => el.classList.remove('error'));
}

// ==========================================
// PASSWORD STRENGTH CHECKER
// ==========================================

function checkPasswordStrength(password) {
    if (!password) {
        elements.passwordStrength.classList.remove('active');
        return;
    }
    
    elements.passwordStrength.classList.add('active');
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    
    // Character variety
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    // Determine strength level
    let level, text;
    
    if (strength <= 2) {
        level = 'weak';
        text = 'Débil';
    } else if (strength <= 4) {
        level = 'medium';
        text = 'Media';
    } else {
        level = 'strong';
        text = 'Fuerte';
    }
    
    // Update UI
    elements.strengthFill.className = `strength-fill ${level}`;
    elements.strengthText.className = `strength-text ${level}`;
    elements.strengthText.textContent = `Contraseña: ${text}`;
}

// ==========================================
// TOGGLE PASSWORD VISIBILITY
// ==========================================

function setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const input = document.getElementById(targetId);
            
            if (input.type === 'password') {
                input.type = 'text';
                button.innerHTML = '<i data-feather="eye-off"></i>';
            } else {
                input.type = 'password';
                button.innerHTML = '<i data-feather="eye"></i>';
            }
            
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        });
    });
}

// ==========================================
// LOAD USER DATA
// ==========================================

async function loadUserData(user) {
    try {
        logDebug('Cargando datos del usuario...');
        
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Cargar datos personales
            if (userData.firstName) elements.firstName.value = userData.firstName;
            if (userData.middleName) elements.middleName.value = userData.middleName;
            if (userData.apellidoPaterno) elements.apellidoPaterno.value = userData.apellidoPaterno;
            if (userData.apellidoMaterno) elements.apellidoMaterno.value = userData.apellidoMaterno;
            if (userData.semestre) elements.semester.value = userData.semestre;
            if (userData.grupo) elements.group.value = userData.grupo;
            
            // Cargar avatar y nombre en sidebar
            if (userData.githubUsername) {
                const avatarUrl = `https://github.com/${userData.githubUsername}.png`;
                elements.userAvatar.src = avatarUrl;
                elements.userName.textContent = userData.githubUsername;
            }
            
            logDebug('✅ Datos cargados correctamente');
        } else {
            logError('No se encontraron datos del usuario');
        }
    } catch (error) {
        logError('Error al cargar datos:', error);
        showToast('error', 'Error', 'No se pudieron cargar tus datos');
    }
}

// ==========================================
// UPDATE PERSONAL INFO
// ==========================================

async function updatePersonalInfo(e) {
    e.preventDefault();
    clearAllErrors();
    
    const user = auth.currentUser;
    if (!user) {
        showToast('error', 'Error', 'No hay sesión activa');
        return;
    }
    
    // Validaciones
    const firstName = elements.firstName.value.trim();
    const middleName = elements.middleName.value.trim();
    const apellidoPaterno = elements.apellidoPaterno.value.trim();
    const apellidoMaterno = elements.apellidoMaterno.value.trim();
    const semester = elements.semester.value;
    const group = elements.group.value.trim().toUpperCase();
    
    let hasErrors = false;
    
    if (!firstName || firstName.length < 2) {
        showFieldError('firstName', 'El primer nombre debe tener al menos 2 caracteres');
        hasErrors = true;
    }
    
    if (!apellidoPaterno || apellidoPaterno.length < 2) {
        showFieldError('apellidoPaterno', 'El apellido paterno debe tener al menos 2 caracteres');
        hasErrors = true;
    }
    
    if (!apellidoMaterno || apellidoMaterno.length < 2) {
        showFieldError('apellidoMaterno', 'El apellido materno debe tener al menos 2 caracteres');
        hasErrors = true;
    }
    
    if (!semester) {
        showFieldError('semester', 'Selecciona tu semestre');
        hasErrors = true;
    }
    
    if (!group || !/^[A-Z]{1,2}$/.test(group)) {
        showFieldError('group', 'Ingresa un grupo válido (ej: A, B, C)');
        hasErrors = true;
    }
    
    if (hasErrors) return;
    
    try {
        // Deshabilitar botón
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-feather="loader"></i> Guardando...';
        if (typeof feather !== 'undefined') feather.replace();
        
        // Actualizar en Firestore
        await updateDoc(doc(db, 'usuarios', user.uid), {
            firstName: firstName,
            middleName: middleName,
            apellidoPaterno: apellidoPaterno,
            apellidoMaterno: apellidoMaterno,
            semestre: semester,
            grupo: group
        });
        
        logDebug('✅ Información personal actualizada');
        showToast('success', '¡Guardado!', 'Tu información ha sido actualizada');
        
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-feather="save"></i> Guardar Cambios';
        if (typeof feather !== 'undefined') feather.replace();
        
    } catch (error) {
        logError('Error al actualizar información:', error);
        showToast('error', 'Error', 'No se pudo guardar la información');
        
        // Restaurar botón
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-feather="save"></i> Guardar Cambios';
        if (typeof feather !== 'undefined') feather.replace();
    }
}

// ==========================================
// CHANGE PASSWORD
// ==========================================

async function changePassword(e) {
    e.preventDefault();
    clearAllErrors();
    
    const user = auth.currentUser;
    if (!user) {
        showToast('error', 'Error', 'No hay sesión activa');
        return;
    }
    
    const currentPass = elements.currentPassword.value;
    const newPass = elements.newPassword.value;
    const confirmPass = elements.confirmPassword.value;
    
    let hasErrors = false;
    
    // Validaciones
    if (!currentPass) {
        showFieldError('currentPassword', 'Ingresa tu contraseña actual');
        hasErrors = true;
    }
    
    if (!newPass || newPass.length < 8) {
        showFieldError('newPassword', 'La contraseña debe tener al menos 8 caracteres');
        hasErrors = true;
    }
    
    if (newPass !== confirmPass) {
        showFieldError('confirmPassword', 'Las contraseñas no coinciden');
        hasErrors = true;
    }
    
    if (currentPass === newPass) {
        showFieldError('newPassword', 'La nueva contraseña debe ser diferente a la actual');
        hasErrors = true;
    }
    
    if (hasErrors) return;
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-feather="loader"></i> Cambiando...';
        if (typeof feather !== 'undefined') feather.replace();
        
        // Reautenticar usuario
        const credential = EmailAuthProvider.credential(user.email, currentPass);
        await reauthenticateWithCredential(user, credential);
        
        // Cambiar contraseña
        await updatePassword(user, newPass);
        
        logDebug('✅ Contraseña cambiada exitosamente');
        showToast('success', '¡Contraseña Cambiada!', 'Tu contraseña ha sido actualizada');
        
        // Limpiar formulario
        elements.securityForm.reset();
        elements.passwordStrength.classList.remove('active');
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-feather="shield"></i> Cambiar Contraseña';
        if (typeof feather !== 'undefined') feather.replace();
        
    } catch (error) {
        logError('Error al cambiar contraseña:', error);
        
        if (error.code === 'auth/wrong-password') {
            showFieldError('currentPassword', 'Contraseña actual incorrecta');
        } else if (error.code === 'auth/weak-password') {
            showFieldError('newPassword', 'La contraseña es muy débil');
        } else {
            showToast('error', 'Error', 'No se pudo cambiar la contraseña');
        }
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-feather="shield"></i> Cambiar Contraseña';
        if (typeof feather !== 'undefined') feather.replace();
    }
}

// ==========================================
// DELETE ACCOUNT
// ==========================================

function showDeleteModal() {
    elements.deleteAccountModal.classList.add('active');
    elements.deleteAccountModal.setAttribute('aria-hidden', 'false');
    elements.confirmDeleteInput.value = '';
    elements.confirmDeleteBtn.disabled = true;
}

function hideDeleteModal() {
    elements.deleteAccountModal.classList.remove('active');
    elements.deleteAccountModal.setAttribute('aria-hidden', 'true');
    elements.confirmDeleteInput.value = '';
}

function validateDeleteConfirmation() {
    const inputValue = elements.confirmDeleteInput.value;
    elements.confirmDeleteBtn.disabled = inputValue !== 'Adios vaquero!';
}

async function deleteAccount() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        // Primero, pedir al usuario que confirme con su contraseña
        const password = prompt('Por seguridad, ingresa tu contraseña actual para confirmar la eliminación de la cuenta:');
        
        if (!password) {
            showToast('info', 'Cancelado', 'Eliminación de cuenta cancelada');
            return;
        }
        
        elements.confirmDeleteBtn.disabled = true;
        elements.confirmDeleteBtn.innerHTML = '<i data-feather="loader"></i> Eliminando...';
        if (typeof feather !== 'undefined') feather.replace();
        
        // Re-autenticar al usuario antes de eliminar
        try {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            logDebug('✅ Usuario re-autenticado exitosamente');
        } catch (reauthError) {
            logError('Error al re-autenticar:', reauthError);
            
            if (reauthError.code === 'auth/wrong-password') {
                showToast('error', 'Contraseña incorrecta', 'La contraseña ingresada no es correcta');
            } else if (reauthError.code === 'auth/too-many-requests') {
                showToast('error', 'Demasiados intentos', 'Has intentado demasiadas veces. Espera un momento e intenta de nuevo');
            } else {
                showToast('error', 'Error de autenticación', 'No se pudo verificar tu identidad. Intenta de nuevo');
            }
            
            // Restaurar botón
            elements.confirmDeleteBtn.disabled = false;
            elements.confirmDeleteBtn.innerHTML = '<i data-feather="trash-2"></i> Eliminar cuenta';
            if (typeof feather !== 'undefined') feather.replace();
            return;
        }
        
        // 1. PRIMERO: Obtener datos del usuario ANTES de eliminar
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        let githubUsername = null;
        let matricula = null;
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            githubUsername = userData.githubUsername;
            matricula = userData.matricula;
        }
        
        logDebug('🗑️ Iniciando eliminación completa de cuenta...');
        
        // 2. Eliminar todos los CODE DRAFTS del usuario
        try {
            const draftsRef = collection(db, 'code_drafts');
            const draftsQuery = query(draftsRef, where('userId', '==', user.uid));
            const draftsSnapshot = await getDocs(draftsQuery);
            
            logDebug(`📝 Encontrados ${draftsSnapshot.size} code drafts para eliminar`);
            
            const draftDeletePromises = [];
            draftsSnapshot.forEach((draftDoc) => {
                draftDeletePromises.push(deleteDoc(doc(db, 'code_drafts', draftDoc.id)));
            });
            
            await Promise.all(draftDeletePromises);
            logDebug('✅ Todos los code drafts eliminados');
        } catch (error) {
            logDebug('⚠️ Error al eliminar code drafts (puede que no existan):', error.code);
        }
        
        // 3. Eliminar todos los SUBMISSIONS del usuario
        try {
            const submissionsRef = collection(db, 'submissions');
            const submissionsQuery = query(submissionsRef, where('userId', '==', user.uid));
            const submissionsSnapshot = await getDocs(submissionsQuery);
            
            logDebug(`📄 Encontrados ${submissionsSnapshot.size} submissions para eliminar`);
            
            const submissionDeletePromises = [];
            submissionsSnapshot.forEach((submissionDoc) => {
                submissionDeletePromises.push(deleteDoc(doc(db, 'submissions', submissionDoc.id)));
            });
            
            await Promise.all(submissionDeletePromises);
            logDebug('✅ Todos los submissions eliminados');
        } catch (error) {
            logDebug('⚠️ Error al eliminar submissions:', error.code);
            if (error.code === 'permission-denied') {
                throw new Error('No tienes permisos para eliminar tus submissions. Contacta al administrador.');
            }
        }
        
        // 4. Eliminar todos los RESULTS del usuario
        try {
            const resultsRef = collection(db, 'results');
            const resultsQuery = query(resultsRef, where('userId', '==', user.uid));
            const resultsSnapshot = await getDocs(resultsQuery);
            
            logDebug(`📊 Encontrados ${resultsSnapshot.size} results para eliminar`);
            
            const resultsDeletePromises = [];
            resultsSnapshot.forEach((resultDoc) => {
                resultsDeletePromises.push(deleteDoc(doc(db, 'results', resultDoc.id)));
            });
            
            await Promise.all(resultsDeletePromises);
            logDebug('✅ Todos los results eliminados');
        } catch (error) {
            logDebug('⚠️ Error al eliminar results:', error.code);
            if (error.code === 'permission-denied') {
                throw new Error('No tienes permisos para eliminar tus results. Contacta al administrador.');
            }
        }
        
        // 5. Eliminar mapping de GitHub username si existe
        if (githubUsername) {
            try {
                await deleteDoc(doc(db, 'github_usernames', githubUsername.toLowerCase()));
                logDebug('✅ GitHub username mapping eliminado:', githubUsername);
            } catch (error) {
                logDebug('⚠️ Error al eliminar GitHub mapping:', error.code);
            }
        }
        
        // 6. Eliminar mapping de matrícula si existe
        if (matricula) {
            try {
                await deleteDoc(doc(db, 'matriculas', matricula));
                logDebug('✅ Matrícula mapping eliminado:', matricula);
            } catch (error) {
                logDebug('⚠️ Error al eliminar matrícula mapping:', error.code);
            }
        }
        
        // 7. Eliminar documento del usuario
        await deleteDoc(userDocRef);
        logDebug('✅ Documento de usuario eliminado');
        
        // 8. FINALMENTE: Eliminar usuario de Auth
        await deleteUser(user);
        logDebug('✅ Usuario eliminado de Auth');
        
        logDebug('✅ Cuenta eliminada exitosamente - TODO borrado');
        
        // Redirigir a página de inicio
        window.location.href = '../../index.html';
        
    } catch (error) {
        logError('Error al eliminar cuenta:', error);
        
        let errorMessage = 'No se pudo eliminar la cuenta completamente.';
        
        if (error.message.includes('permisos')) {
            errorMessage = error.message;
        } else if (error.code === 'permission-denied') {
            errorMessage = 'No tienes permisos suficientes. Verifica las reglas de seguridad de Firestore.';
        }
        
        showToast('error', 'Error de Permisos', errorMessage);
        
        // Restaurar botón
        elements.confirmDeleteBtn.disabled = false;
        elements.confirmDeleteBtn.innerHTML = '<i data-feather="trash-2"></i> Eliminar cuenta';
        if (typeof feather !== 'undefined') feather.replace();
    }
}

// ==========================================
// SIDEBAR MANAGEMENT
// ==========================================

function setupSidebar() {
    const sidebar = elements.sidebar;
    const sidebarToggle = elements.sidebarToggle;
    const mobileSidebarToggle = elements.mobileSidebarToggle;
    const sidebarOverlay = elements.sidebarOverlay;
    
    const toggleSidebar = () => {
        const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        
        // Manejar overlay en móviles
        const isMobile = window.innerWidth <= 1024;
        if (isMobile && sidebarOverlay) {
            if (isCurrentlyCollapsed) {
                sidebarOverlay.classList.add('active');
            } else {
                sidebarOverlay.classList.remove('active');
            }
        }
        
        localStorage.setItem('sidebarCollapsed', !isCurrentlyCollapsed);
    };
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    if (mobileSidebarToggle) {
        mobileSidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
            sidebarOverlay.classList.remove('active');
            localStorage.setItem('sidebarCollapsed', true);
        });
    }
    
    // Cargar estado inicial
    const isMobile = window.innerWidth <= 1024;
    const savedStateCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    if (isMobile) {
        sidebar.classList.add('collapsed');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    } else {
        if (savedStateCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }
    
    // Manejar resize
    window.addEventListener('resize', () => {
        const isMobileNow = window.innerWidth <= 1024;
        if (!isMobileNow && sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
    });
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    logDebug('Inicializando página de configuración...');
    
    // Setup sidebar
    setupSidebar();
    
    // Setup password toggles
    setupPasswordToggles();
    
    // Setup password strength checker
    if (elements.newPassword) {
        elements.newPassword.addEventListener('input', (e) => {
            checkPasswordStrength(e.target.value);
        });
    }
    
    // Setup delete confirmation input
    if (elements.confirmDeleteInput) {
        elements.confirmDeleteInput.addEventListener('input', validateDeleteConfirmation);
    }
    
    // Form submissions
    if (elements.personalInfoForm) {
        elements.personalInfoForm.addEventListener('submit', updatePersonalInfo);
    }
    
    if (elements.securityForm) {
        elements.securityForm.addEventListener('submit', changePassword);
    }
    
    // Delete account modal
    if (elements.deleteAccountBtn) {
        elements.deleteAccountBtn.addEventListener('click', showDeleteModal);
    }
    
    if (elements.closeDeleteModal) {
        elements.closeDeleteModal.addEventListener('click', hideDeleteModal);
    }
    
    if (elements.cancelDeleteBtn) {
        elements.cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    }
    
    if (elements.confirmDeleteBtn) {
        elements.confirmDeleteBtn.addEventListener('click', deleteAccount);
    }
    
    // Auth state listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            logDebug('✅ Usuario autenticado:', user.email);
            loadUserData(user);
        } else {
            logDebug('❌ No hay usuario autenticado, redirigiendo...');
            window.location.href = 'signin.html';
        }
    });
    
    logDebug('✅ Página de configuración inicializada');
});
