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

      CREATE TABLE IF NOT EXISTS denuncias (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(30),
        id_comerciante INTEGER,
        nombre_comerciante VARCHAR(150),
        puesto VARCHAR(80),
        tipo_incidente VARCHAR(150),
        descripcion TEXT,
        hay_lesionados BOOLEAN DEFAULT FALSE,
        estado VARCHAR(50) DEFAULT 'En investigación',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS citas (
        id SERIAL PRIMARY KEY,
        codigo_cita VARCHAR(30),
        id_denuncia INTEGER,
        codigo_denuncia VARCHAR(30),
        id_comerciante INTEGER,
        agraviado VARCHAR(150),
        especialidad VARCHAR(150),
        fecha_cita VARCHAR(100),
        estado VARCHAR(50) DEFAULT 'Confirmada',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        descripcion TEXT,
        precio NUMERIC(10,2) NOT NULL,
        stock INTEGER DEFAULT 20,
        imagen_url TEXT
      );

      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(30),
        usuario_email VARCHAR(150),
        items JSONB,
        total NUMERIC(10,2),
        estado VARCHAR(40) DEFAULT 'registrado',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const passHash = await bcrypt.hash('1234', 10);

    // 1. Comerciante por defecto
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

    // Productos base si está vacío
    const prodCheck = await pool.query('SELECT COUNT(*) FROM productos');
    if (Number(prodCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO productos (nombre, descripcion, precio, stock, imagen_url) VALUES
        ('Saco de Papa Yungay (50 kg)', 'Papa seleccionada de primera calidad, cosecha fresca de la sierra central.', 85.00, 24, 'https://placehold.co/400x260/0f766e/ffffff?text=Papa+Yungay+50kg'),
        ('Arroz Extra Costeño (Saco 49 kg)', 'Grano largo añejo seleccionado para abastecimiento comercial.', 148.50, 18, 'https://placehold.co/400x260/0284c7/ffffff?text=Arroz+Extra+49kg'),
        ('Jaba de Tomate Italiano (20 kg)', 'Tomate fresco maduro listo para venta minorista o restaurantes.', 46.00, 15, 'https://placehold.co/400x260/b91c1c/ffffff?text=Tomate+Italiano+20kg'),
        ('Azúcar Rubia Doméstica (50 kg)', 'Saco sellado de azúcar rubia nacional de alta pureza.', 132.00, 20, 'https://placehold.co/400x260/b45309/ffffff?text=Azucar+Rubia+50kg'),
        ('Aceite Vegetal Caja (12 x 1L)', 'Caja mayorista de 12 botellas de 1 litro cada una.', 94.00, 30, 'https://placehold.co/400x260/047857/ffffff?text=Aceite+12x1L'),
        ('Cebolla Roja Arequipeña (Saco 45 kg)', 'Bulbo firme calibrado de primera calidad para mercado.', 68.00, 12, 'https://placehold.co/400x260/6d28d9/ffffff?text=Cebolla+Roja+45kg')
      `);
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

// ================= AUTH (LOGIN Y REGISTER) =================
const registrarHandler = async (req, res) => {
  const { nombre, email, password, dni, puesto, rubro, telefono, foto_puesto } = req.body;
  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Este correo ya está registrado. Inicia sesión.' });
    }

    const passHash = await bcrypt.hash(password, 10);
    const uRes = await pool.query(
      'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email',
      [nombre, email, passHash]
    );
    const nuevoUsuario = uRes.rows[0];

    await pool.query(
      "INSERT INTO usuario_rol VALUES ($1,'mercado','cliente'), ($1,'pnp','cliente'), ($1,'essalud','cliente')",
      [nuevoUsuario.id]
    );

    const cRes = await pool.query(
      `INSERT INTO comerciantes_interesados (id_usuario, nombre, dni, puesto, rubro, telefono, foto_puesto)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nuevoUsuario.id, nombre, dni || '', puesto || 'Puesto A-14', rubro || 'Abarrotes', telefono || '', foto_puesto || null]
    );

    const token = jwt.sign({ id: nuevoUsuario.id, email: nuevoUsuario.email }, JWT_SECRET, { expiresIn: '8h' });
    res.status(201).json({
      ok: true,
      token,
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        roles: [
          { modulo: 'mercado', rol: 'cliente' },
          { modulo: 'pnp', rol: 'cliente' },
          { modulo: 'essalud', rol: 'cliente' },
        ],
        comerciante: cRes.rows[0],
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar usuario en Neon BD' });
  }
};

app.post('/api/auth/register', registrarHandler);
app.post('/api/auth/registro', registrarHandler);

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

// ================= PRODUCTOS Y PEDIDOS =================
app.get('/api/productos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar productos' });
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pedidos ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar pedidos' });
  }
});

