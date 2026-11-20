import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://mercado-seguro-api-26c0.onrender.com';

const BADGE_STYLE = {
  registrado: { bg: '#e2e8f0', color: '#334155' },
  'en investigación': { bg: '#fef3c7', color: '#92400e' },
  derivado: { bg: '#fef3c7', color: '#92400e' },
  atendido: { bg: '#dcfce7', color: '#166534' },
  confirmada: { bg: '#dcfce7', color: '#166534' },
  activo: { bg: '#dcfce7', color: '#166534' },
};

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [modoAuth, setModoAuth] = useState('login'); // 'login' | 'registro'
  const [cred, setCred] = useState({ email: 'cliente1@correo.com', password: '1234' });
  const [reg, setReg] = useState({
    nombre: '',
    dni: '',
    puesto: '',
    rubro: 'Abarrotes',
    telefono: '',
    email: '',
    password: '',
    foto_puesto: '',
  });
  const [errorLogin, setErrorLogin] = useState('');
  const [cargandoAuth, setCargandoAuth] = useState(false);

  const [vista, setVista] = useState('mi-puesto');
  const [puestoData, setPuestoData] = useState(null);
  const [denuncias, setDenuncias] = useState([]);
  const [toast, setToast] = useState('');

  const [formDenuncia, setFormDenuncia] = useState({
    denunciante: '',
    lugar: '',
    hecho: '',
    hay_lesionados: 'No',
    evidencia_imagen: '',
  });
  const [enviando, setEnviando] = useState(false);

  const mostrarToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    setCargandoAuth(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorLogin(data.error || 'Error al iniciar sesión');
        return;
      }
      setUsuario(data.usuario);
    } catch {
      setErrorLogin('La API en Render está iniciando. Intenta de nuevo en 10 segundos.');
    } finally {
      setCargandoAuth(false);
    }
  };

  const registrarNuevoComerciante = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    setCargandoAuth(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reg),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorLogin(data.error || 'No se pudo completar el registro');
        return;
      }
      setUsuario(data.usuario);
      mostrarToast(`¡Bienvenido ${data.usuario.nombre}! Puesto ${reg.puesto} registrado en Neon BD`);
    } catch {
      setErrorLogin('Error de conexión con Render. Intenta de nuevo en unos segundos.');
    } finally {
      setCargandoAuth(false);
    }
  };

  const subirFotoRegistro = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setReg((prev) => ({ ...prev, foto_puesto: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const cargarMiPuesto = async () => {
    const idCom = usuario?.comerciante?.id || 1;
    try {
      const res = await fetch(`${API_URL}/api/mercado/mi-puesto/${idCom}`);
      const data = await res.json();
      setPuestoData(data.puesto);
      setDenuncias(data.denuncias || []);
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    if (usuario) {
      cargarMiPuesto();
    }
  }, [usuario]);

  const subirFotoPuesto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const idCom = puestoData?.id || usuario?.comerciante?.id || 1;
      const res = await fetch(`${API_URL}/api/mercado/mi-puesto/${idCom}/foto`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto_puesto: reader.result }),
      });
      if (res.ok) {
        mostrarToast('Foto del puesto guardada en Neon BD');
        cargarMiPuesto();
      }
    };
    reader.readAsDataURL(file);
  };

  const subirFotoDenuncia = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormDenuncia((prev) => ({ ...prev, evidencia_imagen: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const abrirFormularioDenuncia = () => {
    const nombreCom = puestoData?.nombre || usuario?.nombre || 'Comerciante';
    const puestoCom = puestoData?.puesto || 'Sin puesto';
    setFormDenuncia({
      denunciante: nombreCom,
      lugar: `Mercado Mayorista · ${puestoCom}`,
      hecho: '',
      hay_lesionados: 'No',
      evidencia_imagen: '',
    });
    setVista('denuncia-pnp');
  };

  const enviarDenuncia = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/api/pnp/denuncias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_comerciante: puestoData?.id || usuario?.comerciante?.id || 1,
          ...formDenuncia,
        }),
      });
      const creada = await res.json();
      if (res.ok) {
        mostrarToast(`Denuncia registrada en Neon y enviada a PNP · ${creada.codigo}`);
        await cargarMiPuesto();
        setVista('mi-puesto');
      }
    } finally {
      setEnviando(false);
    }
  };

  if (!usuario) {
    return (
      <div style={st.loginWrap}>
        <div style={{ ...st.loginCard, maxWidth: modoAuth === 'registro' ? '480px' : '390px' }}>
          <span style={st.kicker}>GRUPO 4 · MERCADO SEGURO</span>
          <h1 style={st.loginTitle}>Portal Comerciante</h1>
          <p style={st.loginSub}>Conectado a Mercado Mayorista, PNP y EsSalud</p>

          <div style={st.tabsRow}>
            <button
              type="button"
              onClick={() => { setModoAuth('login'); setErrorLogin(''); }}
              style={modoAuth === 'login' ? st.tabActive : st.tabBtn}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setModoAuth('registro'); setErrorLogin(''); }}
              style={modoAuth === 'registro' ? st.tabActive : st.tabBtn}
            >
              Registrarme (Nuevo)
            </button>
          </div>

          {modoAuth === 'login' ? (
            <form onSubmit={iniciarSesion} style={st.form}>
              <label style={st.label}>Correo</label>
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
              <button type="submit" disabled={cargandoAuth} style={st.btnPrimary}>
                {cargandoAuth ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          ) : (
            <form onSubmit={registrarNuevoComerciante} style={st.form}>
              <div style={st.grid2}>
                <div>
                  <label style={st.label}>Nombre completo *</label>
                  <input
                    type="text"
                    placeholder="Ej. María Quispe"
                    value={reg.nombre}
                    onChange={(e) => setReg({ ...reg, nombre: e.target.value })}
                    style={st.input}
                    required
                  />
                </div>
                <div>
                  <label style={st.label}>DNI *</label>
                  <input
                    type="text"
                    placeholder="Ej. 72345678"
                    value={reg.dni}
                    onChange={(e) => setReg({ ...reg, dni: e.target.value })}
                    style={st.input}
                    required
                  />
                </div>
                <div>
                  <label style={st.label}>N° de Puesto *</label>
                  <input
                    type="text"
                    placeholder="Ej. Puesto D-08"
                    value={reg.puesto}
                    onChange={(e) => setReg({ ...reg, puesto: e.target.value })}
                    style={st.input}
                    required
                  />
                </div>
                <div>
                  <label style={st.label}>Rubro</label>
                  <input
                    type="text"
                    placeholder="Ej. Frutas, Carnes..."
                    value={reg.rubro}
                    onChange={(e) => setReg({ ...reg, rubro: e.target.value })}
                    style={st.input}
                  />
                </div>
                <div>
                  <label style={st.label}>Correo electrónico *</label>
                  <input
                    type="email"
                    placeholder="maria@correo.com"
                    value={reg.email}
                    onChange={(e) => setReg({ ...reg, email: e.target.value })}
                    style={st.input}
                    required
                  />
                </div>
                <div>
                  <label style={st.label}>Contraseña *</label>
                  <input
                    type="password"
                    placeholder="Crea tu clave"
                    value={reg.password}
                    onChange={(e) => setReg({ ...reg, password: e.target.value })}
                    style={st.input}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={st.label}>Foto de tu puesto (opcional, se guarda en Neon BD)</label>
                <input type="file" accept="image/*" onChange={subirFotoRegistro} style={st.input} />
              </div>

              {errorLogin && <p style={st.err}>{errorLogin}</p>}
              <button type="submit" disabled={cargandoAuth} style={st.btnPrimary}>
                {cargandoAuth ? 'Creando cuenta en Neon...' : 'Crear mi cuenta y entrar'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={st.shell}>
      <header style={st.navbar}>
        <div>
          <strong>Grupo 4 · Mercado Seguro</strong>
          <span style={st.navTag}>1 sola cuenta · 3 módulos</span>
        </div>
        <div style={st.navRight}>
          <span style={st.userBadge}>{usuario.nombre} · {puestoData?.puesto || 'Comerciante'}</span>
          <button onClick={() => setUsuario(null)} style={st.btnExit}>Salir</button>
        </div>
      </header>

      <div style={st.body}>
        <aside style={st.sidebar}>
          <div style={st.menuTitle}>MIS MÓDULOS (ROL: CLIENTE)</div>
          <button
            onClick={() => setVista('mi-puesto')}
            style={vista === 'mi-puesto' ? st.menuActive : st.menuItem}
          >
            🏪 Mercado Mayorista
            <small style={st.menuSub}>Mi puesto y estado</small>
          </button>
          <button
            onClick={abrirFormularioDenuncia}
            style={vista === 'denuncia-pnp' ? st.menuActive : st.menuItem}
          >
            🚓 Central Emergencias PNP
            <small style={st.menuSub}>Denuncia digital precargada</small>
          </button>
          <button
            onClick={() => setVista('citas-essalud')}
            style={vista === 'citas-essalud' ? st.menuActive : st.menuItem}
          >
            🏥 EsSalud Norte Chico
            <small style={st.menuSub}>Mis citas médicas derivadas</small>
          </button>
        </aside>

        <main style={st.main}>
          {vista === 'mi-puesto' && (
            <div>
              <div style={st.crumb}>Mercado Mayorista › Mi puesto</div>
              <div style={st.headerRow}>
                <h2 style={st.h2}>
                  Mi puesto · {puestoData?.puesto || 'Sin asignar'} ({puestoData?.rubro || 'Abarrotes'})
                </h2>
                <button onClick={abrirFormularioDenuncia} style={st.btnDanger}>
                  🚨 Denunciar incidente
                </button>
              </div>

              <div style={st.card}>
                <div style={st.rowBetween}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {puestoData?.foto_puesto && (
                      <img
                        src={puestoData.foto_puesto}
                        alt="Puesto"
                        style={{ width: '85px', height: '85px', objectFit: 'cover', borderRadius: '10px', border: '2px solid #16a34a' }}
                      />
                    )}
                    <div>
                      <div>
                        <strong>Titular:</strong> {puestoData?.nombre || usuario.nombre} ·{' '}
                        <strong>DNI:</strong> {puestoData?.dni || 'No registrado'}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', cursor: 'pointer' }}>
                          📷 Subir/Cambiar foto del puesto (se guarda en Neon BD):{' '}
                          <input type="file" accept="image/*" onChange={subirFotoPuesto} style={{ fontSize: '12px' }} />
                        </label>
                      </div>
                    </div>
                  </div>
                  <span style={{ ...st.badge, ...BADGE_STYLE.activo }}>Puesto Activo</span>
                </div>
              </div>

              <div style={st.rowBetween}>
                <h3 style={st.h3}>Mis denuncias y citas vinculadas</h3>
                <button onClick={cargarMiPuesto} style={st.btnOutline}>↻ Actualizar estados</button>
              </div>

              {denuncias.length === 0 ? (
                <p style={st.muted}>No tienes incidentes registrados. Todo tranquilo en tu puesto.</p>
              ) : (
                <div style={st.list}>
                  {denuncias.map((d) => {
                    const est = BADGE_STYLE[d.estado] || BADGE_STYLE.registrado;
                    return (
                      <div key={d.id} style={st.itemCard}>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          {d.evidencia_imagen && (
                            <img
                              src={d.evidencia_imagen}
                              alt="Evidencia"
                              style={{ width: '80px', height: '65px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                          )}
                          <div>
                            <div style={st.code}>{d.codigo} · {d.lugar}</div>
                            <div style={st.desc}>{d.hecho} (Lesionados: <strong>{d.hay_lesionados}</strong>)</div>
                            {d.cita_codigo && (
                              <div style={st.citaLink}>
                                🏥 Cita EsSalud vinculada: <strong>{d.cita_codigo}</strong> ({d.fecha_cita}) —{' '}
                                <span style={{ ...st.badge, ...(BADGE_STYLE[d.cita_estado] || BADGE_STYLE.registrado) }}>
                                  {d.cita_estado}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span style={{ ...st.badge, backgroundColor: est.bg, color: est.color }}>
                          {d.estado}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {vista === 'denuncia-pnp' && (
            <div>
              <div style={st.crumb}>PNP › Denuncia digital</div>
              <h2 style={st.h2}>Registrar Denuncia Digital</h2>
              <p style={st.muted}>
                Datos precargados desde tu ficha de comerciante en Mercado Mayorista.
              </p>

              <form onSubmit={enviarDenuncia} style={st.formCard}>
                <div style={st.grid2}>
                  <div>
                    <label style={st.label}>
                      Denunciante <span style={st.preTag}>precargado</span>
                    </label>
                    <input
                      type="text"
                      value={formDenuncia.denunciante}
                      onChange={(e) => setFormDenuncia({ ...formDenuncia, denunciante: e.target.value })}
                      style={st.inputPre}
                      required
                    />
                  </div>
                  <div>
                    <label style={st.label}>
                      Lugar del incidente <span style={st.preTag}>precargado</span>
                    </label>
                    <input
                      type="text"
                      value={formDenuncia.lugar}
                      onChange={(e) => setFormDenuncia({ ...formDenuncia, lugar: e.target.value })}
                      style={st.inputPre}
                      required
                    />
                  </div>
                </div>

                <label style={st.label}>Descripción del hecho</label>
                <input
                  type="text"
                  placeholder="Ej. Robo de mercadería en el puesto"
                  value={formDenuncia.hecho}
                  onChange={(e) => setFormDenuncia({ ...formDenuncia, hecho: e.target.value })}
                  style={st.input}
                  required
                />

                <label style={st.label}>¿Hay lesionados? (Activa derivación a EsSalud)</label>
                <select
                  value={formDenuncia.hay_lesionados}
                  onChange={(e) => setFormDenuncia({ ...formDenuncia, hay_lesionados: e.target.value })}
                  style={st.input}
                >
                  <option value="No">No</option>
                  <option value="Sí">Sí (requiere atención médica en EsSalud)</option>
                </select>

                <label style={st.label}>Foto de evidencia (se guarda directo en Neon BD)</label>
                <input type="file" accept="image/*" onChange={subirFotoDenuncia} style={st.input} />
                {formDenuncia.evidencia_imagen && (
                  <img
                    src={formDenuncia.evidencia_imagen}
                    alt="Vista previa"
                    style={{ width: '140px', height: '95px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #16a34a' }}
                  />
                )}

                <button type="submit" disabled={enviando} style={st.btnPrimary}>
                  {enviando ? 'Guardando en Neon...' : 'Enviar denuncia a PNP'}
                </button>
              </form>
            </div>
          )}

          {vista === 'citas-essalud' && (
            <div>
              <div style={st.crumb}>EsSalud Norte Chico › Mis atenciones</div>
              <h2 style={st.h2}>Citas Médicas Derivadas por Emergencia</h2>
              {denuncias.filter((d) => d.cita_codigo).length === 0 ? (
                <p style={st.muted}>No tienes citas médicas derivadas desde denuncias policiales.</p>
              ) : (
                <div style={st.list}>
                  {denuncias
                    .filter((d) => d.cita_codigo)
                    .map((d) => (
                      <div key={d.id} style={st.itemCard}>
                        <div>
                          <div style={st.code}>{d.cita_codigo} · Origen: Denuncia {d.codigo}</div>
                          <div style={st.desc}>Fecha programada: {d.fecha_cita}</div>
                        </div>
                        <span style={{ ...st.badge, ...(BADGE_STYLE[d.cita_estado] || BADGE_STYLE.registrado) }}>
                          {d.cita_estado}
                        </span>
                      </div>
                    ))}
                </div>
              )}
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
  loginCard: { background: '#fff', borderRadius: '14px', padding: '26px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', transition: 'max-width 0.2s' },
  kicker: { fontSize: '11px', fontWeight: 700, color: '#16a34a', letterSpacing: '0.08em' },
  loginTitle: { margin: '4px 0', fontSize: '24px', color: '#0f3d24' },
  loginSub: { margin: '0 0 14px 0', fontSize: '13px', color: '#4b6658' },
  tabsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: '#eef2f0', padding: '4px', borderRadius: '10px', marginBottom: '16px' },
  tabBtn: { padding: '8px', border: 'none', borderRadius: '7px', background: 'transparent', color: '#4b6658', fontWeight: 700, cursor: 'pointer', fontSize: '13px' },
  tabActive: { padding: '8px', border: 'none', borderRadius: '7px', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' },
  shell: { minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: '#eef2f0', color: '#1b2a22' },
  navbar: { background: '#0f3d24', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navTag: { marginLeft: '12px', fontSize: '12px', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '999px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  userBadge: { fontSize: '13px', background: 'rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: '20px' },
  btnExit: { background: '#dc2626', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  body: { display: 'flex', flex: 1 },
  sidebar: { width: '240px', background: '#dfe8e3', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  menuTitle: { fontSize: '11px', fontWeight: 700, color: '#4f6a5b', padding: '0 8px 4px' },
  menuItem: { textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#23392d', fontWeight: 700, cursor: 'pointer', fontSize: '14px' },
  menuActive: { textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' },
  menuSub: { display: 'block', fontWeight: 400, fontSize: '11px', opacity: 0.85, marginTop: '2px' },
  main: { flex: 1, padding: '24px 28px', maxWidth: '960px' },
  crumb: { fontSize: '12px', color: '#4b6658', fontFamily: 'monospace', marginBottom: '4px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' },
  h2: { margin: 0, fontSize: '22px', color: '#0f3d24' },
  h3: { margin: '18px 0 10px', fontSize: '16px', color: '#0f3d24' },
  card: { background: '#fff', padding: '16px', borderRadius: '10px', border: '1px solid #cfdcd5', marginBottom: '16px' },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  itemCard: { background: '#fff', border: '1px solid #cfdcd5', borderLeft: '5px solid #16a34a', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  code: { fontWeight: 700, fontSize: '15px', color: '#0f3d24' },
  desc: { fontSize: '13px', color: '#4b6658', marginTop: '3px' },
  citaLink: { marginTop: '6px', fontSize: '13px', background: '#ecfdf3', padding: '5px 10px', borderRadius: '6px', color: '#14532d' },
  badge: { padding: '3px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' },
  formCard: { background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #cfdcd5', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  label: { fontSize: '12px', fontWeight: 700, color: '#355244', display: 'block', marginBottom: '3px' },
  preTag: { fontSize: '11px', color: '#15803d', marginLeft: '6px' },
  input: { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #b9cbc1', fontSize: '13px', boxSizing: 'border-box' },
  inputPre: { width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1.5px dashed #16a34a', background: '#ecfdf3', fontSize: '14px', boxSizing: 'border-box' },
  btnPrimary: { background: '#16a34a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '14px', marginTop: '4px' },
  btnDanger: { background: '#dc2626', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' },
  btnOutline: { background: '#fff', border: '1px solid #b9cbc1', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  muted: { color: '#4b6658', fontSize: '14px' },
  err: { color: '#dc2626', fontSize: '13px', margin: 0 },
  toast: { position: 'fixed', right: '20px', bottom: '20px', background: '#14532d', color: '#fff', padding: '12px 18px', borderRadius: '10px', fontWeight: 700, borderLeft: '5px solid #4ade80', boxShadow: '0 10px 20px rgba(0,0,0,0.25)' },
};