const express = require('express');
const router = express.Router();
const db = require('../config/db');
const pool = db.pool || db;

// Crea la tabla automáticamente en PostgreSQL si aún no existe
(async () => {
  try {
    await pool.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Error creando tabla citas:', err.message);
  }
})();

// GET /api/citas - Listar citas médicas
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM citas ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/citas - Registrar cita médica derivada a EsSalud
router.post('/', async (req, res) => {
  try {
    const {
      codigo_cita,
      id_denuncia,
      codigo_denuncia,
      id_comerciante,
      agraviado,
      paciente,
      especialidad,
      fecha_cita,
      fecha,
      estado,
    } = req.body;

    const codCitaFinal = codigo_cita || `CIT-${String(Date.now()).slice(-4)}`;
    const agraviadoFinal = agraviado || paciente || 'Paciente Derivado';
    const fechaFinal = fecha_cita || fecha || 'Por confirmar';

    const result = await pool.query(
      `INSERT INTO citas 
        (codigo_cita, id_denuncia, codigo_denuncia, id_comerciante, agraviado, especialidad, fecha_cita, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        codCitaFinal,
        id_denuncia || null,
        codigo_denuncia || '',
        id_comerciante || 1,
        agraviadoFinal,
        especialidad || 'Medicina General / Emergencias',
        fechaFinal,
        estado || 'Confirmada',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/citas/:id/confirmar - Confirmar cita
router.put('/:id/confirmar', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE citas SET estado = 'Confirmada' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(result.rows[0] || { id, estado: 'Confirmada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;