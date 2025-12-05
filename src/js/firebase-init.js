/**
 * @file firebase-init.js
 * Inicializa la app de Firebase y exporta instancias de Auth y Firestore.
 *
 * Este archivo importa la configuración secreta y expone los servicios principales
 * para ser usados en el resto de la aplicación.
 */

// Importa la configuración desde tu archivo secreto (que Git ignora)
import { firebaseConfig } from './firebase-config.js';

// Importa las herramientas de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * Instancia principal de la app de Firebase.
 * @type {import('firebase/app').FirebaseApp}
 */
const app = initializeApp(firebaseConfig);

/**
 * Instancia de Firebase Auth para autenticación de usuarios.
 * @type {import('firebase/auth').Auth}
 */
export const auth = getAuth(app);

/**
 * Instancia de Firestore para base de datos en tiempo real.
 * @type {import('firebase/firestore').Firestore}
 */
export const db = getFirestore(app);