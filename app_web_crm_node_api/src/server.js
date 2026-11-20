import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mercado_seguro_grupo4_2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const inicializarBD = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS usuario_rol (
        id_usuario INT REFERENCES usuarios(id) ON DELETE CASCADE,
        modulo VARCHAR(30) NOT NULL,
        rol VARCHAR(20) CHECK (rol IN ('cliente','administrador','empleado')),
        PRIMARY KEY (id_usuario, modulo)
      );

      CREATE TABLE IF NOT EXISTS comerciantes_interesados (
        id SERIAL PRIMARY KEY,
        id_usuario INT REFERENCES usuarios(id) ON DELETE SET NULL,
        nombre VARCHAR(150) NOT NULL,
        dni VARCHAR(15),
        puesto VARCHAR(50) NOT NULL,
        rubro VARCHAR(100) DEFAULT 'Abarrotes',
        telefono VARCHAR(30),
        foto_puesto TEXT,
        estado VARCHAR(30) DEFAULT 'activo'
      );

      CREATE TABLE IF NOT EXISTS denuncias_digitales (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(25) UNIQUE,
        id_comerciante INT REFERENCES comerciantes_interesados(id) ON DELETE CASCADE,
        denunciante VARCHAR(150) NOT NULL,
        lugar VARCHAR(150) NOT NULL,
        hecho TEXT NOT NULL,
        hay_lesionados VARCHAR(10) DEFAULT 'No',
        evidencia_imagen TEXT,
        estado VARCHAR(40) DEFAULT 'registrado',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS citas_essalud (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(25) UNIQUE,
        id_denuncia INT REFERENCES denuncias_digitales(id) ON DELETE CASCADE,
        asegurado VARCHAR(150) NOT NULL,
        motivo TEXT NOT NULL,
        especialidad VARCHAR(100) DEFAULT 'Emergencia',
        fecha_cita VARCHAR(60) NOT NULL,
        estado VARCHAR(40) DEFAULT 'registrado',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const passHash = await bcrypt.hash('1234', 10);

    // 1. Comerciante
    const uComCheck = await pool.query("SELECT id FROM usuarios WHERE email = 'cliente1@correo.com'");
    if (uComCheck.rows.length === 0) {
      const uCom = await pool.query(
        "INSERT INTO usuarios (nombre, email, password) VALUES ('Cliente 1 (Comerciante)', 'cliente1@correo.com', $1) RETURNING id",
        [passHash]
      );
      await pool.query(
        "INSERT INTO usuario_rol VALUES ($1,'mercado','cliente'), ($1,'pnp','cliente'), ($1,'essalud','cliente')",
        [uCom.rows[0].id]
      );
      await pool.query(
        "INSERT INTO comerciantes_interesados (id_usuario, nombre, dni, puesto, rubro, telefono) VALUES ($1, 'Cliente 1', '71234567', 'Puesto B-14', 'Abarrotes', '987654321')",
        [uCom.rows[0].id]
      );
    }

    // 2. Empleado SOLO PNP
    const uPnpCheck = await pool.query("SELECT id FROM usuarios WHERE email = 'empleado.pnp@pnp.gob.pe'");
    if (uPnpCheck.rows.length === 0) {
      const uPnp = await pool.query(
        "INSERT INTO usuarios (nombre, email, password) VALUES ('Efectivo PNP Central', 'empleado.pnp@pnp.gob.pe', $1) RETURNING id",
        [passHash]
      );
      await pool.query("INSERT INTO usuario_rol VALUES ($1,'pnp','empleado')", [uPnp.rows[0].id]);
    }

    // 3. Empleado SOLO EsSalud
    const uEssCheck = await pool.query("SELECT id FROM usuarios WHERE email = 'empleado.essalud@essalud.gob.pe'");
    if (uEssCheck.rows.length === 0) {
      const uEss = await pool.query(
        "INSERT INTO usuarios (nombre, email, password) VALUES ('Personal EsSalud Norte Chico', 'empleado.essalud@essalud.gob.pe', $1) RETURNING id",
        [passHash]
      );
      await pool.query("INSERT INTO usuario_rol VALUES ($1,'essalud','empleado')", [uEss.rows[0].id]);
    }

    // 4. Admin SOLO Mercado
    const uAdmCheck = await pool.query("SELECT id FROM usuarios WHERE email = 'admin@mercado.pe'");
    if (uAdmCheck.rows.length === 0) {
      const uAdm = await pool.query(
        "INSERT INTO usuarios (nombre, email, password) VALUES ('Admin Mercado Mayorista', 'admin@mercado.pe', $1) RETURNING id",
        [passHash]
      );
      await pool.query("INSERT INTO usuario_rol VALUES ($1,'mercado','administrador')", [uAdm.rows[0].id]);
    }

    // Denuncia inicial de ejemplo si no hay ninguna
    const denCheck = await pool.query('SELECT COUNT(*) FROM denuncias_digitales');
    if (Number(denCheck.rows[0].count) === 0) {
      const com2 = await pool.query(
        "INSERT INTO comerciantes_interesados (nombre, dni, puesto, rubro, telefono) VALUES ('Cliente 3', '74561238', 'Puesto C-02', 'Carnes y Aves', '912345678') RETURNING id"
      );
      await pool.query(
        "INSERT INTO denuncias_digitales (codigo, id_comerciante, denunciante, lugar, hecho, hay_lesionados, estado) VALUES ('DEN-00022', $1, 'Cliente 3', 'Mercado Mayorista · puesto C-02', 'Asalto con agresión física al cierre', 'Sí', 'en investigación')",
        [com2.rows[0].id]
      );
    }
  } catch (err) {
    console.error('Error inicializando BD:', err.message);
  }
};
inicializarBD();