app.post('/api/pedidos', async (req, res) => {
  const { codigo, usuario_email, items, total } = req.body;
  try {
    const codFinal = codigo || `PED-${String(Date.now()).slice(-5)}`;
    const result = await pool.query(
      'INSERT INTO pedidos (codigo, usuario_email, items, total, estado) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [codFinal, usuario_email || '', JSON.stringify(items || []), total || 0, 'registrado']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar pedido' });
  }
});

// ================= MERCADO =================
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
      LEFT JOIN denuncias d ON d.id_comerciante = c.id
      GROUP BY c.id, c.nombre, c.puesto, c.foto_puesto
      ORDER BY total_denuncias DESC, c.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al generar reporte de seguridad' });
  }
});

// ================= DENUNCIAS (PNP / MERCADO / ESSALUD) =================
app.get('/api/denuncias', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM denuncias ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar denuncias' });
  }
});

app.post('/api/denuncias', async (req, res) => {
  const {
    codigo,
    id_comerciante,
    nombre_comerciante,
    puesto,
    tipo_incidente,
    descripcion,
    hay_lesionados,
    estado,
  } = req.body;

  try {
    const codFinal = codigo || `DEN-${String(Date.now()).slice(-5)}`;
    const result = await pool.query(
      `INSERT INTO denuncias 
        (codigo, id_comerciante, nombre_comerciante, puesto, tipo_incidente, descripcion, hay_lesionados, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        codFinal,
        id_comerciante || 1,
        nombre_comerciante || 'Comerciante',
        puesto || 'Puesto A-14',
        tipo_incidente || 'Incidente reportado',
        descripcion || '',
        Boolean(hay_lesionados),
        estado || 'En investigación',
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar denuncia' });
  }
});

app.put('/api/denuncias/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const result = await pool.query(
      'UPDATE denuncias SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );
    res.json(result.rows[0] || { id, estado });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado de denuncia' });
  }
});

// ================= CITAS ESSALUD =================
app.get('/api/citas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM citas ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar citas médicas' });
  }
});

app.post('/api/citas', async (req, res) => {
  const {
    codigo_cita,
    id_denuncia,
    codigo_denuncia,
    id_comerciante,
    agraviado,
    especialidad,
    fecha_cita,
    estado,
  } = req.body;

  try {
    const codCita = codigo_cita || `CIT-${String(Date.now()).slice(-4)}`;
    const result = await pool.query(
      `INSERT INTO citas 
        (codigo_cita, id_denuncia, codigo_denuncia, id_comerciante, agraviado, especialidad, fecha_cita, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        codCita,
        id_denuncia || null,
        codigo_denuncia || '',
        id_comerciante || 1,
        agraviado || 'Paciente Derivado',
        especialidad || 'Medicina General / Emergencias',
        fecha_cita || 'Por confirmar',
        estado || 'Confirmada',
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar cita médica' });
  }
});

app.put('/api/citas/:id/confirmar', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE citas SET estado = 'Confirmada' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(result.rows[0] || { id, estado: 'Confirmada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al confirmar cita' });
  }
});

app.listen(PORT, () => {
  console.log(`API Mercado Seguro (Grupo 4) escuchando en puerto ${PORT}`);
});