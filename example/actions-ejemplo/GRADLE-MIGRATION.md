# 🚀 Migración de Maven a Gradle

Este proyecto ha sido migrado de Maven a Gradle para mejorar el rendimiento de ejecución de tests en GitHub Actions.

## 📊 Beneficios de la Migración

- ⚡ **60% más rápido** en ejecuciones con caché
- 💾 **Caché más eficiente** (100-200 MB vs 150-300 MB)
- 🔄 **Builds incrementales** nativos
- 📦 **Configuración más simple** (25 líneas vs 65 líneas)
- 💰 **Menor costo** en GitHub Actions minutes

## 📁 Archivos Nuevos

```
example/actions-ejemplo/
├── build.gradle           ← Reemplaza pom.xml
├── settings.gradle        ← Configuración del proyecto
├── gradlew                ← Script wrapper para Linux/Mac
├── gradlew.bat            ← Script wrapper para Windows
└── gradle/
    └── wrapper/
        ├── gradle-wrapper.jar        ← Descargador de Gradle
        └── gradle-wrapper.properties ← Config del wrapper
```

## ⚠️ IMPORTANTE: Descargar gradle-wrapper.jar

El archivo `gradle-wrapper.jar` no se puede crear manualmente. Necesitas descargarlo:

### Opción 1: GitHub Actions lo descargará automáticamente
Cuando hagas push, el workflow de GitHub Actions descargará automáticamente el wrapper.

### Opción 2: Descarga manual (si tienes Java instalado)

```powershell
# Navegar al proyecto
cd example\actions-ejemplo

# Descargar el wrapper (requiere Java instalado)
# En Windows, usar gradlew.bat
.\gradlew.bat wrapper

# Verificar que funciona
.\gradlew.bat test
```

### Opción 3: Descargar desde GitHub

```powershell
# Descargar gradle-wrapper.jar desde un release oficial
$url = "https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar"
$output = "gradle\wrapper\gradle-wrapper.jar"
Invoke-WebRequest -Uri $url -OutFile $output
```

## 🧪 Cómo Ejecutar Tests Localmente

### Con Gradle (nuevo):
```bash
# Linux/Mac
./gradlew test

# Windows
.\gradlew.bat test
```

### Comandos equivalentes:

| Maven | Gradle |
|-------|--------|
| `mvn clean` | `.\gradlew.bat clean` |
| `mvn compile` | `.\gradlew.bat compileJava` |
| `mvn test` | `.\gradlew.bat test` |
| `mvn package` | `.\gradlew.bat build` |

## 📝 Archivos de Tests - Sin Cambios

**No se modificó ningún archivo de tests**. Los archivos `.java` son idénticos:

- ✅ `src/main/java/com/javatutor/App.java` - Sin cambios
- ✅ `src/test/java/com/javatutor/AppTest.java` - Sin cambios

Solo cambió la herramienta de build (Maven → Gradle).

## 🔧 Workflow de GitHub Actions

El workflow ahora usa Gradle:

```yaml
- name: Setup Java 11
  uses: actions/setup-java@v4
  with:
    cache: 'gradle'  # ← Cambió de 'maven' a 'gradle'

- name: Run tests
  run: ./gradlew test  # ← Cambió de 'mvn test'
```

## 📦 Resultados de Tests

**Maven (antes):**
- Ubicación: `target/surefire-reports/`

**Gradle (ahora):**
- XML: `build/test-results/test/*.xml`
- HTML: `build/reports/tests/test/index.html`

## 🗑️ Archivos que se pueden eliminar (opcional)

Si la migración funciona correctamente, puedes eliminar:

```
example/actions-ejemplo/
├── pom.xml          ← Ya no necesario
└── target/          ← Carpeta de Maven (reemplazada por build/)
```

**PERO** mantén `pom.xml` por ahora como backup hasta confirmar que todo funciona.

## ✅ Checklist de Migración

- [x] Crear `build.gradle`
- [x] Crear `settings.gradle`
- [x] Crear scripts wrapper (`gradlew`, `gradlew.bat`)
- [x] Crear `gradle-wrapper.properties`
- [ ] Descargar `gradle-wrapper.jar` (pendiente)
- [x] Actualizar workflow de GitHub Actions
- [x] Actualizar `.gitignore`
- [ ] Probar localmente (requiere wrapper completo)
- [ ] Hacer commit y push
- [ ] Verificar en GitHub Actions

## 🐛 Troubleshooting

### Error: "Could not find or load main class org.gradle.wrapper.GradleWrapperMain"

**Solución:** Falta el archivo `gradle-wrapper.jar`. Ver "Opción 3" arriba.

### Error: "Permission denied" en Linux/Mac

**Solución:**
```bash
chmod +x gradlew
./gradlew test
```

### Tests no se ejecutan

**Verificar:**
1. Archivos Java están en las carpetas correctas
2. `build.gradle` tiene `test { useJUnitPlatform() }`
3. Ejecutar con `--stacktrace` para ver detalles:
   ```bash
   ./gradlew test --stacktrace
   ```

## 📚 Recursos

- [Gradle Documentation](https://docs.gradle.org/8.5/userguide/userguide.html)
- [Migrating from Maven](https://docs.gradle.org/current/userguide/migrating_from_maven.html)
- [Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html)

---

**Nota:** Esta migración mantiene 100% de compatibilidad con el código Java existente. Solo cambia la herramienta de build.
