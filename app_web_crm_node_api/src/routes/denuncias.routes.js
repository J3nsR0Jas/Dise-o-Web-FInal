const express = require('express');
const router = express.Router();
const db = require('../config/db');
const pool = db.pool || db;

// Crea la tabla automáticamente en PostgreSQL si aún no existe
(async () => {
  try {
    await pool.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Error creando tabla denuncias:', err.message);
  }
})();

// GET /api/denuncias - Listar todas las denuncias reales
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM denuncias ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/denuncias - Registrar nueva denuncia
router.post('/', async (req, res) => {
  try {
    const {
      codigo,
      id_comerciante,
      nombre_comerciante,
      comerciante,
      puesto,
      tipo_incidente,
      tipo,
      descripcion,
      hay_lesionados,
      estado,
    } = req.body;

    const codFinal = codigo || `DEN-${String(Date.now()).slice(-5)}`;
    const nombreFinal = nombre_comerciante || comerciante || 'Comerciante';
    const tipoFinal = tipo_incidente || tipo || 'Incidente reportado';

    const result = await pool.query(
      `INSERT INTO denuncias 
        (codigo, id_comerciante, nombre_comerciante, puesto, tipo_incidente, descripcion, hay_lesionados, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        codFinal,
        id_comerciante || 1,
        nombreFinal,
        puesto || 'Puesto A-14',
        tipoFinal,
        descripcion || '',
        Boolean(hay_lesionados),
        estado || 'En investigación',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/denuncias/:id/estado - Actualizar estado (En investigación, Aceptado, Rechazado, Derivado)
router.put('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const result = await pool.query(
      'UPDATE denuncias SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Denuncia no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/denuncias/:id - Respaldo de actualización directa
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const result = await pool.query(
      'UPDATE denuncias SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );
    res.json(result.rows[0] || { id, estado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;