app.get('/', (req, res) => {
  res.json({
    ok: true,
    sistema: 'API Mercado Seguro - Grupo 4',
    modulos: ['Mercado Mayorista Perú', 'Central de Emergencias PNP', 'EsSalud Norte Chico'],
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const uRes = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (uRes.rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });

    const usuario = uRes.rows[0];
    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const rolesRes = await pool.query('SELECT modulo, rol FROM usuario_rol WHERE id_usuario = $1', [usuario.id]);
    const comRes = await pool.query('SELECT * FROM comerciantes_interesados WHERE id_usuario = $1 LIMIT 1', [usuario.id]);

    const token = jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: '8h' });
    res.json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        roles: rolesRes.rows,
        comerciante: comRes.rows[0] || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en servidor al iniciar sesión' });
  }
});

app.get('/api/mercado/mi-puesto/:id_comerciante', async (req, res) => {
  const { id_comerciante } = req.params;
  try {
    const puesto = await pool.query('SELECT * FROM comerciantes_interesados WHERE id = $1', [id_comerciante]);
    const denuncias = await pool.query(
      `SELECT d.*, c.codigo AS cita_codigo, c.estado AS cita_estado, c.fecha_cita
       FROM denuncias_digitales d
       LEFT JOIN citas_essalud c ON c.id_denuncia = d.id
       WHERE d.id_comerciante = $1
       ORDER BY d.id DESC`,
      [id_comerciante]
    );
    res.json({ puesto: puesto.rows[0], denuncias: denuncias.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar Mi Puesto' });
  }
});

app.put('/api/mercado/mi-puesto/:id_comerciante/foto', async (req, res) => {
  const { id_comerciante } = req.params;
  const { foto_puesto } = req.body;
  try {
    const result = await pool.query(
      'UPDATE comerciantes_interesados SET foto_puesto = $1 WHERE id = $2 RETURNING *',
      [foto_puesto, id_comerciante]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar foto del puesto en Neon' });
  }
});

app.get('/api/mercado/comerciantes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM comerciantes_interesados ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar comerciantes' });
  }
});

app.post('/api/mercado/comerciantes', async (req, res) => {
  const { nombre, dni, puesto, rubro, telefono, foto_puesto } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO comerciantes_interesados (nombre, dni, puesto, rubro, telefono, foto_puesto) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [nombre, dni, puesto, rubro || 'Abarrotes', telefono, foto_puesto || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar comerciante' });
  }
});

app.get('/api/mercado/seguridad', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.nombre, c.puesto, c.foto_puesto, COUNT(d.id)::int AS total_denuncias
      FROM comerciantes_interesados c
      LEFT JOIN denuncias_digitales d ON d.id_comerciante = c.id
      GROUP BY c.id, c.nombre, c.puesto, c.foto_puesto
      ORDER BY total_denuncias DESC, c.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al generar reporte de seguridad' });
  }
});

app.get('/api/pnp/denuncias', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, c.codigo AS cita_codigo, c.estado AS cita_estado, c.fecha_cita
      FROM denuncias_digitales d
      LEFT JOIN citas_essalud c ON c.id_denuncia = d.id
      ORDER BY d.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar denuncias PNP' });
  }
});

app.post('/api/pnp/denuncias', async (req, res) => {
  const { id_comerciante, denunciante, lugar, hecho, hay_lesionados, evidencia_imagen } = req.body;
  try {
    const codigo = 'DEN-' + String(Math.floor(10000 + Math.random() * 90000));
    const result = await pool.query(
      `INSERT INTO denuncias_digitales (codigo, id_comerciante, denunciante, lugar, hecho, hay_lesionados, evidencia_imagen, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'registrado') RETURNING *`,
      [codigo, id_comerciante || 1, denunciante, lugar, hecho, hay_lesionados || 'No', evidencia_imagen || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar denuncia digital' });
  }
});

app.put('/api/pnp/denuncias/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const result = await pool.query(
      'UPDATE denuncias_digitales SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado de denuncia' });
  }
});

app.get('/api/essalud/citas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, d.codigo AS denuncia_codigo
      FROM citas_essalud c
      LEFT JOIN denuncias_digitales d ON d.id = c.id_denuncia
      ORDER BY c.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar citas EsSalud' });
  }
});

app.post('/api/essalud/citas', async (req, res) => {
  const { id_denuncia, asegurado, motivo, especialidad, fecha_cita } = req.body;
  try {
    const codigo = 'CES-' + String(Math.floor(10000 + Math.random() * 90000));
    const result = await pool.query(
      `INSERT INTO citas_essalud (codigo, id_denuncia, asegurado, motivo, especialidad, fecha_cita, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'registrado') RETURNING *`,
      [codigo, id_denuncia, asegurado, motivo, especialidad || 'Emergencia', fecha_cita]
    );
    if (id_denuncia) {
      await pool.query("UPDATE denuncias_digitales SET estado = 'derivado' WHERE id = $1", [id_denuncia]);
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al agendar cita en EsSalud' });
  }
});

app.put('/api/essalud/citas/:id/confirmar', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE citas_essalud SET estado = 'confirmada' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al confirmar cita' });
  }
});

app.listen(PORT, () => {
  console.log(`API Mercado Seguro (Grupo 4) escuchando en puerto ${PORT}`);
});