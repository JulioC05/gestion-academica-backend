🏫 Sistema de Gestión Académica - API Backend (Colegios Perú)
=============================================================

Este repositorio contiene el núcleo transaccional y el motor API del sistema de gestión escolar, desarrollado en **Node.js (Express)** y **SQL Server**. La arquitectura está totalmente contenerizada con **Docker** y optimizada para el auto-escalado horizontal e inyección de carga elástica en **Azure Container Apps (Serverless)**.

🚀 1. Guía de Instalación Local (Para el Frontend)
--------------------------------------------------

Para levantar el entorno de desarrollo en tu máquina local y empezar a consumir los endpoints desde React, sigue estos sencillos pasos:

### Prerrequisitos

-   Tener instalado **Docker Desktop** activo en tu sistema.

-   Disponer de un cliente de base de datos o apuntar a la base de datos de desarrollo.

### Pasos para la Configuración

1.  **Clonar el repositorio:**

    ```
    git clone https://github.com/JulioC05/gestion-academica-backend.git
    cd gestion-academica-backend

    ```

2.  **Configurar Variables de Entorno:** Crea un archivo llamado `.env` en la raíz del proyecto basándote en el archivo de ejemplo proporcionado (`.env.example`).

    ```
    cp .env.example .env

    ```

    *Nota: Edita el archivo `.env` recién creado con las credenciales de base de datos de tu entorno.*

3.  **Construir la Imagen de Docker:**

    ```
    docker build -t gestion-academica-backend .

    ```

4.  **Desplegar el Contenedor:**

    ```
    docker run -d -p 5000:5000 --name api-escolar-backend gestion-academica-backend

    ```

5.  **Verificar Funcionamiento:** La API estará disponible e interceptando peticiones en: `http://localhost:5000`

⚙️ 2. Estructura del Archivo `.env.example`
-------------------------------------------

Debes asegurar la existencia de las siguientes variables para que el contenedor inicialice la conexión transaccional de forma correcta hacia SQL Server:

```
PORT=5000
JWT_SECRET=TuClaveSecretaSuperSeguraParaTesis2026
DB_USER=sa
DB_PASSWORD=TuPasswordSeguroSQL
DB_SERVER=localhost
DB_DATABASE=gestion_academica_db
DB_PORT=1433

# Configuración opcional para telemetría en la nube
AZURE_APP_INSIGHTS_CONNECTION_STRING=InstrumentationKey=xxxx-xxxx-xxxx

```

🗺️ 3. Catálogo Completo de Endpoints y Contratos JSON
------------------------------------------------------

> ⚠️ **Regla General de Seguridad:** Todos los endpoints (excepto Login) requieren la cabecera `Authorization: Bearer <TOKEN_JWT>`.

### 🔐 Módulo de Autenticación y Usuarios

Maneja el control de accesos e identifica de forma automatizada los roles del sistema para redirigir en el frontend de React.

#### - Iniciar Sesión (Generar Token)

-   **Método:** `POST`

-   **Ruta:** `/api/auth/login`

-   **Request Body:**

    ```
    {
      "correo": "test@universidad.edu.pe",
      "contrasena": "clave123"
    }

    ```

-   **Response Success (200):**

    ```
    {
      "message": "Login exitoso",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "usuario": {
        "id": 2,
        "correo": "test@universidad.edu.pe",
        "rol": "ALUMNO"
      }
    }

    ```

#### - Consultar Perfil Actual

-   **Método:** `GET`

-   **Ruta:** `/api/auth/perfil`

-   **Response Alumno (200):**

    ```
    {
      "rol": "ALUMNO",
      "datos": {
        "alumno_id": 1,
        "codigo_alumno": "AL2026001",
        "nombres": "Juanito",
        "apellidos": "Pérez",
        "fecha_nacimiento": "2012-05-14"
      }
    }

    ```

-   **Response Administrador (200):**

    ```
    {
      "rol": "ADMINISTRADOR",
      "datos": {
        "admin_id": 1,
        "nombres": "Personal",
        "apellidos": "Administrativo",
        "correo": "admin@colegio.edu.pe"
      }
    }

    ```

#### - Registrar Usuario Nuevo (Exclusivo Admin)

-   **Método:** `POST`

-   **Ruta:** `/api/usuarios/admin/crear`

-   **Request Body (Caso Alumno):**

    ```
    {
      "correo": "alumno.nuevo@colegio.edu.pe",
      "contrasena": "alumno123",
      "rol_id": 3,
      "tipo_persona": "ALUMNO",
      "datos_perfil": {
        "codigo_alumno": "ALU-2026-99",
        "nombres": "Mateo",
        "apellidos": "Rosales Prado",
        "fecha_nacimiento": "2014-08-22"
      }
    }

    ```

