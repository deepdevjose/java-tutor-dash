/**
 * admin-config.js
 * Configuración centralizada de administradores
 * 
 * Para agregar un nuevo administrador, simplemente añade su email a la lista ADMIN_EMAILS
 */

/**
 * Lista de emails autorizados como administradores
 * Cuando un usuario se registra con uno de estos emails,
 * automáticamente se le asigna el rol de administrador
 * 
 * IMPORTANTE: Los emails deben estar en minúsculas
 */
export const ADMIN_EMAILS = [
    'fcuadros@itsoeh.edu.mx',
    'deepdevjose@itsoeh.edu.mx',
    '230110197@itsoeh.edu.mx',
    '230110073@itsoeh.edu.mx',
    '230110449@itsoeh.edu.mx',
    '230110874@itsoeh.edu.mx',
    '230110443@itsoeh.edu.mx',
    '230110050@itsoeh.edu.mx',
    '230110166@itsoeh.edu.mx',
    '230110084@itsoeh.edu.mx',
    '230110063@itsoeh.edu.mx',
    '230110077@itsoeh.edu.mx',
    'galy7977@gmail.com',
    '230110689@itsoeh.edu.mx',
    '230110313@itsoeh.edu.mx',
    '230110530@itsoeh.edu.mx',
    '230110581@itsoeh.edu.mx',
    '230110579@itsoeh.edu.mx'
    // Agrega más emails aquí según sea necesario
    // 'profesor@itsoeh.edu.mx',
    // 'admin@itsoeh.edu.mx',
];

/**
 * Verifica si un email está en la lista de administradores
 * @param {string} email - Email a verificar
 * @returns {boolean} True si es email de admin
 */
export function isAdminEmail(email) {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Permisos por defecto para administradores
 */
export const DEFAULT_ADMIN_PERMISSIONS = {
    createExercises: true,
    editExercises: true,
    deleteExercises: true,
    viewAllSubmissions: true,
    manageUsers: true,
    viewAnalytics: true
};
