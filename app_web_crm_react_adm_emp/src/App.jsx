import { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://mercado-seguro-api-26c0.onrender.com';

const STORAGE_DENUNCIAS = 'rc_bd_denuncias_v4';
const STORAGE_CITAS = 'rc_bd_citas_v4';

function leerStorage(clave) {
  try {
    const raw = localStorage.getItem(clave);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  // Sesión activa
  const [usuario, setUsuario] = useState(() => {
    const saved = localStorage.getItem('rc_usuario');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('rc_token') || '');

  // Campos de inicio de sesión
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');
  const [cargandoAuth, setCargandoAuth] = useState(false);

  // Módulo activo ('mercado' | 'pnp' | 'essalud')
  const [appActiva, setAppActiva] = useState(() => {
    const saved = localStorage.getItem('rc_usuario');
    if (!saved) return 'mercado';
    const perms = obtenerPermisosUsuario(JSON.parse(saved));
    return Object.keys(perms)[0] || 'mercado';
  });

  // Datos reales persistentes
  const [productos, setProductos] = useState([]);
  const [denuncias, setDenuncias] = useState(() => leerStorage(STORAGE_DENUNCIAS));
  const [citas, setCitas] = useState(() => leerStorage(STORAGE_CITAS));
  const [sincronizando, setSincronizando] = useState(false);

  // Filtro visual en Central PNP
  const [filtroEstadoPnp, setFiltroEstadoPnp] = useState('Todos');

  // Formularios
  const [formProd, setFormProd] = useState({ nombre: '', descripcion: '', precio: '', stock: '' });
  const [editandoProdId, setEditandoProdId] = useState(null);

  const [formDenuncia, setFormDenuncia] = useState({
    nombre_comerciante: '',
    puesto: 'Puesto A-14',
    tipo_incidente: 'Robo agravado en puesto',
    descripcion: '',
    hay_lesionados: false,
  });

  const [formCita, setFormCita] = useState({
    id_denuncia: '',
    codigo_denuncia: '',
    id_comerciante: '',
    agraviado: '',
    especialidad: 'Medicina General / Emergencias',
    fecha_cita: '',
  });

  // Indicador de datos precargados (UX-2)
  const [precargaPnp, setPrecargaPnp] = useState(null);
  const [precargaSaludActiva, setPrecargaSaludActiva] = useState(false);

  // Respuesta inmediata y código de seguimiento (UX-3)
  const [guardando, setGuardando] = useState(false);
  const [ultimoCodigoCreado, setUltimoCodigoCreado] = useState('');
  const [alerta, setAlerta] = useState({ tipo: '', texto: '', codigo: '' });

  // =========================================================
  // UX-1: UN SOLO LOGIN · MENÚ MUESTRA SOLO APPS DE MIS ROLES
  // =========================================================
  function obtenerPermisosUsuario(user) {
    if (!user) return {};
    const rol = (user.rol || '').toLowerCase().trim();
    const correo = (user.email || '').toLowerCase().trim();

    if (correo.includes('essalud')) {
      return { essalud: rol || 'empleado' };
    }
    if (correo.includes('pnp') || correo.includes('policia')) {
      return { pnp: rol || 'empleado' };
    }
    if (rol === 'cliente' || correo.includes('comerciante')) {
      return { mercado: 'cliente', pnp: 'cliente', essalud: 'cliente' };
    }
    if (rol === 'administrador' || rol === 'admin') {
      return { mercado: 'administrador' };
    }
    return { mercado: 'cliente' };
  }

  // =========================================================
  // SINCRONIZACIÓN ENTRE PESTAÑAS Y CON LA BASE DE DATOS
  // =========================================================
  useEffect(() => {
    const manejarCambioStorage = (e) => {
      if (e.key === STORAGE_DENUNCIAS) {
        setDenuncias(leerStorage(STORAGE_DENUNCIAS));
      }
      if (e.key === STORAGE_CITAS) {
        setCitas(leerStorage(STORAGE_CITAS));
      }
    };
    window.addEventListener('storage', manejarCambioStorage);
    return () => window.removeEventListener('storage', manejarCambioStorage);
  }, []);

  const cargarDatosReales = useCallback(async () => {
    setSincronizando(true);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // 1. Productos (/api/productos)
      try {
        const resProd = await fetch(`${API_URL}/api/productos`, { headers });
        if (resProd.ok) {
          const dataP = await resProd.json();
          if (Array.isArray(dataP)) setProductos(dataP);
        }
      } catch {
        // Mantiene estado actual
      }

      // 2. Denuncias (/api/denuncias o respaldo en /api/pedidos)
      let denunciasServidor = [];
      try {
        const resDen = await fetch(`${API_URL}/api/denuncias`, { headers });
        if (resDen.ok) {
          const dataD = await resDen.json();
          if (Array.isArray(dataD)) denunciasServidor = dataD;
        } else {
          const resPed = await fetch(`${API_URL}/api/pedidos`, { headers });
          if (resPed.ok) {
            const pedidos = await resPed.json();
            const mapaPed = new Map();
            [...pedidos].reverse().forEach((p) => {
              const item = typeof p.items === 'string' ? JSON.parse(p.items) : p.items;
              if (item && item.tipo_registro === 'DENUNCIA') {
                mapaPed.set(item.codigo, { ...item, id: item.id || p.id });
              } else if (item && item.tipo_registro === 'ESTADO_DENUNCIA') {
                const prev = mapaPed.get(item.codigo);
                if (prev) mapaPed.set(item.codigo, { ...prev, estado: item.estado });
              }
            });
            denunciasServidor = Array.from(mapaPed.values());
          }
        }
      } catch {
        // Continúa con almacenamiento persistente
      }

      const localesDen = leerStorage(STORAGE_DENUNCIAS);
      const mapaCombinadoDen = new Map();
      denunciasServidor.forEach((d) => {
        if (d && d.codigo) mapaCombinadoDen.set(d.codigo, d);
      });
      localesDen.forEach((d) => {
        if (d && d.codigo) mapaCombinadoDen.set(d.codigo, d);
      });
      const listaFinalDen = Array.from(mapaCombinadoDen.values()).sort(
        (a, b) => Number(b.id || 0) - Number(a.id || 0)
      );
      setDenuncias(listaFinalDen);
      localStorage.setItem(STORAGE_DENUNCIAS, JSON.stringify(listaFinalDen));

      // 3. Citas EsSalud (/api/citas o respaldo en /api/pedidos)
      let citasServidor = [];
      try {
        const resCit = await fetch(`${API_URL}/api/citas`, { headers });
        if (resCit.ok) {
          const dataC = await resCit.json();
          if (Array.isArray(dataC)) citasServidor = dataC;
        } else {
          const resPed = await fetch(`${API_URL}/api/pedidos`, { headers });
          if (resPed.ok) {
            const pedidos = await resPed.json();
            const mapaCit = new Map();
            [...pedidos].reverse().forEach((p) => {
              const item = typeof p.items === 'string' ? JSON.parse(p.items) : p.items;
              if (item && item.tipo_registro === 'CITA') {
                mapaCit.set(item.codigo_cita, { ...item, id: item.id || p.id });
              } else if (item && item.tipo_registro === 'CONFIRMAR_CITA') {
                const prev = mapaCit.get(item.codigo_cita);
                if (prev) {
                  mapaCit.set(item.codigo_cita, {
                    ...prev,
                    estado: 'Confirmada',
                    fecha_cita: item.fecha_cita || prev.fecha_cita,
                    especialidad: item.especialidad || prev.especialidad,
                  });
                }
              }
            });
            citasServidor = Array.from(mapaCit.values());
          }
        }
      } catch {
        // Continúa con almacenamiento persistente
      }

      const localesCit = leerStorage(STORAGE_CITAS);
      const mapaCombinadoCit = new Map();
      citasServidor.forEach((c) => {
        if (c && c.codigo_cita) mapaCombinadoCit.set(c.codigo_cita, c);
      });
      localesCit.forEach((c) => {
        if (c && c.codigo_cita) mapaCombinadoCit.set(c.codigo_cita, c);
      });
      const listaFinalCit = Array.from(mapaCombinadoCit.values()).sort(
        (a, b) => Number(b.id || 0) - Number(a.id || 0)
      );
      setCitas(listaFinalCit);
      localStorage.setItem(STORAGE_CITAS, JSON.stringify(listaFinalCit));
    } finally {
      setSincronizando(false);
    }
  }, [token]);

  useEffect(() => {
    if (!usuario) return;
    const perms = obtenerPermisosUsuario(usuario);
    if (!perms[appActiva]) {
      setAppActiva(Object.keys(perms)[0] || 'mercado');
    }
    cargarDatosReales();
  }, [usuario]);

  // UX-2: Precarga automática en EsSalud cuando llega un caso derivado desde PNP
  useEffect(() => {
    if (appActiva === 'essalud' && !formCita.codigo_denuncia) {
      const derivadaPendiente = denuncias.find((d) => {
        if (d.estado !== 'Derivado') return false;
        const cita = citas.find((c) => c.codigo_denuncia === d.codigo);
        return !cita || cita.estado !== 'Confirmada';
      });
      if (derivadaPendiente) {
        const citaPrev = citas.find((c) => c.codigo_denuncia === derivadaPendiente.codigo);
        setFormCita({
          id_denuncia: derivadaPendiente.id,
          codigo_denuncia: derivadaPendiente.codigo,
          id_comerciante: derivadaPendiente.id_comerciante,
          agraviado: derivadaPendiente.nombre_comerciante,
          especialidad: citaPrev?.especialidad || 'Medicina General / Emergencias',
          fecha_cita: '',
        });
        setPrecargaSaludActiva(true);
      }
    }
  }, [appActiva, denuncias, citas, formCita.codigo_denuncia]);

  const mostrarAlerta = (tipo, texto, codigo = '') => {
    setAlerta({ tipo, texto, codigo });
    setTimeout(() => setAlerta({ tipo: '', texto: '', codigo: '' }), 5500);
  };

  // =========================================================
  // LOGIN ÚNICO (/api/auth/login)
  // =========================================================
  const manejarLogin = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    setCargandoAuth(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorLogin(data.error || data.mensaje || 'Correo o contraseña incorrectos.');
        setCargandoAuth(false);
        return;
      }

      const userObj = data.usuario;
      const permisos = obtenerPermisosUsuario(userObj);
      const moduloInicial = Object.keys(permisos)[0] || 'mercado';

      setUsuario(userObj);
      setToken(data.token);
      setAppActiva(moduloInicial);
      localStorage.setItem('rc_usuario', JSON.stringify(userObj));
      localStorage.setItem('rc_token', data.token);
    } catch {
      setErrorLogin('No se pudo conectar con el servidor.');
    } finally {
      setCargandoAuth(false);
    }
  };

  const cerrarSesion = () => {
    setUsuario(null);
    setToken('');
    setEmail('');
    setPassword('');
    setPrecargaPnp(null);
    setPrecargaSaludActiva(false);
    setAlerta({ tipo: '', texto: '', codigo: '' });
    localStorage.removeItem('rc_usuario');
    localStorage.removeItem('rc_token');
  };

  // =========================================================
  // CRUD PRODUCTOS (/api/productos)
  // =========================================================
  const guardarProducto = async (e) => {
    e.preventDefault();
    setGuardando(true);

    const url = editandoProdId ? `${API_URL}/api/productos/${editandoProdId}` : `${API_URL}/api/productos`;
    const method = editandoProdId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre: formProd.nombre,
          descripcion: formProd.descripcion,
          precio: Number(formProd.precio),
          stock: Number(formProd.stock),
        }),
      });

      if (res.ok) {
        const dataProd = await res.json();
        const codProd = `PROD-${String(dataProd?.id || editandoProdId || productos.length + 1).padStart(4, '0')}`;
        mostrarAlerta(
          'ok',
          editandoProdId ? 'Producto actualizado correctamente.' : 'Producto registrado en el catálogo.',
          codProd
        );
        setFormProd({ nombre: '', descripcion: '', precio: '', stock: '' });
        setEditandoProdId(null);
        await cargarDatosReales();
      } else {
        mostrarAlerta('error', 'No se pudo guardar el producto.');
      }
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProducto = async (id) => {
    if (!window.confirm('¿Deseas eliminar este producto?')) return;
    const res = await fetch(`${API_URL}/api/productos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      mostrarAlerta('ok', 'Producto eliminado del catálogo.', `PROD-${String(id).padStart(4, '0')}`);
      await cargarDatosReales();
    }
  };

  // =========================================================
  // UX-2: PRECARGAR DATOS DESDE «MI PUESTO» HACIA CENTRAL PNP
  // =========================================================
  const irADenunciarDesdePuesto = () => {
    const datosPrecargados = {
      id_comerciante: usuario.id,
      nombre_comerciante: usuario.nombre,
      puesto: 'Puesto A-14',
    };
    setPrecargaPnp(datosPrecargados);
    setFormDenuncia({
      nombre_comerciante: usuario.nombre,
      puesto: 'Puesto A-14',
      tipo_incidente: 'Robo agravado en puesto',
      descripcion: '',
      hay_lesionados: false,
    });
    setAppActiva('pnp');
  };

  const registrarDenuncia = async (e) => {
    e.preventDefault();
    setGuardando(true);

    const actuales = leerStorage(STORAGE_DENUNCIAS);
    const codigoGenerado = `DEN-${String(actuales.length + 1).padStart(5, '0')}`;
    const nombreAgraviado =
      precargaPnp?.nombre_comerciante ||
      (permisos.pnp === 'cliente' ? usuario.nombre : formDenuncia.nombre_comerciante.trim()) ||
      'Comerciante Mercado';

    const nuevaDenuncia = {
      id: Date.now(),
      codigo: codigoGenerado,
      id_comerciante: precargaPnp?.id_comerciante || usuario.id,
      nombre_comerciante: nombreAgraviado,
      puesto: precargaPnp?.puesto || formDenuncia.puesto || 'Puesto A-14',
      tipo_incidente: formDenuncia.tipo_incidente,
      descripcion: formDenuncia.descripcion,
      hay_lesionados: formDenuncia.hay_lesionados,
      estado: 'En investigación',
      fecha_registro: new Date().toLocaleString('es-PE', { hour12: false }),
    };

    const actualizada = [nuevaDenuncia, ...actuales];
    setDenuncias(actualizada);
    localStorage.setItem(STORAGE_DENUNCIAS, JSON.stringify(actualizada));
    setUltimoCodigoCreado(codigoGenerado);
    setFiltroEstadoPnp('Todos');

    setFormDenuncia({
      nombre_comerciante: '',
      puesto: 'Puesto A-14',
      tipo_incidente: 'Robo agravado en puesto',
      descripcion: '',
      hay_lesionados: false,
    });
    setPrecargaPnp(null);
    mostrarAlerta('ok', 'Denuncia registrada y sincronizada con los módulos.', codigoGenerado);
    setGuardando(false);

    try {
      const res = await fetch(`${API_URL}/api/denuncias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(nuevaDenuncia),
      });
      if (!res.ok) {
        await fetch(`${API_URL}/api/pedidos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_email: usuario.email,
            items: { tipo_registro: 'DENUNCIA', ...nuevaDenuncia },
            total: 1,
          }),
        });
      }
    } catch {
      // Mantiene guardado local sin interrupciones
    }
  };

  // Estados permitidos en PNP: En investigación, Aceptado, Rechazado, Derivado
  const cambiarEstadoDenuncia = async (denuncia, nuevoEstado) => {
    const actuales = leerStorage(STORAGE_DENUNCIAS);
    const actualizadas = actuales.map((d) =>
      d.codigo === denuncia.codigo || d.id === denuncia.id ? { ...d, estado: nuevoEstado } : d
    );
    setDenuncias(actualizadas);
    localStorage.setItem(STORAGE_DENUNCIAS, JSON.stringify(actualizadas));

    mostrarAlerta('ok', `Estado actualizado a "${nuevoEstado}".`, denuncia.codigo);

    try {
      const res = await fetch(`${API_URL}/api/denuncias/${denuncia.id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) {
        await fetch(`${API_URL}/api/pedidos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_email: usuario.email,
            items: { tipo_registro: 'ESTADO_DENUNCIA', codigo: denuncia.codigo, estado: nuevoEstado },
            total: 1,
          }),
        });
      }
    } catch {
      // Mantiene actualización inmediata
    }
  };

  // Derivación a EsSalud con creación automática de cita vinculada
  const derivarDenunciaASalud = async (denuncia) => {
    await cambiarEstadoDenuncia(denuncia, 'Derivado');

    const citasActuales = leerStorage(STORAGE_CITAS);
    const yaExisteCita = citasActuales.some(
      (c) => c.codigo_denuncia === denuncia.codigo || String(c.id_denuncia) === String(denuncia.id)
    );

    let codigoCitaFinal = '';

    if (!yaExisteCita) {
      codigoCitaFinal = `CIT-${String(citasActuales.length + 101).padStart(4, '0')}`;
      const citaDerivada = {
        id: Date.now() + 1,
        codigo_cita: codigoCitaFinal,
        id_denuncia: denuncia.id,
        codigo_denuncia: denuncia.codigo,
        id_comerciante: denuncia.id_comerciante,
        agraviado: denuncia.nombre_comerciante,
        especialidad: 'Emergencias / Traumatología',
        fecha_cita: 'Asignada por Derivación PNP (Por confirmar turno)',
        estado: 'Derivada por PNP',
      };

      const citasActualizadas = [citaDerivada, ...citasActuales];
      setCitas(citasActualizadas);
      localStorage.setItem(STORAGE_CITAS, JSON.stringify(citasActualizadas));

      try {
        const res = await fetch(`${API_URL}/api/citas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(citaDerivada),
        });
        if (!res.ok) {
          await fetch(`${API_URL}/api/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario_email: usuario.email,
              items: { tipo_registro: 'CITA', ...citaDerivada },
              total: 1,
            }),
          });
        }
      } catch {
        // Mantiene guardado local
      }
    } else {
      const citaExist = citasActuales.find((c) => c.codigo_denuncia === denuncia.codigo);
      codigoCitaFinal = citaExist?.codigo_cita || denuncia.codigo;
    }

    mostrarAlerta(
      'ok',
      `Caso derivado a EsSalud Norte Chico para ${denuncia.nombre_comerciante}.`,
      `${denuncia.codigo} ➔ ${codigoCitaFinal}`
    );
  };

  // =========================================================
  // ESSALUD: PROGRAMAR O CONFIRMAR FECHA Y ESPECIALIDAD DE CITA
  // =========================================================
  const registrarCitaSalud = async (e) => {
    e.preventDefault();
    setGuardando(true);

    const citasActuales = leerStorage(STORAGE_CITAS);
    const existente = citasActuales.find((c) => c.codigo_denuncia === formCita.codigo_denuncia);
    const codigoCita = existente
      ? existente.codigo_cita
      : `CIT-${String(citasActuales.length + 101).padStart(4, '0')}`;

    const citaActualizada = {
      id: existente?.id || Date.now(),
      codigo_cita: codigoCita,
      id_denuncia: formCita.id_denuncia,
      codigo_denuncia: formCita.codigo_denuncia,
      id_comerciante: formCita.id_comerciante,
      agraviado: formCita.agraviado,
      especialidad: formCita.especialidad,
      fecha_cita: formCita.fecha_cita,
      estado: 'Confirmada',
    };

    const listaCitas = existente
      ? citasActuales.map((c) => (c.codigo_denuncia === formCita.codigo_denuncia ? citaActualizada : c))
      : [citaActualizada, ...citasActuales];

    setCitas(listaCitas);
    localStorage.setItem(STORAGE_CITAS, JSON.stringify(listaCitas));
    setUltimoCodigoCreado(codigoCita);
    setPrecargaSaludActiva(false);

    mostrarAlerta('ok', `Cita médica confirmada para ${formCita.agraviado}.`, codigoCita);
    setFormCita({
      id_denuncia: '',
      codigo_denuncia: '',
      id_comerciante: '',
      agraviado: '',
      especialidad: 'Medicina General / Emergencias',
      fecha_cita: '',
    });
    setGuardando(false);

    try {
      const res = await fetch(`${API_URL}/api/citas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(citaActualizada),
      });
      if (!res.ok) {
        await fetch(`${API_URL}/api/pedidos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_email: usuario.email,
            items: { tipo_registro: existente ? 'CONFIRMAR_CITA' : 'CITA', ...citaActualizada },
            total: 1,
          }),
        });
      }
    } catch {
      // Mantiene guardado local
    }
  };

  const confirmarCitaExistente = async (cita) => {
    const actuales = leerStorage(STORAGE_CITAS);
    const actualizadas = actuales.map((c) =>
      c.codigo_cita === cita.codigo_cita || c.id === cita.id ? { ...c, estado: 'Confirmada' } : c
    );
    setCitas(actualizadas);
    localStorage.setItem(STORAGE_CITAS, JSON.stringify(actualizadas));

    mostrarAlerta('ok', 'Atención médica confirmada.', cita.codigo_cita);

    try {
      const res = await fetch(`${API_URL}/api/citas/${cita.id}/confirmar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await fetch(`${API_URL}/api/pedidos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_email: usuario.email,
            items: { tipo_registro: 'CONFIRMAR_CITA', codigo_cita: cita.codigo_cita },
            total: 1,
          }),
        });
      }
    } catch {
      // Mantiene actualización inmediata
    }
  };

  // =========================================================
  // UX-4: ESTADOS CON COLOR FIJO SEGÚN LEYENDA OFICIAL
  // Leyenda:
  // - registrado -> 'registered' (azul/lavanda suave)
  // - en proceso / derivado -> 'process' (ámbar/amarillo suave)
  // - aprobado / atendido / pagado -> 'approved' (verde suave)
  // - rechazado -> 'rejected' (rojo/rosado suave)
  // =========================================================
  const obtenerClaseEstado = (estado) => {
    switch (estado) {
      case 'Registrado':
        return 'registered';
      case 'En investigación':
      case 'Derivado':
      case 'Derivada por PNP':
      case 'Pendiente':
        return 'process';
      case 'Aceptado':
      case 'Confirmada':
        return 'approved';
      case 'Rechazado':
        return 'rejected';
      default:
        return 'registered';
    }
  };

  const obtenerPasoFlujo = (denuncia) => {
    const cita = citas.find(
      (c) => String(c.id_denuncia) === String(denuncia.id) || c.codigo_denuncia === denuncia.codigo
    );
    if (cita && cita.estado === 'Confirmada') return 3;
    if (cita || denuncia.estado === 'Derivado' || denuncia.estado === 'Aceptado' || denuncia.estado === 'Rechazado') {
      return 2;
    }
    return 1;
  };

  // =========================================================
  // PANTALLA DE INICIO DE SESIÓN
  // =========================================================
  if (!usuario) {
    return (
      <div className="login-dynamic-bg">
        <div className="bg-orb orb-teal"></div>
        <div className="bg-orb orb-blue"></div>
        <div className="bg-orb orb-indigo"></div>
        <div className="bg-grid-lines"></div>

        <div className="login-split-card">
          <div className="login-showcase">
            <span className="status-pill">
              <span className="pulse-dot"></span>
              Portal Institucional Verificado
            </span>
            <h2>Atención y Seguridad Ciudadana</h2>
            <p>
              Bienvenido al entorno digital de coordinación institucional. Revisa las siguientes indicaciones antes de iniciar sesión:
            </p>

            <div className="showcase-list">
              <div className="showcase-card card-accent-info anim-step-1">
                <div className="showcase-icon icon-info">🛡️</div>
                <div>
                  <strong>Uso Autorizado y Confidencialidad</strong>
                  <span>
                    Tus credenciales son personales e intransferibles. Toda operación realizada queda auditada bajo protocolos de seguridad.
                  </span>
                </div>
              </div>

              <div className="showcase-card card-accent-warn anim-step-2">
                <div className="showcase-icon icon-warn">⚠️</div>
                <div>
                  <strong>Advertencia sobre Veracidad de Datos</strong>
                  <span>
                    El registro de reportes o denuncias con información falsa está sujeto a sanciones administrativas y legales vigentes.
                  </span>
                </div>
              </div>

              <div className="showcase-card card-accent-alert anim-step-3">
                <div className="showcase-icon icon-alert">🩺</div>
                <div>
                  <strong>Protocolo de Atención Prioritaria</strong>
                  <span>
                    Ante incidentes con personas lesionadas, registra el caso de inmediato para activar la derivación médica oportuna.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="login-form-panel">
            <div className="form-header">
              <h1>Iniciar Sesión</h1>
              <p>Accede con tus credenciales institucionales</p>
            </div>

            <form onSubmit={manejarLogin} className="login-form">
              <div className="field-group">
                <label htmlFor="email-login">Correo electrónico</label>
                <input
                  id="email-login"
                  type="email"
                  className="input-modern"
                  required
                  autoComplete="email"
                  placeholder="usuario@institucion.gob.pe"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label htmlFor="pass-login">Contraseña</label>
                <div className="password-wrapper">
                  <input
                    id="pass-login"
                    type={mostrarPass ? 'text' : 'password'}
                    className="input-modern"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-toggle-pass"
                    aria-label={mostrarPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setMostrarPass(!mostrarPass)}
                  >
                    {mostrarPass ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              {errorLogin && (
                <div role="alert" className="alert-box alert-error">
                  {errorLogin}
                </div>
              )}

              <button type="submit" className="btn-gradient-pro" disabled={cargandoAuth}>
                {cargandoAuth ? 'Guardando...' : 'Ingresar al Sistema'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // INDICADORES GRÁFICOS EN TIEMPO REAL
  // =========================================================
  const permisos = obtenerPermisosUsuario(usuario);

  const totalDenuncias = denuncias.length;
  const countInvestigacion = denuncias.filter((d) => d.estado === 'En investigación').length;
  const countAceptadas = denuncias.filter((d) => d.estado === 'Aceptado').length;
  const countDerivadas = denuncias.filter((d) => d.estado === 'Derivado').length;
  const countRechazadas = denuncias.filter((d) => d.estado === 'Rechazado').length;

  const todasLasDerivadasSalud = denuncias.filter((d) => d.estado === 'Derivado');
  const citasPendientesConfirmar = citas.filter((c) => c.estado !== 'Confirmada');

  const denunciasFiltradasPnp =
    filtroEstadoPnp === 'Todos'
      ? denuncias
      : denuncias.filter((d) => d.estado === filtroEstadoPnp);

  const rankingSeguridad = Object.values(
    denuncias.reduce((acc, d) => {
      const nombre = d.nombre_comerciante || 'Comerciante';
      if (!acc[nombre]) {
        acc[nombre] = {
          comerciante: nombre,
          puesto: d.puesto,
          total: 0,
          lesionados: 0,
          derivadas: 0,
          ultimoEstado: d.estado,
        };
      }
      acc[nombre].total += 1;
      if (d.hay_lesionados) acc[nombre].lesionados += 1;
      if (d.estado === 'Derivado') acc[nombre].derivadas += 1;
      acc[nombre].ultimoEstado = d.estado;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  // UX-5: Ruta visible explícita (App > Página)
  const nombreAppActual =
    appActiva === 'mercado'
      ? 'Mercado Mayorista'
      : appActiva === 'pnp'
      ? 'Central PNP'
      : 'EsSalud Norte';

  const nombrePaginaActual =
    appActiva === 'mercado'
      ? permisos.mercado === 'cliente'
        ? 'Mi Puesto'
        : 'Seguridad e Inventario'
      : appActiva === 'pnp'
      ? 'Denuncias Digitales'
      : 'Atención Hospitalaria';

  return (
    <div className="app-shell">
      {/* MENÚ LATERAL (UX-1 y UX-5) */}
      <aside className="sidebar-modern" aria-label="Menú principal de aplicaciones">
        <div>
          <div className="brand-header">
            <div className="brand-logo">
              <span className="logo-badge" aria-hidden="true">🛡️</span> Red Ciudadana
            </div>
            <div className="user-card-sidebar">
              <div className="user-avatar" aria-hidden="true">
                {usuario.nombre?.charAt(0).toUpperCase()}
              </div>
              <div className="user-meta">
                <strong>{usuario.nombre}</strong>
                <span>{usuario.email}</span>
              </div>
            </div>
          </div>

          <div className="nav-label">Apps de Mi Rol</div>

          <nav className="nav-list-modern">
            {permisos.mercado && (
              <button
                type="button"
                aria-current={appActiva === 'mercado' ? 'page' : undefined}
                onClick={() => setAppActiva('mercado')}
                className={`nav-link-btn ${appActiva === 'mercado' ? 'active' : ''}`}
              >
                <span>🏪 Mercado Mayorista</span>
                <span className="role-chip">{permisos.mercado === 'cliente' ? 'Mi Puesto' : 'Admin'}</span>
              </button>
            )}

            {permisos.pnp && (
              <button
                type="button"
                aria-current={appActiva === 'pnp' ? 'page' : undefined}
                onClick={() => setAppActiva('pnp')}
                className={`nav-link-btn ${appActiva === 'pnp' ? 'active' : ''}`}
              >
                <span>🚓 Central PNP</span>
                <span className="role-chip">{totalDenuncias}</span>
              </button>
            )}

            {permisos.essalud && (
              <button
                type="button"
                aria-current={appActiva === 'essalud' ? 'page' : undefined}
                onClick={() => setAppActiva('essalud')}
                className={`nav-link-btn ${appActiva === 'essalud' ? 'active' : ''}`}
              >
                <span>🏥 EsSalud Norte</span>
                <span className="role-chip">{citas.length}</span>
              </button>
            )}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            onClick={cargarDatosReales}
            className="btn-sync-clean"
            disabled={sincronizando}
          >
            <span className={`pulse-dot ${sincronizando ? 'spinning' : ''}`}></span>
            {sincronizando ? 'Sincronizando...' : 'Actualizar datos'}
          </button>

          <button type="button" onClick={cerrarSesion} className="btn-logout-modern">
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ÁREA DE TRABAJO */}
      <main className="workspace-area">
        {/* UX-5 (Ruta App > Página) + UX-4 (Leyenda de estados) */}
        <div className="top-context-bar">
          <nav className="breadcrumb-modern" aria-label="Ubicación actual">
            <span className="crumb-app">{nombreAppActual}</span>
            <span className="crumb-sep" aria-hidden="true"></span>
            <strong className="crumb-page">{nombrePaginaActual}</strong>
          </nav>

          <div className="legend-bar" aria-label="Leyenda de estados">
            <span className="legend-title">Leyenda de estados:</span>
            <span className="badge badge-registered">registrado</span>
            <span className="badge badge-process">en proceso / derivado</span>
            <span className="badge badge-approved">aprobado / atendido / pagado</span>
            <span className="badge badge-rejected">rechazado</span>
          </div>
        </div>

        {/* UX-3: Mensaje de éxito con código de seguimiento */}
        {alerta.texto && (
          <div
            role="status"
            aria-live="polite"
            className={`alert-box ${alerta.tipo === 'error' ? 'alert-error' : 'alert-ok'} animate-pop`}
          >
            <div>
              <strong>{alerta.tipo === 'error' ? 'Atención:' : '✅ Operación exitosa:'}</strong> {alerta.texto}
            </div>
            {alerta.codigo && <span className="tracking-code-pill">Código: {alerta.codigo}</span>}
          </div>
        )}
        {/* =========================================================
            1. COMERCIANTE: «MI PUESTO»
            ========================================================= */}
        {appActiva === 'mercado' && permisos.mercado === 'cliente' && (
          <div className="view-transition">
            <div className="page-header">
              <div>
                <h1>🏪 Mi Puesto (Puesto A-14)</h1>
                <p>Comerciante: <strong>{usuario.nombre}</strong> · Mis denuncias y citas médicas</p>
              </div>
              <button type="button" onClick={irADenunciarDesdePuesto} className="btn-danger-modern">
                🚨 Denunciar robo en mi puesto
              </button>
            </div>

            <div className="kpi-grid">
              <div className="kpi-box stagger-1">
                <span className="kpi-title">Mis Denuncias</span>
                <strong className="kpi-num">{totalDenuncias}</strong>
                <div className="kpi-bar"><div className="kpi-fill" style={{ width: totalDenuncias ? '100%' : '8%' }}></div></div>
              </div>
              <div className="kpi-box stagger-2">
                <span className="kpi-title">En Proceso / Derivadas</span>
                <strong className="kpi-num">{countInvestigacion + countDerivadas}</strong>
                <div className="kpi-bar"><div className="kpi-fill process" style={{ width: totalDenuncias ? `${((countInvestigacion + countDerivadas) / totalDenuncias) * 100}%` : '8%' }}></div></div>
              </div>
              <div className="kpi-box stagger-3">
                <span className="kpi-title">Mis Citas Médicas</span>
                <strong className="kpi-num">{citas.length}</strong>
                <div className="kpi-bar"><div className="kpi-fill approved" style={{ width: citas.length ? '100%' : '8%' }}></div></div>
              </div>
            </div>

            <div className="grid-2-cols">
              <div className="glass-card stagger-1">
                <div className="card-header-flex">
                  <h3>📋 Mis Denuncias en PNP ({totalDenuncias})</h3>
                </div>
                {denuncias.length === 0 ? (
                  <div className="empty-state">No tienes denuncias registradas todavía.</div>
                ) : (
                  <div className="case-cards-stack">
                    {denuncias.map((d) => {
                      const paso = obtenerPasoFlujo(d);
                      const colorEstado = obtenerClaseEstado(d.estado);
                      const citaVinculada = citas.find((c) => c.codigo_denuncia === d.codigo);

                      return (
                        <div key={d.codigo} className={`case-card border-${colorEstado}`}>
                          <div className="case-card-top">
                            <div>
                              <span className="case-code">{d.codigo} · {d.puesto}</span>
                              <h4>{d.tipo_incidente}</h4>
                            </div>
                            <span className={`badge badge-${colorEstado}`}>{d.estado}</span>
                          </div>
                          <p className="case-desc">{d.descripcion}</p>

                          <div className="flow-stepper">
                            <div className={`step-node ${paso >= 1 ? 'done' : ''}`}>
                              <span>1</span> Recepción PNP
                            </div>
                            <div className={`step-line ${paso >= 2 ? 'done' : ''}`}></div>
                            <div className={`step-node ${paso >= 2 ? 'done' : ''}`}>
                              <span>2</span> {d.estado}
                            </div>
                            <div className={`step-line ${paso >= 3 ? 'done' : ''}`}></div>
                            <div className={`step-node ${paso >= 3 ? 'done' : ''}`}>
                              <span>3</span> {citaVinculada ? `Cita ${citaVinculada.codigo_cita}` : 'Atención Médica'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="glass-card stagger-2">
                <div className="card-header-flex">
                  <h3>🏥 Mis Citas Médicas en EsSalud ({citas.length})</h3>
                </div>
                {citas.length === 0 ? (
                  <div className="empty-state">Aún no tienes citas médicas derivadas desde la PNP.</div>
                ) : (
                  <div className="case-cards-stack">
                    {citas.map((c) => (
                      <div key={c.codigo_cita} className={`case-card border-${obtenerClaseEstado(c.estado)}`}>
                        <div className="case-card-top">
                          <div>
                            <span className="case-code">{c.codigo_cita} · Denuncia {c.codigo_denuncia}</span>
                            <h4>{c.especialidad}</h4>
                          </div>
                          <span className={`badge badge-${obtenerClaseEstado(c.estado)}`}>
                            {c.estado}
                          </span>
                        </div>
                        <div className="case-meta-row">
                          <span>📅 Horario: <strong>{c.fecha_cita}</strong></span>
                          <span>🏥 EsSalud Norte Chico</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            2. ADMINISTRADOR DEL MERCADO
            ========================================================= */}
        {appActiva === 'mercado' && permisos.mercado === 'administrador' && (
          <div className="view-transition">
            <div className="page-header">
              <div>
                <h1>🏢 Administración del Mercado Mayorista</h1>
                <p>Monitoreo de denuncias por comerciante para refuerzo de seguridad e inventario</p>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-box stagger-1">
                <span className="kpi-title">Denuncias Totales</span>
                <strong className="kpi-num">{totalDenuncias}</strong>
                <div className="kpi-bar"><div className="kpi-fill process" style={{ width: '100%' }}></div></div>
              </div>
              <div className="kpi-box stagger-2">
                <span className="kpi-title">Comerciantes Afectados</span>
                <strong className="kpi-num">{rankingSeguridad.length}</strong>
                <div className="kpi-bar"><div className="kpi-fill rejected" style={{ width: '100%' }}></div></div>
              </div>
              <div className="kpi-box stagger-3">
                <span className="kpi-title">Derivadas a EsSalud</span>
                <strong className="kpi-num">{countDerivadas}</strong>
                <div className="kpi-bar"><div className="kpi-fill process" style={{ width: '100%' }}></div></div>
              </div>
              <div className="kpi-box stagger-3">
                <span className="kpi-title">Productos Activos</span>
                <strong className="kpi-num">{productos.length}</strong>
                <div className="kpi-bar"><div className="kpi-fill approved" style={{ width: '100%' }}></div></div>
              </div>
            </div>

            <div className="glass-card stagger-1" style={{ marginBottom: '24px' }}>
              <div className="card-header-flex">
                <h3>🛡️ Denuncias por Comerciante · Refuerzo de Seguridad</h3>
                <span className="badge badge-rejected">{rankingSeguridad.length} comerciantes registrados</span>
              </div>
              {rankingSeguridad.length === 0 ? (
                <div className="empty-state">No hay denuncias registradas por comerciante todavía.</div>
              ) : (
                <div className="case-cards-stack">
                  {rankingSeguridad.map((r, idx) => (
                    <div key={idx} className="case-card border-rejected">
                      <div className="case-card-top">
                        <div>
                          <span className="case-code">
                            {r.puesto} · Nivel de Vigilancia: {r.total >= 2 ? 'Refuerzo Alto' : 'Vigilancia Activa'}
                          </span>
                          <h4>{r.comerciante}</h4>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="badge badge-rejected">
                            {r.total} {r.total === 1 ? 'denuncia' : 'denuncias'}
                          </span>
                          {r.lesionados > 0 && (
                            <span className="badge badge-process">{r.lesionados} con lesionados</span>
                          )}
                          <span className={`badge badge-${obtenerClaseEstado(r.ultimoEstado)}`}>
                            Último: {r.ultimoEstado}
                          </span>
                        </div>
                      </div>
                      <div className="kpi-bar" style={{ marginTop: '8px' }}>
                        <div
                          className="kpi-fill rejected"
                          style={{ width: `${Math.min(100, (r.total / Math.max(1, totalDenuncias)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid-split">
              <div className="glass-card">
                <div className="card-header-flex">
                  <h3>{editandoProdId ? '✏️ Editar Producto' : '➕ Registrar Producto'}</h3>
                </div>
                <form onSubmit={guardarProducto}>
                  <div className="field-group">
                    <label htmlFor="prod-nombre">Nombre del producto</label>
                    <input
                      id="prod-nombre"
                      className="input-modern"
                      required
                      value={formProd.nombre}
                      onChange={(e) => setFormProd({ ...formProd, nombre: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="prod-desc">Descripción</label>
                    <input
                      id="prod-desc"
                      className="input-modern"
                      value={formProd.descripcion}
                      onChange={(e) => setFormProd({ ...formProd, descripcion: e.target.value })}
                    />
                  </div>
                  <div className="grid-2-inputs">
                    <div className="field-group">
                      <label htmlFor="prod-precio">Precio (S/)</label>
                      <input
                        id="prod-precio"
                        type="number"
                        step="0.01"
                        className="input-modern"
                        required
                        value={formProd.precio}
                        onChange={(e) => setFormProd({ ...formProd, precio: e.target.value })}
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="prod-stock">Stock</label>
                      <input
                        id="prod-stock"
                        type="number"
                        className="input-modern"
                        required
                        value={formProd.stock}
                        onChange={(e) => setFormProd({ ...formProd, stock: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-gradient-pro" disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Guardar Producto'}
                  </button>
                </form>
              </div>

              <div className="glass-card">
                <div className="card-header-flex">
                  <h3>📦 Catálogo del Mercado ({productos.length})</h3>
                </div>
                {productos.length === 0 ? (
                  <div className="empty-state">No hay productos registrados todavía.</div>
                ) : (
                  <div className="table-responsive-wrap">
                    <table className="table-modern">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Precio</th>
                          <th>Stock</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.map((p) => (
                          <tr key={p.id}>
                            <td><strong>{p.nombre}</strong></td>
                            <td>S/ {Number(p.precio).toFixed(2)}</td>
                            <td><span className="badge badge-approved">{p.stock} u.</span></td>
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditandoProdId(p.id);
                                  setFormProd({
                                    nombre: p.nombre,
                                    descripcion: p.descripcion || '',
                                    precio: p.precio,
                                    stock: p.stock,
                                  });
                                }}
                                className="btn-chip"
                                style={{ marginRight: '6px' }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminarProducto(p.id)}
                                className="btn-chip danger"
                              >
                                Borrar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            3. CENTRAL PNP
            ========================================================= */}
        {appActiva === 'pnp' && (
          <div className="view-transition">
            <div className="page-header">
              <div>
                <h1>🚓 Central de Emergencias PNP</h1>
                <p>Recepción de denuncias policiales, evaluación y derivación directa a EsSalud</p>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-box stagger-1">
                <span className="kpi-title">Total Denuncias</span>
                <strong className="kpi-num">{totalDenuncias}</strong>
                <div className="kpi-bar"><div className="kpi-fill" style={{ width: totalDenuncias ? '100%' : '8%' }}></div></div>
              </div>
              <div className="kpi-box stagger-1">
                <span className="kpi-title">En Investigación</span>
                <strong className="kpi-num">{countInvestigacion}</strong>
                <div className="kpi-bar"><div className="kpi-fill process" style={{ width: totalDenuncias ? `${(countInvestigacion / totalDenuncias) * 100}%` : '8%' }}></div></div>
              </div>
              <div className="kpi-box stagger-2">
                <span className="kpi-title">Aceptadas</span>
                <strong className="kpi-num">{countAceptadas}</strong>
                <div className="kpi-bar"><div className="kpi-fill approved" style={{ width: totalDenuncias ? `${(countAceptadas / totalDenuncias) * 100}%` : '8%' }}></div></div>
              </div>
              <div className="kpi-box stagger-2">
                <span className="kpi-title">Derivadas a EsSalud</span>
                <strong className="kpi-num">{countDerivadas}</strong>
                <div className="kpi-bar"><div className="kpi-fill process" style={{ width: totalDenuncias ? `${(countDerivadas / totalDenuncias) * 100}%` : '8%' }}></div></div>
              </div>
              <div className="kpi-box stagger-3">
                <span className="kpi-title">Rechazadas</span>
                <strong className="kpi-num">{countRechazadas}</strong>
                <div className="kpi-bar"><div className="kpi-fill rejected" style={{ width: totalDenuncias ? `${(countRechazadas / totalDenuncias) * 100}%` : '8%' }}></div></div>
              </div>
            </div>

            <div className="grid-split">
              <div className="glass-card stagger-1">
                <div className="card-header-flex">
                  <h3>📝 Registrar Denuncia</h3>
                  {precargaPnp && <span className="badge badge-approved">Datos Precargados</span>}
                </div>
                <form onSubmit={registrarDenuncia}>
                  <div className="field-group">
                    <label htmlFor="den-agraviado">Comerciante Agraviado</label>
                    <input
                      id="den-agraviado"
                      className={`input-modern ${permisos.pnp === 'cliente' ? 'readonly' : ''}`}
                      required
                      readOnly={permisos.pnp === 'cliente'}
                      placeholder="Nombre del comerciante agraviado"
                      value={
                        permisos.pnp === 'cliente'
                          ? precargaPnp?.nombre_comerciante || usuario.nombre
                          : formDenuncia.nombre_comerciante
                      }
                      onChange={(e) =>
                        setFormDenuncia({ ...formDenuncia, nombre_comerciante: e.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="den-puesto">Puesto</label>
                    <input
                      id="den-puesto"
                      className={`input-modern ${permisos.pnp === 'cliente' ? 'readonly' : ''}`}
                      required
                      readOnly={permisos.pnp === 'cliente'}
                      value={precargaPnp?.puesto || formDenuncia.puesto}
                      onChange={(e) => setFormDenuncia({ ...formDenuncia, puesto: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="den-tipo">Tipo de Incidente</label>
                    <select
                      id="den-tipo"
                      className="input-modern"
                      value={formDenuncia.tipo_incidente}
                      onChange={(e) => setFormDenuncia({ ...formDenuncia, tipo_incidente: e.target.value })}
                    >
                      <option value="Robo agravado en puesto">Robo agravado en puesto</option>
                      <option value="Hurto de mercadería">Hurto de mercadería</option>
                      <option value="Agresión con lesiones">Agresión con lesiones</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="den-desc">Descripción de los hechos</label>
                    <textarea
                      id="den-desc"
                      rows="3"
                      className="input-modern"
                      required
                      placeholder="Detalla lo ocurrido..."
                      value={formDenuncia.descripcion}
                      onChange={(e) => setFormDenuncia({ ...formDenuncia, descripcion: e.target.value })}
                    />
                  </div>
                  <div className="checkbox-modern">
                    <input
                      id="chk-lesionados"
                      type="checkbox"
                      checked={formDenuncia.hay_lesionados}
                      onChange={(e) => setFormDenuncia({ ...formDenuncia, hay_lesionados: e.target.checked })}
                    />
                    <label htmlFor="chk-lesionados">Reportar personas lesionadas (requiere cita médica)</label>
                  </div>
                  <button type="submit" className="btn-gradient-pro" disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Registrar Denuncia'}
                  </button>
                </form>
              </div>

              <div className="glass-card stagger-2">
                <div className="card-header-flex" style={{ flexWrap: 'wrap', gap: '10px' }}>
                  <h3>📂 Denuncias Registradas ({denunciasFiltradasPnp.length})</h3>
                  <div className="filter-pills-row" role="group" aria-label="Filtrar denuncias por estado">
                    {['Todos', 'En investigación', 'Aceptado', 'Derivado', 'Rechazado'].map((est) => (
                      <button
                        key={est}
                        type="button"
                        onClick={() => setFiltroEstadoPnp(est)}
                        className={`filter-pill ${filtroEstadoPnp === est ? 'active' : ''}`}
                      >
                        {est}
                      </button>
                    ))}
                  </div>
                </div>

                {denunciasFiltradasPnp.length === 0 ? (
                  <div className="empty-state">No hay denuncias registradas en esta vista todavía.</div>
                ) : (
                  <div className="case-cards-stack">
                    {denunciasFiltradasPnp.map((d) => {
                      const colorEstado = obtenerClaseEstado(d.estado);
                      const paso = obtenerPasoFlujo(d);
                      const citaVinculada = citas.find((c) => c.codigo_denuncia === d.codigo);
                      const selectId = `estado-${d.codigo}`;

                      return (
                        <div
                          key={d.codigo}
                          className={`case-card border-${colorEstado} ${
                            ultimoCodigoCreado === d.codigo ? 'highlight-new' : ''
                          }`}
                        >
                          <div className="case-card-top">
                            <div>
                              <span className="case-code">{d.codigo} · {d.puesto}</span>
                              <h4>
                                {d.nombre_comerciante} — <span className="text-normal">{d.tipo_incidente}</span>
                              </h4>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {d.hay_lesionados && <span className="badge badge-rejected">🚑 Con Lesionados</span>}
                              <span className={`badge badge-${colorEstado}`}>{d.estado}</span>
                            </div>
                          </div>

                          <p className="case-desc">{d.descripcion}</p>

                          <div className="flow-stepper">
                            <div className={`step-node ${paso >= 1 ? 'done' : ''}`}>
                              <span>1</span> Registrada
                            </div>
                            <div className={`step-line ${paso >= 2 ? 'done' : ''}`}></div>
                            <div className={`step-node ${paso >= 2 ? 'done' : ''}`}>
                              <span>2</span> {d.estado}
                            </div>
                            <div className={`step-line ${paso >= 3 ? 'done' : ''}`}></div>
                            <div className={`step-node ${paso >= 3 ? 'done' : ''}`}>
                              <span>3</span>{' '}
                              {citaVinculada
                                ? `Cita ${citaVinculada.codigo_cita} (${citaVinculada.estado})`
                                : 'Sin derivación médica'}
                            </div>
                          </div>

                          {permisos.pnp === 'empleado' && (
                            <div className="case-actions-bar">
                              <div className="status-selector-group">
                                <label htmlFor={selectId}>Estado:</label>
                                <select
                                  id={selectId}
                                  className="select-status"
                                  value={d.estado}
                                  onChange={(e) => cambiarEstadoDenuncia(d, e.target.value)}
                                >
                                  <option value="En investigación">En investigación</option>
                                  <option value="Aceptado">Aceptado</option>
                                  <option value="Rechazado">Rechazado</option>
                                  <option value="Derivado">Derivado</option>
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => derivarDenunciaASalud(d)}
                                className="btn-gradient-pro btn-xs"
                                style={{ width: 'auto' }}
                              >
                                🏥 Derivar a EsSalud
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            4. ESSALUD NORTE CHICO
            ========================================================= */}
        {appActiva === 'essalud' && (
          <div className="view-transition">
            <div className="page-header">
              <div>
                <h1>🏥 EsSalud Norte Chico · Panel Hospitalario</h1>
                <p>Recepción de casos derivados por la PNP y gestión de citas médicas</p>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-box stagger-1">
                <span className="kpi-title">Derivadas desde PNP</span>
                <strong className="kpi-num">{todasLasDerivadasSalud.length}</strong>
                <div className="kpi-bar"><div className="kpi-fill process" style={{ width: todasLasDerivadasSalud.length ? '100%' : '8%' }}></div></div>
              </div>
              <div className="kpi-box stagger-2">
                <span className="kpi-title">Pendientes de Confirmar</span>
                <strong className="kpi-num">{citasPendientesConfirmar.length}</strong>
                <div className="kpi-bar"><div className="kpi-fill process" style={{ width: citas.length ? `${(citasPendientesConfirmar.length / citas.length) * 100}%` : '8%' }}></div></div>
              </div>
              <div className="kpi-box stagger-3">
                <span className="kpi-title">Citas Totales</span>
                <strong className="kpi-num">{citas.length}</strong>
                <div className="kpi-bar"><div className="kpi-fill approved" style={{ width: citas.length ? '100%' : '8%' }}></div></div>
              </div>
            </div>

            <div className="glass-card alert-panel-salud stagger-1" style={{ marginBottom: '24px' }}>
              <div className="card-header-flex">
                <h3>🚑 Casos Derivados desde PNP ({todasLasDerivadasSalud.length})</h3>
                <span className="badge badge-process">En proceso / derivado</span>
              </div>

              {todasLasDerivadasSalud.length === 0 ? (
                <div className="empty-state">No hay denuncias derivadas a EsSalud todavía.</div>
              ) : (
                <div className="case-cards-grid">
                  {todasLasDerivadasSalud.map((d) => {
                    const citaAsignada = citas.find((c) => c.codigo_denuncia === d.codigo);

                    return (
                      <div key={d.codigo} className={`case-card ${citaAsignada?.estado === 'Confirmada' ? 'border-approved' : 'border-process'}`}>
                        <div className="case-card-top">
                          <div>
                            <span className="case-code">{d.codigo} · {d.puesto}</span>
                            <h4>{d.nombre_comerciante}</h4>
                          </div>
                          <span className={`badge ${citaAsignada?.estado === 'Confirmada' ? 'badge-approved' : 'badge-process'}`}>
                            {citaAsignada ? `${citaAsignada.codigo_cita} · ${citaAsignada.estado}` : 'Derivado PNP'}
                          </span>
                        </div>
                        <p className="case-desc">
                          <strong>{d.tipo_incidente}:</strong> {d.descripcion}
                        </p>

                        {permisos.essalud === 'empleado' && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormCita({
                                id_denuncia: d.id,
                                codigo_denuncia: d.codigo,
                                id_comerciante: d.id_comerciante,
                                agraviado: d.nombre_comerciante,
                                especialidad: citaAsignada?.especialidad || 'Medicina General / Emergencias',
                                fecha_cita: '',
                              });
                              setPrecargaSaludActiva(true);
                            }}
                            className="btn-gradient-pro btn-xs"
                          >
                            📅 {citaAsignada?.estado === 'Confirmada' ? 'Reprogramar Turno' : 'Asignar Fecha y Confirmar'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid-split">
              {permisos.essalud === 'empleado' && (
                <div className="glass-card stagger-2">
                  <div className="card-header-flex">
                    <h3>📅 Programar / Confirmar Cita</h3>
                    {precargaSaludActiva && formCita.codigo_denuncia && (
                      <span className="badge badge-approved">Precargado: {formCita.codigo_denuncia}</span>
                    )}
                  </div>
                  <form onSubmit={registrarCitaSalud}>
                    <div className="field-group">
                      <label htmlFor="cita-denuncia">Denuncia Derivada</label>
                      <select
                        id="cita-denuncia"
                        className="input-modern"
                        required
                        value={formCita.codigo_denuncia}
                        onChange={(e) => {
                          const den = denuncias.find((item) => item.codigo === e.target.value);
                          setFormCita({
                            ...formCita,
                            id_denuncia: den?.id || '',
                            codigo_denuncia: e.target.value,
                            id_comerciante: den?.id_comerciante || '',
                            agraviado: den?.nombre_comerciante || '',
                          });
                        }}
                      >
                        <option value="">-- Selecciona caso derivado --</option>
                        {todasLasDerivadasSalud.map((d) => (
                          <option key={d.codigo} value={d.codigo}>
                            {d.codigo} - {d.nombre_comerciante} ({d.puesto})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label htmlFor="cita-agraviado">Paciente / Agraviado</label>
                      <input
                        id="cita-agraviado"
                        className="input-modern readonly"
                        required
                        readOnly
                        value={formCita.agraviado}
                      />
                    </div>

                    <div className="field-group">
                      <label htmlFor="cita-especialidad">Especialidad Médica</label>
                      <select
                        id="cita-especialidad"
                        className="input-modern"
                        value={formCita.especialidad}
                        onChange={(e) => setFormCita({ ...formCita, especialidad: e.target.value })}
                      >
                        <option value="Medicina General / Emergencias">Medicina General / Emergencias</option>
                        <option value="Traumatología">Traumatología</option>
                        <option value="Cirugía Menor">Cirugía Menor</option>
                      </select>
                    </div>

                    <div className="field-group">
                      <label htmlFor="cita-fecha">Fecha y Hora de Atención</label>
                      <input
                        id="cita-fecha"
                        type="datetime-local"
                        className="input-modern"
                        required
                        value={formCita.fecha_cita}
                        onChange={(e) => setFormCita({ ...formCita, fecha_cita: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="btn-gradient-pro" disabled={guardando}>
                      {guardando ? 'Guardando...' : 'Confirmar Cita Médica'}
                    </button>
                  </form>
                </div>
              )}

              <div className="glass-card stagger-3" style={{ gridColumn: permisos.essalud === 'empleado' ? 'auto' : '1 / -1' }}>
                <div className="card-header-flex">
                  <h3>🩺 Citas Médicas Registradas ({citas.length})</h3>
                </div>
                {citas.length === 0 ? (
                  <div className="empty-state">No hay citas médicas registradas todavía.</div>
                ) : (
                  <div className="case-cards-stack">
                    {citas.map((c) => (
                      <div
                        key={c.codigo_cita}
                        className={`case-card border-${obtenerClaseEstado(c.estado)} ${
                          ultimoCodigoCreado === c.codigo_cita ? 'highlight-new' : ''
                        }`}
                      >
                        <div className="case-card-top">
                          <div>
                            <span className="case-code">
                              {c.codigo_cita} · Denuncia {c.codigo_denuncia}
                            </span>
                            <h4>{c.agraviado}</h4>
                          </div>
                          <span className={`badge badge-${obtenerClaseEstado(c.estado)}`}>
                            {c.estado}
                          </span>
                        </div>
                        <div className="case-meta-row">
                          <span>🩺 Especialidad: <strong>{c.especialidad}</strong></span>
                          <span>📅 Horario: <strong>{c.fecha_cita}</strong></span>
                        </div>
                        {permisos.essalud === 'empleado' && c.estado !== 'Confirmada' && (
                          <div style={{ marginTop: '10px' }}>
                            <button
                              type="button"
                              onClick={() => confirmarCitaExistente(c)}
                              className="btn-gradient-pro btn-xs"
                              style={{ width: 'auto' }}
                            >
                              ✅ Confirmar Atención
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}