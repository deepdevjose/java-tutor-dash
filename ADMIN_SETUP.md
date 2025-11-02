# Configuración de Administradores

## 🚀 Sistema Automático de Detección de Admins

El sistema ahora detecta **automáticamente** si un usuario es administrador durante el registro.

### ✅ Cómo Funciona:

1. **Lista Centralizada**: Los emails de administradores están en `src/js/admin-config.js`
2. **Detección Automática**: Al registrarse, el sistema verifica si el email está en la lista
3. **Creación Automática**: Si es admin, se crea automáticamente el documento en la colección `admins`
4. **Sin Configuración Manual**: No necesitas hacer nada en Firebase Console

### 📝 Agregar un Nuevo Administrador:

**Opción 1: Antes del Registro (Recomendado)**

Simplemente edita el archivo `src/js/admin-config.js` y agrega el email:

```javascript
export const ADMIN_EMAILS = [
    'fcuadros@itsoeh.edu.mx',
    'deepdevjose@itsoeh.edu.mx',
    'nuevoadmin@itsoeh.edu.mx',  // ⬅️ Agregar aquí
];
```

Luego el usuario se registra normalmente y automáticamente será admin.

**Opción 2: Después del Registro**

Si el usuario ya se registró como estudiante, puedes crear manualmente el documento en Firebase Console:

```javascript
db.collection('admins').doc('email@itsoeh.edu.mx').set({
  email: 'email@itsoeh.edu.mx',
  uid: 'UID_DEL_USUARIO',
  githubUsername: 'username',
  matricula: 'matricula',
  firstName: 'Nombre',
  lastName: 'Apellidos',
  role: 'admin',
  createdAt: new Date().toISOString(),
  permissions: {
    createExercises: true,
    editExercises: true,
    deleteExercises: true,
    viewAllSubmissions: true,
    manageUsers: true,
    viewAnalytics: true
  }
});
```

### 🔐 Administradores Actuales:

1. **fcuadros@itsoeh.edu.mx** (fcuadrosgithub)
2. **deepdevjose@itsoeh.edu.mx** (deepdevjose / 230110688)

### 📋 Permisos de Administrador:

Por defecto, los administradores tienen estos permisos:

- ✅ Crear ejercicios
- ✅ Editar ejercicios
- ✅ Eliminar ejercicios
- ✅ Ver todos los envíos
- ✅ Gestionar usuarios
- ✅ Ver analíticas

### 🔒 Reglas de Seguridad:

Las reglas de Firestore permiten que durante el signup se cree automáticamente el documento en `admins` si:
1. El usuario está autenticado
2. El email del token de Auth coincide con el email del documento
3. El email está en la lista de `ADMIN_EMAILS`

---

## 2. Estructura de Ejercicios

Los ejercicios en Firestore tienen la siguiente estructura:

```javascript
{
  id: "ejercicio-1",
  title: "Suma de dos números",
  description: "Escribe un programa que sume dos números",
  difficulty: "easy", // easy, medium, hard
  category: "basicos",
  points: 10,
  templateCode: "public class Main {\n  public static void main(String[] args) {\n    // Tu código aquí\n  }\n}",
  tests: [
    {
      id: "test-1",
      name: "Test básico",
      input: "5 3",
      expectedOutput: "8",
      points: 5,
      isHidden: false
    },
    {
      id: "test-2",
      name: "Test con negativos",
      input: "-2 7",
      expectedOutput: "5",
      points: 5,
      isHidden: true
    }
  ],
  createdBy: "deepdevjose@itsoeh.edu.mx",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## 3. Publicar Reglas de Firestore

Las reglas están en el archivo `firestore.rules`. Para publicarlas:

1. Ve a Firebase Console → Firestore Database → Rules
2. Copia el contenido de `firestore.rules`
3. Haz clic en "Publicar"

**O usa Firebase CLI:**

```bash
firebase deploy --only firestore:rules
```

## 4. Uso del Panel de Administración

1. **Acceso**: Los usuarios admin verán automáticamente el enlace "Panel de Admin" en el sidebar
2. **Crear Ejercicio**: Haz clic en "Nuevo Ejercicio" en el panel
3. **Tests Dinámicos**: Usa el botón "Agregar Test" para añadir cuantos tests necesites
4. **Editar/Eliminar**: Usa los botones en cada tarjeta de ejercicio

## 5. Solución de Problemas

**El enlace "Panel de Admin" no aparece:**
- Verifica que el email esté en `ADMIN_EMAILS`
- Verifica que el documento exista en la colección `admins`
- Revisa la consola del navegador para errores

**No puedo crear ejercicios:**
- Asegúrate de que las reglas de Firestore estén publicadas
- Verifica que el documento de admin tenga `permissions.createExercises: true`

**Error de permisos al registrarse como admin:**
- Verifica que las reglas de Firestore permitan la creación de documentos en `admins`
- Asegúrate de que el email esté en `ADMIN_EMAILS` antes del registro