-   **Request Body (Caso Profesor):**

    ```
    {
      "correo": "carlos.docente@colegio.edu.pe",
      "contrasena": "profesor123",
      "rol_id": 2,
      "tipo_persona": "PROFESOR",
      "datos_perfil": {
        "codigo_empleado": "EMP-2026-88",
        "nombres": "Carlos Alberto",
        "apellidos": "Vivanco Soto",
        "telefono": "987654321"
      }
    }

    ```

-   **Response Success (201):**

    ```
    {
      "message": "Usuario y perfil de ALUMNO creados exitosamente en el sistema.",
      "usuario_id": 45,
      "correo": "alumno.nuevo@colegio.edu.pe"
    }

    ```

### 📝 Módulo de Matrícula Escolar

Cumple con las reglas del negocio del backend (Validación de vacantes concurrentes, cruce de horarios, tope máximo de 20 cursos por periodo académico y prevención de doble inscripción en el mismo curso).

#### - Registrar Matrícula

-   **Método:** `POST`

-   **Ruta:** `/api/matricula/registrar`

-   **Request Body (Si eres Alumno - Autodetecta tu ID por Token):**

    ```
    {
      "periodo_id": 2,
      "seccion_id": 12
    }

    ```

-   **Request Body (Si eres Administrador - Obligatorio pasar el ID):**

    ```
    {
      "alumno_id": 4,
      "periodo_id": 2,
      "seccion_id": 12
    }

    ```

-   **Response Success (201):**

    ```
    {
      "message": "Matrícula procesada y registrada de forma exitosa bajo el estándar escolar.",
      "matricula_id": 8,
      "seccion_registrada": 12,
      "total_cursos_actuales": 3
    }

    ```

#### - Consultar Cursos Matriculados (Vista Alumno)

-   **Método:** `GET`

-   **Ruta:** `/api/matricula/mis-cursos`

-   **Response (200):**

    ```
    {
      "total_cursos": 1,
      "cursos_matriculados": [
        {
          "matricula_id": 8,
          "fecha_matricula": "2026-06-22T19:30:00.000Z",
          "grado_seccion": "1ERO SEC - A",
          "horario": "Lunes a Viernes 08:00 - 13:00",
          "curso": "Educación Física",
          "profesor": "Carlos Alberto Vivanco"
        }
      ]
    }

    ```

#### - Consultar Cursos de un Alumno (Vista Admin)

-   **Método:** `GET`

-   **Ruta:** `/api/matricula/mis-cursos?alumno_id=4`

-   **Response Success (200):**

    ```
    {
      "alumno_id_consultado": 4,
      "total_cursos": 2,
      "cursos_matriculados": [
        {
          "matricula_id": 10,
          "fecha_matricula": "2026-06-22T15:20:10.000Z",
          "grado_seccion": "1ERO SEC - A",
          "horario": "Lunes a Viernes 08:00 - 13:00",
          "curso": "Educación Física",
          "profesor": "Carlos Alberto Vivanco"
        }
      ]
    }

    ```

#### - Retirar Curso / Desmatrícula (Devuelve vacante +1 automáticamente)

-   **Método:** `POST`

-   **Ruta:** `/api/matricula/retirar`

-   **Request Body (Alumno - Autodetecta su ID):**

    ```
    {
      "periodo_id": 2,
      "seccion_id": 12
    }

    ```

-   **Request Body (Administrador - Especificando Alumno):**

    ```
    {
      "alumno_id": 4,
      "periodo_id": 2,
      "seccion_id": 12
    }

    ```

-   **Response Success (200):**

    ```
    {
      "message": "Retiro de asignatura procesado con éxito. La vacante ha sido liberada."
    }

    ```

### 📊 Módulo de Evaluaciones y Registro de Notas

Diseñado estratégicamente para pruebas de estrés de CPU mediante el cálculo de promedios ponderados en tiempo real al vuelo ("On-the-fly").

#### - Consultar Libreta de Notas / Boleta (Cálculo al vuelo)

-   **Método:** `GET`

-   **Ruta:** `/api/academico/libreta`

-   **Parámetro Opcional para Admin:** `/api/academico/libreta?alumno_id=4`

-   **Response Success (200):**

    ```
    {
      "alumno_id": 4,
      "periodo_evaluado": "Año Escolar 2026",
      "libreta": [
        {
          "curso": "Educación Física",
          "seccion": "1ERO SEC - A",
          "evaluaciones": [
            { "evaluacion": "Examen Bimestral I", "peso_porcentaje": 40, "nota": 16 },
            { "evaluacion": "Práctica de Atletismo", "peso_porcentaje": 60, "nota": null }
          ],
          "promedio_parcial": 16
        }
      ]
    }

    ```

#### - Consultar Secciones del Profesor

-   **Método:** `GET`

-   **Ruta:** `/api/evaluaciones/profesor/mis-secciones`

-   **Response Success (200):**

    ```
    {
      "secciones": [
        {
          "seccion_id": 10,
          "grado_seccion": "1ERO SEC - A",
          "horario": "Lunes a Viernes 08:00 - 13:00",
          "curso": "Matemática"
        }
      ]
    }

    ```

