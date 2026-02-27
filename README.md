# 🏥 Sistema SaludPlus - API de Gestión Médica

Este proyecto es una API híbrida diseñada para gestionar la migración de datos hospitalarios desde archivos Excel/CSV hacia un entorno de persistencia dual (SQL y NoSQL).

## Decisiones Técnicas
- **MySQL:** Se utilizó para los datos transaccionales (Citas, Médicos, Pacientes) aplicando **3ra Forma Normal** para garantizar la integridad y evitar duplicidad.
- **MongoDB:** Se implementó para el historial clínico de los pacientes. El objetivo es optimizar las lecturas (Read-intensive) evitando JOINs complejos en SQL.
- **Idempotencia:** El script de migración verifica la existencia previa de registros (por email o ID) antes de insertar, permitiendo ejecutar la carga múltiples veces sin duplicar datos.

## Arquitectura
- `config/`: Centralización de conexiones.
- `uploads/`: Almacenamiento temporal de archivos CSV.
- `app.js`: Lógica de negocio y endpoints.

## 🚀 Requisitos para ejecutar el proyecto

1. **Base de Datos MySQL:** Asegurarse de tener ejecutado el script de creación de tablas (Insurances, Doctors, Patients, Appointments).
2. **Base de Datos MongoDB:** Contar con una instancia local o un cluster en Mongo Atlas.
3. **Variables de Entorno:** Configurar el archivo `.env` con las credenciales correspondientes (Host, User, Password, Mongo_URI).

## 🛠️ Instalación y Configuración

Sigue estos pasos para poner en marcha el servidor:

1. **Instalar dependencias:**
   ```bash
   npm install
   mkdir uploads
   node app.js

   npm run dev o nodemon app.js