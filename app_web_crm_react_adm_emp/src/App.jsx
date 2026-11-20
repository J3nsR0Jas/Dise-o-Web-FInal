import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://mercado-seguro-api-26c0.onrender.com';

const BADGE_STYLE = {
  registrado: { bg: '#e2e8f0', color: '#334155' },
  'en investigación': { bg: '#fef3c7', color: '#92400e' },
  derivado: { bg: '#fef3c7', color: '#92400e' },
  atendido: { bg: '#dcfce7', color: '#166534' },
  confirmada: { bg: '#dcfce7', color: '#166534' },
};

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [cred, setCred] = useState({ email: 'empleado.pnp@pnp.gob.pe', password: '1234' });
  const [errorLogin, setErrorLogin] = useState('');
  const [moduloActivo, setModuloActivo] = useState('');
  const [toast, setToast] = useState('');

  const [denuncias, setDenuncias] = useState([]);
  const [citas, setCitas] = useState([]);
  const [rankingSeguridad, setRankingSeguridad] = useState([]);

  const [derivandoDenuncia, setDerivandoDenuncia] = useState(null);
  const [formCita, setFormCita] = useState({
    asegurado: '',
    motivo: '',
    especialidad: 'Emergencia',
    fecha_cita: '21/11/2026 · 09:30',
  });

  const [nuevoCom, setNuevoCom] = useState({
    nombre: '',
    dni: '',
    puesto: '',
    rubro: 'Abarrotes',
    telefono: '',
    foto_puesto: '',
  });

  const mostrarToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loginConCorreo = async (emailLogin, passLogin) => {
    setErrorLogin('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLogin, password: passLogin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorLogin(data.error || 'Credenciales inválidas');
        return;
      }

      const roles = data.usuario.roles || [];
      const tienePnp = roles.some((r) => r.modulo === 'pnp' && r.rol === 'empleado');
      const tieneEssalud = roles.some((r) => r.modulo === 'essalud' && r.rol === 'empleado');
      const tieneAdminMercado = roles.some((r) => r.modulo === 'mercado' && r.rol === 'administrador');

      if (!tienePnp && !tieneEssalud && !tieneAdminMercado) {
        setErrorLogin('Esta cuenta no tiene permisos administrativos ni de empleado.');
        return;
      }

      setUsuario(data.usuario);
      if (tienePnp) setModuloActivo('pnp');
      else if (tieneEssalud) setModuloActivo('essalud');
      else if (tieneAdminMercado) setModuloActivo('mercado-seguridad');
    } catch {
      setErrorLogin('Error de conexión con Render. Intenta de nuevo en unos segundos.');
    }
  };

  const manejarSubmitLogin = (e) => {
    e.preventDefault();
    loginConCorreo(cred.email, cred.password);
  };

  const cargarTodo = async () => {
    try {
      const [rDen, rCit, rSeg] = await Promise.all([
        fetch(`${API_URL}/api/pnp/denuncias`),
        fetch(`${API_URL}/api/essalud/citas`),
        fetch(`${API_URL}/api/mercado/seguridad`),
      ]);
      if (rDen.ok) setDenuncias(await rDen.json());
      if (rCit.ok) setCitas(await rCit.json());
      if (rSeg.ok) setRankingSeguridad(await rSeg.json());
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    if (usuario) cargarTodo();
  }, [usuario]);

  const cambiarEstadoDenuncia = async (id, nuevoEstado) => {
    const res = await fetch(`${API_URL}/api/pnp/denuncias/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    if (res.ok) {
      mostrarToast(`Estado actualizado a "${nuevoEstado}"`);
      cargarTodo();
    }
  };

  const iniciarDerivacion = (den) => {
    setDerivandoDenuncia(den);
    setFormCita({
      asegurado: den.denunciante,
      motivo: `Lesiones · denuncia ${den.codigo} (${den.hecho})`,
      especialidad: 'Emergencia',
      fecha_cita: '21/11/2026 · 09:30',
    });
  };

  const agendarCitaEssalud = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/essalud/citas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_denuncia: derivandoDenuncia.id,
        ...formCita,
      }),
    });
    const citaCreada = await res.json();
    if (res.ok) {
      mostrarToast(`Cita agendada y enviada a EsSalud · ${citaCreada.codigo}`);
      setDerivandoDenuncia(null);
      await cargarTodo();
    }
  };

  const confirmarCita = async (id) => {
    const res = await fetch(`${API_URL}/api/essalud/citas/${id}/confirmar`, { method: 'PUT' });
    if (res.ok) {
      mostrarToast('Cita confirmada en EsSalud');
      cargarTodo();
    }
  };

  const subirFotoNuevoComerciante = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setNuevoCom((prev) => ({ ...prev, foto_puesto: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const registrarComerciante = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/mercado/comerciantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoCom),
    });
    if (res.ok) {
      mostrarToast('Comerciante y foto guardados en Neon BD');
      setNuevoCom({ nombre: '', dni: '', puesto: '', rubro: 'Abarrotes', telefono: '', foto_puesto: '' });
      cargarTodo();
    }
  };

  if (!usuario) {
    return (
      <div style={st.loginWrap}>
        <div style={st.loginCard}>
          <span style={st.kicker}>GRUPO 4 · MERCADO SEGURO</span>
          <h1 style={st.loginTitle}>Panel Institucional</h1>
          <p style={st.loginSub}>Ingresa con tu cuenta de PNP, EsSalud o Administración</p>

          <form onSubmit={manejarSubmitLogin} style={st.form}>
            <label style={st.label}>Correo institucional</label>
            <input
              type="email"
              value={cred.email}
              onChange={(e) => setCred({ ...cred, email: e.target.value })}
              style={st.input}
              required
            />
            <label style={st.label}>Contraseña</label>
            <input
              type="password"
              value={cred.password}
              onChange={(e) => setCred({ ...cred, password: e.target.value })}
              style={st.input}
              required
            />
            {errorLogin && <p style={st.err}>{errorLogin}</p>}
            <button type="submit" style={st.btnPrimary}>Ingresar al Sistema</button>
          </form>

          <div style={st.quickBox}>
            <div style={st.quickTitle}>Accesos por entidad (clave: 1234):</div>
            <button
              type="button"
              onClick={() => loginConCorreo('empleado.pnp@pnp.gob.pe', '1234')}
              style={st.quickBtn}
            >
              🚓 Entrar solo como PNP
            </button>
            <button
              type="button"
              onClick={() => loginConCorreo('empleado.essalud@essalud.gob.pe', '1234')}
              style={st.quickBtn}
            >
              🏥 Entrar solo como EsSalud
            </button>
            <button
              type="button"
              onClick={() => loginConCorreo('admin@mercado.pe', '1234')}
              style={st.quickBtn}
            >
              🏢 Entrar solo como Admin Mercado
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rolesUsuario = usuario.roles || [];
  const puedeVerPnp = rolesUsuario.some((r) => r.modulo === 'pnp' && r.rol === 'empleado');
  const puedeVerEssalud = rolesUsuario.some((r) => r.modulo === 'essalud' && r.rol === 'empleado');
  const puedeVerMercado = rolesUsuario.some((r) => r.modulo === 'mercado' && r.rol === 'administrador');

  const maxDenuncias = Math.max(1, ...rankingSeguridad.map((r) => Number(r.total_denuncias || 0)));

  return (
    <div style={st.shell}>
      <header style={st.navbar}>
        <div>
          <strong>Grupo 4 · Mercado Seguro</strong>
          <span style={st.navTag}>Vista Exclusiva por Rol</span>
        </div>
        <div style={st.navRight}>
          <span style={st.userBadge}>{usuario.nombre}</span>
          <button onClick={() => setUsuario(null)} style={st.btnExit}>Salir</button>
        </div>
      </header>

      <div style={st.body}>
        <aside style={st.sidebar}>
          <div style={st.menuTitle}>MI MÓDULO ASIGNADO</div>
          {puedeVerPnp && (
            <button
              onClick={() => setModuloActivo('pnp')}
              style={moduloActivo === 'pnp' ? st.menuActive : st.menuItem}
            >
              🚓 Central de Emergencias PNP
              <small style={st.menuSub}>Panel de denuncias (empleado)</small>
            </button>
          )}
          {puedeVerEssalud && (
            <button
              onClick={() => setModuloActivo('essalud')}
              style={moduloActivo === 'essalud' ? st.menuActive : st.menuItem}
            >
              🏥 EsSalud Norte Chico
              <small style={st.menuSub}>Gestión de citas (empleado)</small>
            </button>
          )}
          {puedeVerMercado && (
            <button
              onClick={() => setModuloActivo('mercado-seguridad')}
              style={moduloActivo === 'mercado-seguridad' ? st.menuActive : st.menuItem}
            >
              📊 Mercado Mayorista
              <small style={st.menuSub}>Reporte seguridad (admin)</small>
            </button>
          )}
        </aside>

        <main style={st.main}>
          {moduloActivo === 'pnp' && puedeVerPnp && (
            <div>
              <div style={st.rowBetween}>
                <div>
                  <div style={st.crumb}>PNP › Panel de denuncias</div>
                  <h2 style={st.h2}>Denuncias Digitales Recibidas</h2>
                </div>
                <button onClick={cargarTodo} style={st.btnOutline}>↻ Actualizar</button>
              </div>

              {derivandoDenuncia && (
                <div style={st.deriveBox}>
                  <h3 style={st.h3}>
                    🏥 Derivar Denuncia {derivandoDenuncia.codigo} a EsSalud
                  </h3>
                  <form onSubmit={agendarCitaEssalud} style={st.form}>
                    <div style={st.grid2}>
                      <div>
                        <label style={st.label}>Asegurado (precargado)</label>
                        <input
                          type="text"
                          value={formCita.asegurado}
                          onChange={(e) => setFormCita({ ...formCita, asegurado: e.target.value })}
                          style={st.inputPre}
                          required
                        />
                      </div>
                      <div>
                        <label style={st.label}>Motivo (precargado)</label>
                        <input
                          type="text"
                          value={formCita.motivo}
                          onChange={(e) => setFormCita({ ...formCita, motivo: e.target.value })}
                          style={st.inputPre}
                          required
                        />
                      </div>
                      <div>
                        <label style={st.label}>Especialidad</label>
                        <input
                          type="text"
                          value={formCita.especialidad}
                          onChange={(e) => setFormCita({ ...formCita, especialidad: e.target.value })}
                          style={st.input}
                          required
                        />
                      </div>
                      <div>
                        <label style={st.label}>Fecha y hora</label>
                        <input
                          type="text"
                          value={formCita.fecha_cita}
                          onChange={(e) => setFormCita({ ...formCita, fecha_cita: e.target.value })}
                          style={st.input}
                          required
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                      <button type="submit" style={st.btnPrimary}>Agendar cita en EsSalud</button>
                      <button type="button" onClick={() => setDerivandoDenuncia(null)} style={st.btnOutline}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <table style={st.table}>
                <thead>
                  <tr>
                    <th style={st.th}>Código</th>
                    <th style={st.th}>Agraviado / Lugar</th>
                    <th style={st.th}>Hecho y Evidencia (Neon BD)</th>
                    <th style={st.th}>Lesionados</th>
                    <th style={st.th}>Estado</th>
                    <th style={st.th}>Acción PNP</th>
                  </tr>
                </thead>
                <tbody>
                  {denuncias.map((d) => {
                    const est = BADGE_STYLE[d.estado] || BADGE_STYLE.registrado;
                    return (
                      <tr key={d.id} style={d.hay_lesionados === 'Sí' ? st.rowWarn : st.tr}>
                        <td style={st.td}><strong>{d.codigo}</strong></td>
                        <td style={st.td}>{d.denunciante}<br /><small>{d.lugar}</small></td>
                        <td style={st.td}>
                          {d.hecho}
                          {d.evidencia_imagen && (
                            <div style={{ marginTop: '6px' }}>
                              <img
                                src={d.evidencia_imagen}
                                alt="Evidencia PNP"
                                style={{ width: '85px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                            </div>
                          )}
                        </td>
                        <td style={st.td}>
                          <strong style={{ color: d.hay_lesionados === 'Sí' ? '#dc2626' : '#334155' }}>
                            {d.hay_lesionados}
                          </strong>
                        </td>
                        <td style={st.td}>
                          <span style={{ ...st.badge, backgroundColor: est.bg, color: est.color }}>{d.estado}</span>
                          {d.cita_codigo && (
                            <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                              Cita {d.cita_codigo}: <strong>{d.cita_estado}</strong>
                            </div>
                          )}
                        </td>
                        <td style={st.td}>
                          {d.hay_lesionados === 'Sí' && !d.cita_codigo ? (
                            <button onClick={() => iniciarDerivacion(d)} style={st.btnDangerSm}>
                              Derivar a EsSalud
                            </button>
                          ) : d.estado === 'registrado' ? (
                            <button
                              onClick={() => cambiarEstadoDenuncia(d.id, 'en investigación')}
                              style={st.btnPrimarySm}
                            >
                              Investigar
                            </button>
                          ) : (
                            <button
                              onClick={() => cambiarEstadoDenuncia(d.id, 'atendido')}
                              style={st.btnOutline}
                            >
                              Marcar atendido
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {moduloActivo === 'essalud' && puedeVerEssalud && (
            <div>
              <div style={st.rowBetween}>
                <div>
                  <div style={st.crumb}>EsSalud Norte Chico › Panel de Citas</div>
                  <h2 style={st.h2}>Citas Médicas Derivadas por PNP</h2>
                </div>
                <button onClick={cargarTodo} style={st.btnOutline}>↻ Actualizar</button>
              </div>

              <table style={st.table}>
                <thead>
                  <tr>
                    <th style={st.th}>Código Cita</th>
                    <th style={st.th}>Denuncia Origen</th>
                    <th style={st.th}>Asegurado</th>
                    <th style={st.th}>Especialidad / Fecha</th>
                    <th style={st.th}>Estado</th>
                    <th style={st.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {citas.map((c) => {
                    const est = BADGE_STYLE[c.estado] || BADGE_STYLE.registrado;
                    return (
                      <tr key={c.id} style={st.tr}>
                        <td style={st.td}><strong>{c.codigo}</strong></td>
                        <td style={st.td}>{c.denuncia_codigo || `#${c.id_denuncia}`}</td>
                        <td style={st.td}>{c.asegurado}<br /><small>{c.motivo}</small></td>
                        <td style={st.td}>{c.especialidad} · {c.fecha_cita}</td>
                        <td style={st.td}>
                          <span style={{ ...st.badge, backgroundColor: est.bg, color: est.color }}>{c.estado}</span>
                        </td>
                        <td style={st.td}>
                          {c.estado !== 'confirmada' ? (
                            <button onClick={() => confirmarCita(c.id)} style={st.btnPrimarySm}>
                              Confirmar cita
                            </button>
                          ) : (
                            <span style={{ color: '#166534', fontSize: '12px', fontWeight: 700 }}>✓ Confirmada</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {moduloActivo === 'mercado-seguridad' && puedeVerMercado && (
            <div>
              <div style={st.crumb}>Mercado Mayorista › Seguridad por comerciante</div>
              <h2 style={st.h2}>Denuncias por Comerciante</h2>

              <div style={st.card}>
                {rankingSeguridad.map((r) => (
                  <div key={r.id} style={st.rankRow}>
                    <div style={{ width: '240px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {r.foto_puesto && (
                        <img
                          src={r.foto_puesto}
                          alt={r.puesto}
                          style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                      )}
                      <span>
                        {r.nombre} · <span style={{ color: '#4b6658' }}>{r.puesto}</span>
                      </span>
                    </div>
                    <div style={st.barTrack}>
                      <div
                        style={{
                          ...st.barFill,
                          width: `${(Number(r.total_denuncias) / maxDenuncias) * 100}%`,
                        }}
                      />
                    </div>
                    <div style={{ width: '90px', textAlign: 'right', fontWeight: 700 }}>
                      {r.total_denuncias} {Number(r.total_denuncias) === 1 ? 'denuncia' : 'denuncias'}
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={st.h3}>Registrar Nuevo Comerciante en el Padrón</h3>
              <form onSubmit={registrarComerciante} style={st.card}>
                <div style={st.grid2}>
                  <input
                    type="text"
                    placeholder="Nombre del comerciante"
                    value={nuevoCom.nombre}
                    onChange={(e) => setNuevoCom({ ...nuevoCom, nombre: e.target.value })}
                    style={st.input}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Puesto (Ej. Puesto A-07)"
                    value={nuevoCom.puesto}
                    onChange={(e) => setNuevoCom({ ...nuevoCom, puesto: e.target.value })}
                    style={st.input}
                    required
                  />
                  <input
                    type="text"
                    placeholder="DNI"
                    value={nuevoCom.dni}
                    onChange={(e) => setNuevoCom({ ...nuevoCom, dni: e.target.value })}
                    style={st.input}
                  />
                  <input
                    type="text"
                    placeholder="Rubro (Ej. Frutas y Verduras)"
                    value={nuevoCom.rubro}
                    onChange={(e) => setNuevoCom({ ...nuevoCom, rubro: e.target.value })}
                    style={st.input}
                  />
                </div>
                <div style={{ marginTop: '12px' }}>
                  <label style={st.label}>Foto del puesto (se guarda directo en Neon BD)</label>
                  <input type="file" accept="image/*" onChange={subirFotoNuevoComerciante} style={st.input} />
                </div>
                <button type="submit" style={{ ...st.btnPrimary, marginTop: '12px' }}>
                  + Registrar Comerciante
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {toast && <div style={st.toast}>✅ {toast}</div>}
    </div>
  );
}

const st = {
  loginWrap: { minHeight: '100vh', background: 'linear-gradient(135deg,#0f3d24,#165c36)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '16px' },
  loginCard: { background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '410px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' },
  kicker: { fontSize: '11px', fontWeight: 700, color: '#16a34a', letterSpacing: '0.08em' },
  loginTitle: { margin: '4px 0', fontSize: '24px', color: '#0f3d24' },
  loginSub: { margin: '0 0 18px 0', fontSize: '13px', color: '#4b6658' },
  quickBox: { marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' },
  quickTitle: { fontSize: '12px', color: '#4b6658', fontWeight: 600 },
  quickBtn: { background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, textAlign: 'left', fontSize: '13px' },
  shell: { minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: '#eef2f0', color: '#1b2a22' },
  navbar: { background: '#0f3d24', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navTag: { marginLeft: '12px', fontSize: '12px', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '999px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  userBadge: { fontSize: '13px', background: 'rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: '20px' },
  btnExit: { background: '#dc2626', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  body: { display: 'flex', flex: 1 },
  sidebar: { width: '250px', background: '#dfe8e3', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  menuTitle: { fontSize: '11px', fontWeight: 700, color: '#4f6a5b', padding: '0 8px 4px' },
  menuItem: { textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#23392d', fontWeight: 700, cursor: 'pointer', fontSize: '14px' },
  menuActive: { textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' },
  menuSub: { display: 'block', fontWeight: 400, fontSize: '11px', opacity: 0.85, marginTop: '2px' },
  main: { flex: 1, padding: '24px 28px', overflowX: 'auto' },
  crumb: { fontSize: '12px', color: '#4b6658', fontFamily: 'monospace', marginBottom: '4px' },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' },
  h2: { margin: 0, fontSize: '22px', color: '#0f3d24' },
  h3: { margin: '18px 0 10px', fontSize: '16px', color: '#0f3d24' },
  card: { background: '#fff', padding: '18px', borderRadius: '10px', border: '1px solid #cfdcd5', marginBottom: '16px' },
  deriveBox: { background: '#ecfdf3', border: '2px solid #16a34a', padding: '16px', borderRadius: '10px', marginBottom: '18px' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', fontSize: '14px' },
  th: { background: '#e3ece7', color: '#2c4537', textAlign: 'left', padding: '10px 12px', fontSize: '12px' },
  tr: { borderTop: '1px solid #e3ece7' },
  rowWarn: { borderTop: '1px solid #e3ece7', background: '#fefce8' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  badge: { padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, display: 'inline-block' },
  rankRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  barTrack: { flex: 1, height: '20px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' },
  barFill: { height: '100%', background: '#16a34a', borderRadius: '6px', transition: 'width 0.5s' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { fontSize: '12px', fontWeight: 700, color: '#355244', display: 'block', marginBottom: '4px' },
  input: { width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1.5px solid #b9cbc1', fontSize: '14px', boxSizing: 'border-box' },
  inputPre: { width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1.5px dashed #16a34a', background: '#fff', fontSize: '14px', boxSizing: 'border-box' },
  btnPrimary: { background: '#16a34a', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' },
  btnPrimarySm: { background: '#16a34a', color: '#fff', border: 'none', padding: '5px 11px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' },
  btnDangerSm: { background: '#dc2626', color: '#fff', border: 'none', padding: '5px 11px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' },
  btnOutline: { background: '#fff', border: '1px solid #b9cbc1', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  err: { color: '#dc2626', fontSize: '13px', margin: 0 },
  toast: { position: 'fixed', right: '20px', bottom: '20px', background: '#14532d', color: '#fff', padding: '12px 18px', borderRadius: '10px', fontWeight: 700, borderLeft: '5px solid #4ade80', boxShadow: '0 10px 20px rgba(0,0,0,0.25)' },
};