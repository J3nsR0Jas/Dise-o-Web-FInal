import { Router } from 'express';
import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

// Registro de usuario con rol e institución
router.post('/register', async (req, res) => {
  const { nombre, email, password, rol = 'cliente', institucion = 'mercado' } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const userRes = await pool.query(
      'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email',
      [nombre, email, hash]
    );
    const usuario = userRes.rows[0];

    await pool.query(
      'INSERT INTO usuario_rol (usuario_id, rol, institucion) VALUES ($1, $2, $3)',
      [usuario.id, rol, institucion]
    );

    res.status(201).json({ ok: true, usuario: { ...usuario, rol, institucion } });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  }
});

// Login con validación de rol e institución
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.password, ur.rol, ur.institucion
       FROM usuarios u
       JOIN usuario_rol ur ON u.id = ur.usuario_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    const valido = await bcrypt.compare(password, user.password);
    if (!valido) {
      return res.status(401).json({ ok: false, mensaje: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol, institucion: user.institucion },
      process.env.JWT_SECRET || 'clave_secreta_mercado_seguro_2026',
      { expiresIn: '8h' }
    );

    res.json({
      ok: true,
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        institucion: user.institucion,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: error.message });
  }
});

export default router;