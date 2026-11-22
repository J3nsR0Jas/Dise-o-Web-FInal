import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

// Obtener todos los productos activos
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos WHERE activo = TRUE ORDER BY id DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: error.message });
  }
});

// Crear producto con imagen_url (desde Cloudinary / Supabase Object Storage)
router.post('/', async (req, res) => {
  const { nombre, descripcion, precio, stock, categoria, imagen_url } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, descripcion, precio, stock || 0, categoria || 'General', imagen_url]
    );
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  }
});

export default router;