# Java Tutor Dash ☕

Este proyecto es el **frontend** de un dashboard web diseñado para estudiantes de un curso de Java. Permite a los usuarios registrarse e iniciar sesión de forma segura, y ver un panel personalizado con sus estadísticas de progreso.

El backend está potenciado por **Firebase** para la autenticación y la base de datos, y el sitio estático se despliega automáticamente en **Cloudflare Pages** usando un flujo de CI/CD con **GitHub Actions**.

---

## ✨ Características Principales

* **Flujo de Autenticación:**
    * Registro de nuevos usuarios (Sign Up) con campos validados como **Correo Electronico** y **GitHub Username**.
    * Inicio de sesión (Sign In).
    * Verificación de cuenta por correo electrónico.
    * Restablecimiento de contraseña.
* **Dashboard Personalizado:**
    * Panel de bienvenida con estadísticas de progreso (pasados, fallados, progreso total).
    * Integración con la API de GitHub para cargar el **avatar** y la **Fecha de último commit**.
    * Por ahora es una simulación de datos para "Último intento" de ejercicio.
* **Gestión de Sesión Robusta:**
    * Persistencia de sesión (Recordarme).
    * Rutina de cierre de sesión automático por inactividad.
* **Seguridad:**
    * Rutas protegidas: El dashboard es inaccesible a menos que el usuario esté autenticado **y** su correo esté verificado.
    * Reglas de seguridad en Firestore para que un usuario solo pueda leer/escribir sus propios datos.
* **Diseño Moderno:**
    * Tema oscuro profesional y limpio.
    * Diseño responsivo que se adapta a móviles.

---

## Demo
https://java-tutor-dash.pages.dev/

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

## 🚀 Cómo Empezar (Desarrollo Local)

Para correr este proyecto en tu máquina local, necesitas configurar las llaves de Firebase y correr un servidor local.

1.  **Clona el repositorio:**
    ```bash
    git clone [https://github.com/tu-usuario/java-tutor-dash.git](https://github.com/tu-usuario/java-tutor-dash.git)
    cd java-tutor-dash
    ```

2.  **Crea el archivo de configuración de Firebase:**
    Crea un archivo nuevo en: `src/js/firebase-config.js` y pega tu objeto de configuración. Este archivo está en el `.gitignore` para proteger tus claves.

    ```javascript
    // src/js/firebase-config.js
    // ¡ESTE ARCHIVO ES IGNORADO POR GIT!

    export const firebaseConfig = {
      apiKey: "TU_API_KEY_SECRETA",
      authDomain: "TU_PROYECTO.firebaseapp.com",
      projectId: "TU_PROYECTO",
      storageBucket: "TU_PROYECTO.appspot.com",
      messagingSenderId: "TUS_NUMEROS",
      appId: "TU_APP_ID"
    };
    ```

3.  **Configura tu Proyecto de Firebase:**
    * En la [Consola de Firebase](https://console.firebase.google.com/), habilita el proveedor **Email/Password** en **Authentication**.
    * Habilita **Cloud Firestore** y configura tus [Reglas de Seguridad](#-reglas-de-seguridad).

4.  **Corre un servidor local:**
    Debido al uso de Módulos ES (`import`), no puedes simplemente abrir `index.html`. Utiliza una extensión como **Live Server** en VS Code o un servidor Python/Node.js.

    ```bash
    # Ejemplo usando Python
    python -m http.server
    # Abre http://localhost:8000 en tu navegador
    ```

---

## 🔒 Reglas de Seguridad

Es vital que tus reglas de **Cloud Firestore** protejan los datos de los usuarios. Asegúrate de que un usuario solo pueda leer o escribir su propio documento:

```json
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Solo permite a un usuario leer o escribir SU PROPIO documento
    match /usuarios/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
  }
}
```

---

## ☁️ Despliegue (Cloudflare Pages)

El despliegue se gestiona a través de **GitHub Actions** que se integra directamente con Cloudflare Pages.

1.  El workflow (`.github/workflows/deploy-main-to-cloudflare.yml`) se dispara con cada `push` o `merge` a la rama `main`.
2.  El archivo `firebase-config.js` se genera de forma segura en el servidor de build utilizando los **Secrets del Repositorio** de GitHub, evitando que las llaves secretas se expongan en el código fuente.
3.  La acción `cloudflare/pages-action` sube el contenido de la carpeta `src/` al servicio de hosting de Cloudflare Pages.

---

## 🤝 Contribuciones

Si quieres mejorar el proyecto, crea un **Issue** o abre un **Pull Request**.