#### - Consultar Alumnos Inscritos en la Sección (Modo Profesor)

-   **Método:** `GET`

-   **Ruta:** `/api/evaluaciones/profesor/secciones/10/alumnos`

-   **Response Success (200):**

    ```
    {
      "alumnos": [
        {
          "alumno_id": 1,
          "codigo_alumno": "AL2026001",
          "nombres": "Juan",
          "apellidos": "Pérez Mendoza"
        }
      ]
    }

    ```

#### - Consultar Planilla Consolidada de Notas (Modo Admin / Auditoría)

-   **Método:** `GET`

-   **Ruta:** `/api/evaluaciones/profesor/secciones/10/alumnos`

-   **Response Success (200):**

    ```
    {
      "seccion_id": 10,
      "total_estudiantes": 2,
      "planilla": [
        {
          "alumno_id": 1,
          "codigo": "ALU-2026-01",
          "estudiante": "Pérez Mendoza, Juan",
          "calificaciones": [
            { "evaluacion": "Examen Bimestral I", "peso_porcentaje": 40, "nota": 14 },
            { "evaluacion": "Prácticas Calificadas", "peso_porcentaje": 35, "nota": 11 }
          ]
        },
        {
          "alumno_id": 2,
          "codigo": "ALU-2026-02",
          "estudiante": "Gómez Rosas, María",
          "calificaciones": [
            { "evaluacion": "Examen Bimestral I", "peso_porcentaje": 40, "nota": 18 },
            { "evaluacion": "Prácticas Calificadas", "peso_porcentaje": 35, "nota": null }
          ]
        }
      ]
    }

    ```

#### - Crear Evaluación / Casilla del Sílabo

-   **Método:** `POST`

-   **Ruta:** `/api/evaluaciones/registrar`

-   **Request Body:**

    ```
    {
      "seccion_id": 10,
      "tipo_evaluacion_id": 1,
      "nombre": "Examen Bimestral I",
      "peso_porcentaje": 40
    }

    ```

-   **Response Success (201):**

    ```
    {
      "message": "Evaluación configurada con éxito en el silabo del salón.",
      "evaluacion_id": 1
    }

    ```

#### - Registrar Nota Individual / Modificación (MERGE / Upsert)

-   **Método:** `POST`

-   **Ruta:** `/api/evaluaciones/calificaciones/registrar`

-   **Request Body:**

    ```
    {
      "evaluacion_id": 1,
      "alumno_id": 1,
      "nota": 16.5
    }

    ```

-   **Response Success (200):**

    ```
    {
      "message": "Calificación registrada/actualizada de manera correcta."
    }

    ```

#### - Registrar Notas de Forma Masiva (Planilla de Notas)

-   **Método:** `POST`

-   **Ruta:** `/api/academico/calificar`

-   **Request Body:**

    ```
    {
      "evaluacion_id": 1,
      "notas_alumnos": [
        { "alumno_id": 1, "nota": 15.5 },
        { "alumno_id": 2, "nota": 18.0 },
        { "alumno_id": 3, "nota": 11.0 },
        { "alumno_id": 4, "nota": 14.5 }
      ]
    }

    ```

-   **Response Success (201):**

    ```
    {
      "message": "Se registraron/actualizaron exitosamente 4 calificaciones para la evaluación."
    }

    ```

### 🛠️ Mantenimientos Críticos (Estructura de Datos Básicos)

Endpoints utilizados por el administrador para alimentar el catálogo escolar de forma dinámica.

| Módulo | Método | Ruta | Uso |
| :--- | :--- | :--- | :--- |
| **Periodos** | `GET` | `/api/periodos` | Listar periodos lectivos activos |
| **Periodos** | `POST` | `/api/periodos` | Crear un nuevo año o bimestre escolar |
| **Periodos** | `PUT` | `/api/periodos/:id` | Editar rango de fechas o nombre de un periodo |
| **Periodos** | `DELETE` | `/api/periodos/:id` | Eliminar periodo si no tiene restricciones en uso |
| **Cursos** | `GET` | `/api/cursos` | Listar cursos globales del catálogo escolar |
| **Cursos** | `POST` | `/api/cursos` | Crear asignaturas nuevas en el catálogo |
| **Cursos** | `PUT` | `/api/cursos/:id` | Modificar datos o código del curso |
| **Cursos** | `DELETE` | `/api/cursos/:id` | Eliminar curso si no tiene secciones asignadas |
| **Secciones** | `GET` | `/api/secciones` | Ver aulas aperturadas con su respectivo horario |
| **Secciones** | `POST` | `/api/secciones` | Crear sección asignando curso, profesor, horario y cupo |
| **Secciones** | `PUT` | `/api/secciones/:id` | Modificar datos o reajustar vacantes de la sección |
| **Secciones** | `DELETE` | `/api/secciones/:id` | Eliminar sección si no cuenta con alumnos matriculados |


```
