// 1. Importa la configuración desde tu archivo secreto (que Git ignora)
import { firebaseConfig } from './firebase-config.js';

// 2. Importa las herramientas de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// 3. Inicializa y exporta (sin cambios)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);