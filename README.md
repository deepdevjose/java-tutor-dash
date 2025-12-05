
# Java Tutor Dash ☕

## Demo
https://java-tutor-dash.pages.dev/

---

Este proyecto es el **frontend** de un dashboard web para estudiantes de Java. Permite registro, inicio de sesión seguro y visualización de estadísticas personalizadas.

Backend: **Firebase** (Auth + Firestore). Despliegue: **Cloudflare Pages** + **GitHub Actions**.

---

## ✨ Características Principales

* **Flujo de Autenticación:**
    * Registro de nuevos usuarios (Sign Up) con campos validados como **Correo Electrónico**, **GitHub Username** y **Matrícula**.
    * **Unicidad garantizada**: Sistema de mapeo con transacciones atómicas para prevenir duplicados de GitHub username y matrícula.
    * Inicio de sesión (Sign In) flexible: Usa **email**, **matrícula** o **GitHub username** como identificador.
    * Verificación de cuenta por correo electrónico.
    * Restablecimiento de contraseña.
* **Dashboard Personalizado:**
    * Panel de bienvenida con estadísticas de progreso (pasados, fallados, progreso total).
    * Integración con la API de GitHub para cargar el **avatar** (con cache y retry automático).
    * Monitoreo de inactividad con modal de advertencia antes del logout.
    * Control multi-tab: sincronización de sesión entre pestañas.
* **Gestión de Sesión Robusta:**
    * Persistencia de sesión (Recordarme).
    * Cierre de sesión automático por inactividad (20 min con aviso a los 18 min).
    * Cleanup automático de listeners y subscripciones.
* **Seguridad:**
    * Rutas protegidas: El dashboard es inaccesible a menos que el usuario esté autenticado **y** su correo esté verificado.
    * Reglas de seguridad en Firestore para que un usuario solo pueda leer/escribir sus propios datos.
    * **Sistema de mapeo único**: Colecciones separadas (`github_usernames`, `matriculas`) con lookups O(1).
    * Rollback automático si falla la creación del usuario.
    * Logs solo en desarrollo (sin leaks en producción).
    * XSS protection: Uso de DOM API en lugar de innerHTML.
* **Accesibilidad (A11y):**
    * ARIA labels completos (`aria-invalid`, `aria-describedby`, `aria-live`).
    * Soporte completo de teclado en sidebar y modales.
    * Focus management apropiado en errores.
* **Diseño Moderno:**
    * Tema oscuro profesional y limpio.
    * Diseño responsivo que se adapta a móviles.

---

## 🛠️ Stack Tecnológico

| Categoría | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript | Aplicación con Vanilla JS y ES6 Modules. |
| **Backend (BaaS)** | Firebase | **Authentication** para el login y **Cloud Firestore** como base de datos NoSQL. |
| **Integraciones** | GitHub API | Usada para obtener información de perfil (commit, avatar). |
| **Despliegue** | Cloudflare Pages | Hosting estático global. |
| **CI/CD** | GitHub Actions | Automatización del build y despliegue seguro. |

---

## 🔧 Configuración Inicial

### 1. Clonar el Repositorio
```bash
git clone https://github.com/deepdevjose/java-tutor-dash.git
cd java-tutor-dash
```

### 2. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o usa uno existente
3. Habilita **Authentication** → **Email/Password**
4. Crea una base de datos **Cloud Firestore**
5. **IMPORTANTE**: Copia y aplica las reglas de seguridad de `FIRESTORE_RULES.md`
6. Obtén tu configuración de Firebase (Project Settings → General → Your apps)
7. Crea el archivo `src/js/firebase-config.js` con tu configuración:

```javascript
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 3. Estructura de Firestore

El sistema utiliza 3 colecciones principales:

```
usuarios/{uid}           # Datos completos del usuario
github_usernames/{name}  # Mapeo: GitHub username → uid
matriculas/{number}      # Mapeo: Matrícula → uid
```

**Ver documentación completa en**: `FIRESTORE_RULES.md`

### 4. Servidor Local

```bash
# Opción 1: Python
python -m http.server 8000

# Opción 2: Node.js
npx serve src

# Opción 3: VS Code Live Server
# Instala la extensión "Live Server" y abre index.html
```

Navega a `http://localhost:8000`

---

## 🏗️ Arquitectura

### Sistema de Unicidad de Identificadores

El proyecto implementa un sistema robusto para garantizar la unicidad de GitHub usernames y matrículas:

#### **Problema Resuelto**
Anteriormente, usar `query()` + `where()` + `limit(1)` podía devolver resultados ambiguos si había duplicados. La solución usa **colecciones de mapeo** con **transacciones atómicas**.

#### **Solución Implementada**
1. **Signup** (`signup.js`):
   - Crea usuario en Firebase Auth
   - Ejecuta transacción atómica que:
     - Verifica que `github_usernames/{username}` no exista
     - Verifica que `matriculas/{number}` no exista
     - Crea ambos documentos de mapeo + documento de usuario
     - **Todo-o-nada**: Si falla cualquier paso, hace rollback completo

2. **Signin** (`signin.js`):
   - Usa `getDoc()` directo (O(1) lookup) en lugar de queries
   - Busca en `github_usernames/{username}` o `matriculas/{number}`
   - Obtiene el email directamente del mapeo
   - No hay ambigüedad posible

#### **Beneficios**
- ✅ Garantía de unicidad incluso con concurrencia alta
- ✅ Lookups O(1) (mucho más rápidos que queries)
- ✅ No hay race conditions
- ✅ Rollback automático si falla cualquier paso

---

## 🔐 Seguridad

**Principales medidas:**

- **Prevención de XSS:** Manipulación segura del DOM, sin `innerHTML` para datos de usuario.
- **Logging controlado:** Solo en desarrollo, sin leaks en producción.
- **Validación estricta:** Email (Gmail/ITSOEH), GitHub (AbortController), matrícula y grupo.
- **Gestión de estado:** Flag `isSubmitting`, cleanup de listeners, control multi-tab.
- **Reglas Firestore:** Solo el usuario accede a sus datos; mapeos públicos solo para ver disponibilidad.

---

## 🚀 Mejoras Futuras

### 1. **GitHub OAuth** (Prioridad Alta)
- Implementar autenticación con GitHub usando `signInWithPopup()`
- Obtener GitHub ID numérico (más estable que username)
- Verificar propiedad real de la cuenta

### 2. **Tests Automatizados**
- Unit tests para funciones de validación
- E2E tests para flujo completo de signup/signin
- Tests de reglas de Firestore
### 3. **Monitoreo y Analytics**
- Integrar Firebase Analytics
- Tracking de errores con Sentry
- Métricas de performance

### 4. **Optimizaciones**
- Service Worker para offline support
- Lazy loading de imágenes
- Minificación y bundle con Vite/Webpack

---

## ☁️ Despliegue (Cloudflare Pages)

El despliegue se gestiona a través de **GitHub Actions** que se integra directamente con Cloudflare Pages.

1.  El workflow (`.github/workflows/deploy-main-to-cloudflare.yml`) se dispara con cada `push` o `merge` a la rama `main`.
2.  El archivo `firebase-config.js` se genera de forma segura en el servidor de build utilizando los **Secrets del Repositorio** de GitHub, evitando que las llaves secretas se expongan en el código fuente.
3.  La acción `cloudflare/pages-action` sube el contenido de la carpeta `src/` al servicio de hosting de Cloudflare Pages.

---

## 🤝 Contribuciones

Si quieres mejorar el proyecto, crea un **Issue** o abre un **Pull Request**.