import { pool } from '../src/config/db.js';

const initDB = async () => {
  try {
    console.log('⏳ Inicializando esquema en Neon...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS usuario_rol (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        rol VARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'empleado', 'cliente')),
        institucion VARCHAR(20) NOT NULL CHECK (institucion IN ('mercado', 'pnp', 'essalud')),
        UNIQUE(usuario_id, rol, institucion)
      );

      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        precio NUMERIC(10, 2) NOT NULL,
        stock INT DEFAULT 0,
        categoria VARCHAR(50),
        imagen_url TEXT,
        activo BOOLEAN DEFAULT TRUE,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tablas creadas correctamente en Neon.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar Neon:', error);
    process.exit(1);
  }
};

initDB();