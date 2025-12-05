// ==========================================
// STATS UPDATER - Sistema de stats agregados sin Cloud Functions
// ==========================================

import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

// Configuración
const STATS_DOC_ID = 'general';
const STATS_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutos
const STATS_LOCK_DURATION = 30 * 1000; // 30 segundos (lock para evitar actualizaciones simultáneas)

/**
 * Verifica si las stats necesitan actualizarse
 */
async function shouldUpdateStats() {
    try {
        const statsDoc = await getDoc(doc(db, 'stats', STATS_DOC_ID));
        
        if (!statsDoc.exists()) {
            return true; // Crear stats por primera vez
        }
        
        const data = statsDoc.data();
        const lastUpdate = data.lastUpdate?.toMillis() || 0;
        const now = Date.now();
        
        // Si tiene lock y no ha expirado, no actualizar
        if (data.updateLock && (now - data.updateLock) < STATS_LOCK_DURATION) {
            console.log('⏳ Stats actualizándose por otro cliente...');
            return false;
        }
        
        // Si pasaron más de 5 minutos, actualizar
        return (now - lastUpdate) > STATS_UPDATE_INTERVAL;
        
    } catch (error) {
        // Si no tiene permisos para leer, simplemente no actualizar
        if (error.code === 'permission-denied') {
            console.log('⚠️ Usuario sin permisos para actualizar stats');
            return false;
        }
        console.error('❌ Error verificando stats:', error);
        return false;
    }
}

/**
 * Calcula y actualiza las estadísticas agregadas
 */
async function updateAggregatedStats() {
    try {
        console.log('📊 Actualizando estadísticas agregadas...');
        
        const statsRef = doc(db, 'stats', STATS_DOC_ID);
        
        // Poner lock temporal
        await setDoc(statsRef, {
            updateLock: Date.now()
        }, { merge: true });
        
        // Calcular stats en paralelo
        const [usersSnapshot, exercisesSnapshot, submissionsSnapshot, resultsSnapshot] = await Promise.all([
            getDocs(collection(db, 'usuarios')),
            getDocs(collection(db, 'exercises')),
            getDocs(collection(db, 'submissions')),
            getDocs(collection(db, 'results'))
        ]);
        
        // Contar submissions exitosas
        let successCount = 0;
        resultsSnapshot.forEach(doc => {
            if (doc.data().status === 'success') {
                successCount++;
            }
        });
        
        const successRate = resultsSnapshot.size > 0 
            ? Math.round((successCount / resultsSnapshot.size) * 100) 
            : 0;
        
        // Guardar stats actualizadas
        await setDoc(statsRef, {
            totalUsers: usersSnapshot.size,
            totalExercises: exercisesSnapshot.size,
            totalSubmissions: submissionsSnapshot.size,
            successCount: successCount,
            totalResults: resultsSnapshot.size,
            successRate: successRate,
            lastUpdate: new Date(),
            updateLock: null // Liberar lock
        });
        
        console.log('✅ Stats actualizadas:', {
            users: usersSnapshot.size,
            exercises: exercisesSnapshot.size,
            submissions: submissionsSnapshot.size,
            successRate: successRate + '%'
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ Error actualizando stats:', error);
        
        // Solo intentar liberar lock si el error NO es de permisos
        if (error.code !== 'permission-denied') {
            try {
                await updateDoc(doc(db, 'stats', STATS_DOC_ID), {
                    updateLock: null
                });
            } catch (e) {
                // Silenciar error si es de permisos
                if (e.code !== 'permission-denied') {
                    console.warn('⚠️ Error liberando lock:', e.message);
                }
            }
        }
        
        return false;
    }
}

/**
 * Intenta actualizar stats si es necesario
 * Llamar esta función cuando un admin entre al panel
 */
export async function tryUpdateStats() {
    try {
        const shouldUpdate = await shouldUpdateStats();
        
        if (shouldUpdate) {
            // Actualizar en segundo plano (no bloquear UI)
            updateAggregatedStats().catch(err => {
                // Silenciar errores de permisos
                if (err.code !== 'permission-denied') {
                    console.error('Error en actualización de stats:', err);
                }
            });
        } else {
            console.log('📊 Stats actualizadas recientemente, usando caché');
        }
        
    } catch (error) {
        // Silenciar errores de permisos
        if (error.code !== 'permission-denied') {
            console.error('❌ Error en tryUpdateStats:', error);
        }
    }
}

/**
 * Incrementa un contador específico de stats
 * Llamar cuando se crea algo nuevo (usuario, ejercicio, submission)
 */
export async function incrementStat(statName, value = 1) {
    try {
        const statsRef = doc(db, 'stats', STATS_DOC_ID);
        await updateDoc(statsRef, {
            [statName]: increment(value),
            lastUpdate: new Date()
        });
        console.log(`✅ Stat incrementada: ${statName} +${value}`);
    } catch (error) {
        // Si no existe el documento, crearlo (solo admins pueden)
        if (error.code === 'not-found') {
            console.log('📊 Creando documento de stats por primera vez...');
            await updateAggregatedStats();
        } else if (error.code === 'permission-denied') {
            // Usuario sin permisos, silenciar error (es esperado para usuarios normales)
            console.log(`⚠️ Sin permisos para incrementar stat: ${statName}`);
        } else {
            console.error('❌ Error incrementando stat:', error);
        }
    }
}

/**
 * Inicializa el sistema de stats (crear documento si no existe)
 * Solo debe ejecutarse para admins o en background sin bloquear
 */
export async function initializeStats() {
    try {
        const statsDoc = await getDoc(doc(db, 'stats', STATS_DOC_ID));
        
        if (!statsDoc.exists()) {
            console.log('📊 Documento de stats no existe, será creado cuando un admin entre al panel');
            // No intentar crear aquí, esperar a que un admin lo haga
            return;
        }
        
    } catch (error) {
        // Silenciar errores de permisos (usuarios normales)
        if (error.code === 'permission-denied') {
            console.log('ℹ️ Stats: Esperando inicialización por admin');
        } else {
            console.warn('⚠️ Error verificando stats:', error.message);
        }
    }
}
