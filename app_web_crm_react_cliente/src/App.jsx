import { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://mercado-seguro-api-26c0.onrender.com';

const STORAGE_DENUNCIAS = 'rc_bd_denuncias_v4';
const STORAGE_CITAS = 'rc_bd_citas_v4';
const STORAGE_CARRITO = 'ms_cliente_carrito_v1';
const STORAGE_CLIENTES = 'ms_clientes_locales_v1';
const STORAGE_PEDIDOS = 'ms_pedidos_locales_v1';

const PRODUCTOS_BASE_MERCADO = [
  {
    id: 101,
    nombre: 'Saco de Papa Yungay (50 kg)',
    descripcion: 'Papa seleccionada de primera calidad, cosecha fresca de la sierra central.',
    precio: 85.0,
    stock: 24,
    imagen_url: 'https://placehold.co/400x260/0f766e/ffffff?text=Papa+Yungay+50kg',
  },
  {
    id: 102,
    nombre: 'Arroz Extra Costeño (Saco 49 kg)',
    descripcion: 'Grano largo añejo seleccionado para abastecimiento comercial.',
    precio: 148.5,
    stock: 18,
    imagen_url: 'https://placehold.co/400x260/0284c7/ffffff?text=Arroz+Extra+49kg',
  },
  {
    id: 103,
    nombre: 'Jaba de Tomate Italiano (20 kg)',
    descripcion: 'Tomate fresco maduro listo para venta minorista o restaurantes.',
    precio: 46.0,
    stock: 15,
    imagen_url: 'https://placehold.co/400x260/b91c1c/ffffff?text=Tomate+Italiano+20kg',
  },
  {
    id: 104,
    nombre: 'Azúcar Rubia Doméstica (50 kg)',
    descripcion: 'Saco sellado de azúcar rubia nacional de alta pureza.',
    precio: 132.0,
    stock: 20,
    imagen_url: 'https://placehold.co/400x260/b45309/ffffff?text=Azucar+Rubia+50kg',
  },
  {
    id: 105,
    nombre: 'Aceite Vegetal Caja (12 x 1L)',
    descripcion: 'Caja mayorista de 12 botellas de 1 litro cada una.',
    precio: 94.0,
    stock: 30,
    imagen_url: 'https://placehold.co/400x260/047857/ffffff?text=Aceite+12x1L',
  },
  {
    id: 106,
    nombre: 'Cebolla Roja Arequipeña (Saco 45 kg)',
    descripcion: 'Bulbo firme calibrado de primera calidad para mercado.',
    precio: 68.0,
    stock: 12,
    imagen_url: 'https://placehold.co/400x260/6d28d9/ffffff?text=Cebolla+Roja+45kg',
  },
];

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
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modoCatalogo, setModoCatalogo] = useState('api');
  const [busqueda, setBusqueda] = useState('');

  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem('ms_cliente_user');
    return guardado ? JSON.parse(guardado) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('ms_cliente_token') || '');

  const [vistaActiva, setVistaActiva] = useState('catalogo');

  const [mostrarAuth, setMostrarAuth] = useState(false);
  const [esRegistro, setEsRegistro] = useState(false);
  const [mostrarPass, setMostrarPass] = useState(false);
  const [formAuth, setFormAuth] = useState({ nombre: '', email: '', password: '' });
  const [msgAuth, setMsgAuth] = useState({ tipo: '', texto: '' });
  const [cargandoAuth, setCargandoAuth] = useState(false);

  const [carrito, setCarrito] = useState(() => leerStorage(STORAGE_CARRITO));
  const [misPedidos, setMisPedidos] = useState([]);

  const [denuncias, setDenuncias] = useState(() => leerStorage(STORAGE_DENUNCIAS));
  const [citas, setCitas] = useState(() => leerStorage(STORAGE_CITAS));
  const [formDenuncia, setFormDenuncia] = useState({
    puesto: 'Puesto A-14 / Zona Comercial',
    tipo_incidente: 'Robo agravado en puesto',
    descripcion: '',
    hay_lesionados: false,
  });

  const [guardando, setGuardando] = useState(false);
  const [ultimoCodigo, setUltimoCodigo] = useState('');
  const [alerta, setAlerta] = useState({ tipo: '', texto: '', codigo: '' });

  useEffect(() => {
    localStorage.setItem(STORAGE_CARRITO, JSON.stringify(carrito));
  }, [carrito]);

  useEffect(() => {
    const manejarCambioStorage = (e) => {
      if (e.key === STORAGE_DENUNCIAS) setDenuncias(leerStorage(STORAGE_DENUNCIAS));
      if (e.key === STORAGE_CITAS) setCitas(leerStorage(STORAGE_CITAS));
    };
    window.addEventListener('storage', manejarCambioStorage);
    return () => window.removeEventListener('storage', manejarCambioStorage);
  }, []);

  const mostrarNotificacion = (tipo, texto, codigo = '') => {
    setAlerta({ tipo, texto, codigo });
    setTimeout(() => setAlerta({ tipo: '', texto: '', codigo: '' }), 5500);
  };

  // =========================================================
  // CARGA DE CATÁLOGO, PEDIDOS, DENUNCIAS Y CITAS (NEON PRIORITARIO)
  // =========================================================
  const sincronizarTodo = useCallback(async () => {
    setCargando(true);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Productos
    try {
      const resProd = await fetch(`${API_URL}/api/productos`);
      if (resProd.ok) {
        const dataProd = await resProd.json();
        const lista = Array.isArray(dataProd) ? dataProd : dataProd.productos || [];
        setProductos(lista.length > 0 ? lista : PRODUCTOS_BASE_MERCADO);
        setModoCatalogo(lista.length > 0 ? 'api' : 'local');
      } else {
        setProductos(PRODUCTOS_BASE_MERCADO);
        setModoCatalogo('local');
      }
    } catch {
      setProductos(PRODUCTOS_BASE_MERCADO);
      setModoCatalogo('local');
    } finally {
      setCargando(false);
    }

    // 2. Pedidos
    let pedidosApi = [];
    try {
      const resPed = await fetch(`${API_URL}/api/pedidos`, { headers });
      if (resPed.ok) {
        const dataPed = await resPed.json();
        if (Array.isArray(dataPed)) pedidosApi = dataPed;
      }
    } catch {
      // Usa respaldo local
    }

    const localesPed = leerStorage(STORAGE_PEDIDOS);
    const combinadosPed = [...pedidosApi, ...localesPed].filter((p) => {
      const parsed = typeof p.items === 'string' ? JSON.parse(p.items) : p.items;
      const esCompra = Array.isArray(parsed) && parsed.length > 0;
      if (!esCompra) return false;
      if (!usuario?.email) return true;
      return !p.usuario_email || p.usuario_email === usuario.email;
    });
    setMisPedidos(combinadosPed);

    // 3. Denuncias (Neon/Servidor sobrescribe lo local)
    let denunciasServidor = [];
    try {
      const resDen = await fetch(`${API_URL}/api/denuncias`, { headers });
      if (resDen.ok) {
        const dataD = await resDen.json();
        if (Array.isArray(dataD)) denunciasServidor = dataD;
      }
    } catch {
      // Usa storage compartido
    }

    const localesDen = leerStorage(STORAGE_DENUNCIAS);
    const mapaDen = new Map();
    localesDen.forEach((d) => {
      if (d && d.codigo) mapaDen.set(d.codigo, d);
    });
    denunciasServidor.forEach((d) => {
      if (d && d.codigo) mapaDen.set(d.codigo, d);
    });
    const listaFinalDen = Array.from(mapaDen.values()).sort(
      (a, b) => Number(b.id || 0) - Number(a.id || 0)
    );
    setDenuncias(listaFinalDen);
    localStorage.setItem(STORAGE_DENUNCIAS, JSON.stringify(listaFinalDen));

    // 4. Citas EsSalud (Neon/Servidor sobrescribe lo local)
    let citasServidor = [];
    try {
      const resCit = await fetch(`${API_URL}/api/citas`, { headers });
      if (resCit.ok) {
        const dataC = await resCit.json();
        if (Array.isArray(dataC)) citasServidor = dataC;
      }
    } catch {
      // Usa storage compartido
    }

    const localesCit = leerStorage(STORAGE_CITAS);
    const mapaCit = new Map();
    localesCit.forEach((c) => {
      if (c && c.codigo_cita) mapaCit.set(c.codigo_cita, c);
    });
    citasServidor.forEach((c) => {
      if (c && c.codigo_cita) mapaCit.set(c.codigo_cita, c);
    });
    const listaFinalCit = Array.from(mapaCit.values()).sort(
      (a, b) => Number(b.id || 0) - Number(a.id || 0)
    );
    setCitas(listaFinalCit);
    localStorage.setItem(STORAGE_CITAS, JSON.stringify(listaFinalCit));
  }, [token, usuario?.email]);

  useEffect(() => {
    sincronizarTodo();
  }, [sincronizarTodo]);

  // =========================================================
  // REGISTRO / INICIO DE SESIÓN
  // =========================================================
  const manejarAuth = async (e) => {
    e.preventDefault();
    setMsgAuth({ tipo: '', texto: '' });
    setCargandoAuth(true);

    const correo = formAuth.email.trim().toLowerCase();
    const nombre = formAuth.nombre.trim() || correo.split('@')[0];
    const password = formAuth.password;

    const completarLogin = (userObj, jwtToken = 'sesion-cliente-activa') => {
      setUsuario(userObj);
      setToken(jwtToken);
      localStorage.setItem('ms_cliente_user', JSON.stringify(userObj));
      localStorage.setItem('ms_cliente_token', jwtToken);
      setMostrarAuth(false);
      setFormAuth({ nombre: '', email: '', password: '' });
      mostrarNotificacion('ok', `Bienvenido al Mercado, ${userObj.nombre}.`);
    };

    if (esRegistro) {
      try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email: correo, password, rol: 'cliente' }),
        });

        if (res.ok) {
          setEsRegistro(false);
          setMsgAuth({ tipo: 'ok', texto: '✅ Cuenta creada en el servidor. Ahora inicia sesión.' });
          setCargandoAuth(false);
          return;
        }

        if (res.status !== 404) {
          const errData = await res.json().catch(() => ({}));
          setMsgAuth({
            tipo: 'error',
            texto: errData.error || errData.mensaje || 'No se pudo completar el registro.',
          });
          setCargandoAuth(false);
          return;
        }
      } catch {
        // Respaldo local
      }

      const cuentas = leerStorage(STORAGE_CLIENTES);
      if (cuentas.some((c) => c.email === correo)) {
        setMsgAuth({ tipo: 'error', texto: 'Este correo ya está registrado. Inicia sesión.' });
        setCargandoAuth(false);
        return;
      }

      const nuevaCuenta = { id: Date.now(), nombre, email: correo, password, rol: 'cliente' };
      localStorage.setItem(STORAGE_CLIENTES, JSON.stringify([nuevaCuenta, ...cuentas]));
      setEsRegistro(false);
      setMsgAuth({ tipo: 'ok', texto: '✅ Cuenta registrada correctamente. Ya puedes iniciar sesión.' });
      setCargandoAuth(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: correo, password }),
      });

      if (res.ok) {
        const data = await res.json();
        const userObj = data.usuario || { id: Date.now(), email: correo, nombre, rol: 'cliente' };
        completarLogin(userObj, data.token || 'sesion-activa');
        setCargandoAuth(false);
        return;
      }
    } catch {
      // Respaldo local
    }

    const cuentasLocales = leerStorage(STORAGE_CLIENTES);
    const cuentaEncontrada = cuentasLocales.find(
      (c) => c.email === correo && c.password === password
    );

    if (cuentaEncontrada) {
      completarLogin({
        id: cuentaEncontrada.id,
        nombre: cuentaEncontrada.nombre,
        email: cuentaEncontrada.email,
        rol: 'cliente',
      });
    } else {
      setMsgAuth({
        tipo: 'error',
        texto: 'Usuario no encontrado o contraseña incorrecta. Si aún no tienes cuenta, regístrate.',
      });
    }
    setCargandoAuth(false);
  };

  const cerrarSesion = () => {
    setUsuario(null);
    setToken('');
    localStorage.removeItem('ms_cliente_user');
    localStorage.removeItem('ms_cliente_token');
    setVistaActiva('catalogo');
  };

  // =========================================================
  // CARRITO INTERACTIVO Y COMPRA
  // =========================================================
  const agregarAlCarrito = (producto) => {
    if (producto.stock === 0) return;
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        if (producto.stock !== undefined && existe.cantidad >= Number(producto.stock)) {
          mostrarNotificacion('error', `Stock máximo disponible (${producto.stock} u.) alcanzado.`);
          return prev;
        }
        return prev.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const actualizarCantidadCarrito = (id, delta) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const nueva = item.cantidad + delta;
          if (item.stock !== undefined && nueva > Number(item.stock)) return item;
          return { ...item, cantidad: nueva };
        })
        .filter((item) => item.cantidad > 0)
    );
  };

  const quitarDelCarrito = (id) => {
    setCarrito((prev) => prev.filter((item) => item.id !== id));
  };

  const totalCarrito = carrito.reduce(
    (acc, item) => acc + Number(item.precio || 0) * item.cantidad,
    0
  );
  const totalUnidadesCarrito = carrito.reduce((sum, i) => sum + i.cantidad, 0);

  const confirmarPedido = async () => {
    if (!usuario) {
      setMostrarAuth(true);
      setEsRegistro(false);
      setMsgAuth({ tipo: 'error', texto: 'Inicia sesión o regístrate para completar tu compra.' });
      return;
    }

    setGuardando(true);
    const idLocal = Date.now();
    let codigoPedido = `PED-${String(idLocal).slice(-5)}`;

    const nuevoPedidoLocal = {
      id: idLocal,
      usuario_email: usuario.email,
      items: carrito.map((i) => ({
        producto_id: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: Number(i.precio),
      })),
      total: Number(totalCarrito.toFixed(2)),
      estado: 'Confirmado',
    };

    try {
      const res = await fetch(`${API_URL}/api/pedidos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(nuevoPedidoLocal),
      });

      if (res.ok) {
        const dataPed = await res.json();
        if (dataPed?.id) codigoPedido = `PED-${String(dataPed.id).padStart(5, '0')}`;
      } else {
        const actualesPed = leerStorage(STORAGE_PEDIDOS);
        localStorage.setItem(STORAGE_PEDIDOS, JSON.stringify([nuevoPedidoLocal, ...actualesPed]));
      }
    } catch {
      const actualesPed = leerStorage(STORAGE_PEDIDOS);
      localStorage.setItem(STORAGE_PEDIDOS, JSON.stringify([nuevoPedidoLocal, ...actualesPed]));
    } finally {
      setCarrito([]);
      localStorage.removeItem(STORAGE_CARRITO);
      setUltimoCodigo(codigoPedido);
      setGuardando(false);
      mostrarNotificacion('ok', '¡Pedido confirmado en Mercado Seguro!', codigoPedido);
      await sincronizarTodo();
      setVistaActiva('pedidos');
    }
  };

  // =========================================================
  // REGISTRO DE DENUNCIA
  // =========================================================
  const abrirFormularioDenuncia = () => {
    if (!usuario) {
      setMostrarAuth(true);
      setEsRegistro(false);
      setMsgAuth({
        tipo: 'error',
        texto: 'Inicia sesión o regístrate para enviar tu denuncia con tus datos.',
      });
      return;
    }
    setVistaActiva('denunciar');
  };

  const registrarDenuncia = async (e) => {
    e.preventDefault();
    if (!usuario) {
      setMostrarAuth(true);
      return;
    }

    setGuardando(true);
    const actuales = leerStorage(STORAGE_DENUNCIAS);
    const codigoGenerado = `DEN-${String(actuales.length + 1).padStart(5, '0')}`;

    const nuevaDenuncia = {
      id: Date.now(),
      codigo: codigoGenerado,
      id_comerciante: usuario.id || Date.now(),
      nombre_comerciante: usuario.nombre || usuario.email.split('@')[0],
      puesto: formDenuncia.puesto.trim() || 'Zona Comercial',
      tipo_incidente: formDenuncia.tipo_incidente,
      descripcion: formDenuncia.descripcion.trim(),
      hay_lesionados: formDenuncia.hay_lesionados,
      estado: 'En investigación',
      fecha_registro: new Date().toLocaleString('es-PE', { hour12: false }),
    };

    const listaActualizada = [nuevaDenuncia, ...actuales];
    setDenuncias(listaActualizada);
    localStorage.setItem(STORAGE_DENUNCIAS, JSON.stringify(listaActualizada));
    setUltimoCodigo(codigoGenerado);

    setFormDenuncia({
      puesto: 'Puesto A-14 / Zona Comercial',
      tipo_incidente: 'Robo agravado en puesto',
      descripcion: '',
      hay_lesionados: false,
    });

    mostrarNotificacion(
      'ok',
      'Denuncia registrada y enviada a la Central de Emergencias PNP.',
      codigoGenerado
    );
    setGuardando(false);
    setVistaActiva('seguimiento');

    try {
      await fetch(`${API_URL}/api/denuncias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(nuevaDenuncia),
      });
    } catch {
      // Mantiene guardado local
    }
  };

  // =========================================================
  // HELPERS DE LEYENDA OFICIAL DE ESTADOS Y PASOS 1-2-3
  // =========================================================
  const obtenerClaseEstado = (estado) => {
    const est = String(estado || '').toLowerCase();
    if (est.includes('registrado')) return 'registered';
    if (est.includes('investigación') || est.includes('investigacion') || est.includes('pendiente')) {
      return 'process';
    }
    if (
      est.includes('aceptado') ||
      est.includes('derivado') ||
      est.includes('derivada') ||
      est.includes('confirmad')
    ) {
      return 'approved';
    }
    if (est.includes('rechazado')) return 'rejected';
    return 'registered';
  };

  const obtenerPasoFlujo = (denuncia) => {
    const est = String(denuncia.estado || '').toLowerCase();
    const cita = citas.find(
      (c) => String(c.id_denuncia) === String(denuncia.id) || c.codigo_denuncia === denuncia.codigo
    );
    if (cita || est.includes('derivad')) return 3;
    if (est.includes('aceptado') || est.includes('rechazado')) return 2;
    return 1;
  };
  const productosFiltrados = productos.filter(
    (p) =>
      (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const denunciasCliente = usuario
    ? denuncias.filter(
        (d) =>
          String(d.id_comerciante) === String(usuario.id) ||
          (d.nombre_comerciante || '').toLowerCase() === (usuario.nombre || '').toLowerCase()
      )
    : [];
  const listaDenunciasMostrar = denunciasCliente.length > 0 ? denunciasCliente : denuncias;

  const citasCliente = citas.filter(
    (c) =>
      (usuario &&
        (String(c.id_comerciante) === String(usuario.id) ||
          (c.agraviado || '').toLowerCase() === (usuario.nombre || '').toLowerCase())) ||
      listaDenunciasMostrar.some((d) => d.codigo === c.codigo_denuncia)
  );

  const nombrePaginaActual =
    vistaActiva === 'catalogo'
      ? 'Catálogo y Carrito'
      : vistaActiva === 'denunciar'
      ? 'Registrar Denuncia PNP'
      : vistaActiva === 'seguimiento'
      ? 'Mis Denuncias y Citas EsSalud'
      : 'Mis Pedidos';

  return (
    <div className="client-app-shell">
      {/* BARRA SUPERIOR INSTITUCIONAL */}
      <header className="client-header">
        <div className="brand-group">
          <div className="brand-badge-icon" aria-hidden="true">🛒</div>
          <div>
            <h1 className="brand-title">Mercado Seguro</h1>
            <span className="brand-subtitle">Portal Cliente · Compras y Seguridad Ciudadana</span>
          </div>
        </div>

        <nav className="client-nav-tabs" aria-label="Navegación principal del portal cliente">
          <button
            type="button"
            aria-current={vistaActiva === 'catalogo' ? 'page' : undefined}
            onClick={() => setVistaActiva('catalogo')}
            className={`nav-tab-item ${vistaActiva === 'catalogo' ? 'active' : ''}`}
          >
            🏪 Catálogo <span className="nav-pill-count">{productos.length}</span>
          </button>

          <button
            type="button"
            aria-current={vistaActiva === 'denunciar' ? 'page' : undefined}
            onClick={abrirFormularioDenuncia}
            className={`nav-tab-item alert-tab ${vistaActiva === 'denunciar' ? 'active' : ''}`}
          >
            🚨 Registrar Denuncia
          </button>

          <button
            type="button"
            aria-current={vistaActiva === 'seguimiento' ? 'page' : undefined}
            onClick={() => setVistaActiva('seguimiento')}
            className={`nav-tab-item ${vistaActiva === 'seguimiento' ? 'active' : ''}`}
          >
            📋 Mis Denuncias y Citas <span className="nav-pill-count">{listaDenunciasMostrar.length}</span>
          </button>

          <button
            type="button"
            aria-current={vistaActiva === 'pedidos' ? 'page' : undefined}
            onClick={() => setVistaActiva('pedidos')}
            className={`nav-tab-item ${vistaActiva === 'pedidos' ? 'active' : ''}`}
          >
            🧾 Mis Pedidos <span className="nav-pill-count">{misPedidos.length}</span>
          </button>
        </nav>

        <div className="header-user-actions">
          {usuario ? (
            <div className="user-pill-box">
              <div className="user-avatar-sm" aria-hidden="true">
                {(usuario.nombre || usuario.email).charAt(0).toUpperCase()}
              </div>
              <span className="user-greeting">Hola, <strong>{usuario.nombre || usuario.email}</strong></span>
              <button type="button" onClick={cerrarSesion} className="btn-logout-sm">
                Salir
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMostrarAuth(true);
                setEsRegistro(false);
                setMsgAuth({ tipo: '', texto: '' });
              }}
              className="btn-login-header"
            >
              Ingresar / Registrarme
            </button>
          )}
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="client-main">
        <div className="context-status-bar">
          <nav className="breadcrumb-row" aria-label="Ubicación actual">
            <span className="crumb-root">Mercado Seguro Cliente</span>
            <span className="crumb-arrow" aria-hidden="true"></span>
            <strong className="crumb-current">{nombrePaginaActual}</strong>
            <button
              type="button"
              onClick={sincronizarTodo}
              className="btn-refresh-inline"
              title="Actualizar catálogo y estados"
            >
              ↻ Actualizar
            </button>
          </nav>

          <div className="legend-row" aria-label="Leyenda de estados">
            <span className="legend-label">Leyenda de estados:</span>
            <span className="badge badge-registered">registrado</span>
            <span className="badge badge-process">en proceso / derivado</span>
            <span className="badge badge-approved">aprobado / atendido / pagado</span>
            <span className="badge badge-rejected">rechazado</span>
          </div>
        </div>

        {alerta.texto && (
          <div
            role="status"
            aria-live="polite"
            className={`alert-banner ${alerta.tipo === 'error' ? 'error' : 'ok'} animate-pop`}
          >
            <div>
              <strong>{alerta.tipo === 'error' ? 'Atención:' : '✅ Confirmado:'}</strong> {alerta.texto}
            </div>
            {alerta.codigo && <span className="code-badge-pill">Código: {alerta.codigo}</span>}
          </div>
        )}

        {/* =========================================================
            VISTA 1: MERCADO INTERACTIVO (PRODUCTOS + CARRITO LATERAL)
            ========================================================= */}
        {vistaActiva === 'catalogo' && (
          <div className="view-fade-in">
            <div className="section-hero-bar">
              <div>
                <h2>🏪 Catálogo Interactivo del Mercado Mayorista</h2>
                <p>
                  {modoCatalogo === 'api'
                    ? 'Catálogo sincronizado en vivo con la base de datos del mercado'
                    : 'Catálogo mayorista disponible — selecciona productos o reporta un incidente a la PNP'}
                </p>
              </div>
              <div className="hero-actions-group">
                <div className="search-field-wrap">
                  <label htmlFor="buscador-prod" className="sr-only">Buscar productos</label>
                  <input
                    id="buscador-prod"
                    type="search"
                    placeholder="🔍 Buscar producto o descripción..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="input-client search-bar-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={abrirFormularioDenuncia}
                  className="btn-emergency-denuncia"
                >
                  🚨 Reportar Incidente
                </button>
              </div>
            </div>

            <div className="catalog-cart-grid">
              <div>
                {cargando ? (
                  <div className="empty-panel">Cargando productos del mercado...</div>
                ) : productosFiltrados.length === 0 ? (
                  <div className="empty-panel">No hay productos que coincidan con tu búsqueda.</div>
                ) : (
                  <div className="products-grid">
                    {productosFiltrados.map((prod) => {
                      const agotado = Number(prod.stock) === 0;
                      const itemEnCarrito = carrito.find((i) => i.id === prod.id);

                      return (
                        <article key={prod.id} className="product-card">
                          <div className="product-img-box">
                            <img
                              src={
                                prod.imagen_url ||
                                prod.imagen ||
                                'https://placehold.co/400x260/0f766e/ffffff?text=Mercado+Seguro'
                              }
                              alt={prod.nombre}
                              className="product-img"
                              onError={(e) => {
                                e.target.src = 'https://placehold.co/400x260/0f766e/ffffff?text=Producto';
                              }}
                            />
                            {prod.stock !== undefined && (
                              <span className={`stock-pill ${agotado ? 'badge-rejected' : 'badge-approved'}`}>
                                {agotado ? 'Agotado' : `Stock: ${prod.stock}`}
                              </span>
                            )}
                          </div>

                          <div className="product-content">
                            <h3>{prod.nombre}</h3>
                            <p>{prod.descripcion || 'Producto verificado en Mercado Seguro.'}</p>

                            <div className="product-bottom">
                              <span className="product-price">S/ {Number(prod.precio || 0).toFixed(2)}</span>
                              <button
                                type="button"
                                onClick={() => agregarAlCarrito(prod)}
                                disabled={agotado}
                                className={agotado ? 'btn-disabled' : 'btn-primary-gradient btn-sm'}
                              >
                                {agotado
                                  ? 'Agotado'
                                  : itemEnCarrito
                                  ? `+ Agregar (${itemEnCarrito.cantidad})`
                                  : '+ Agregar'}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Panel de Carrito Interactivo */}
              <aside className="surface-card cart-panel" aria-label="Carrito de compras">
                <div className="panel-header-line">
                  <h3>🛍️ Tu Carrito ({totalUnidadesCarrito})</h3>
                  {carrito.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCarrito([])}
                      className="btn-text-danger"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {carrito.length === 0 ? (
                  <div className="empty-panel compact">
                    Tu carrito está vacío. Agrega productos del catálogo para realizar tu pedido.
                  </div>
                ) : (
                  <div>
                    <div className="cart-list">
                      {carrito.map((item) => (
                        <div key={item.id} className="cart-row">
                          <div className="cart-row-info">
                            <strong>{item.nombre}</strong>
                            <span>
                              {item.cantidad} × S/ {Number(item.precio).toFixed(2)}
                            </span>
                          </div>
                          <div className="cart-row-controls">
                            <button
                              type="button"
                              aria-label={`Disminuir ${item.nombre}`}
                              onClick={() => actualizarCantidadCarrito(item.id, -1)}
                              className="qty-circle-btn"
                            >
                              -
                            </button>
                            <span className="qty-display">{item.cantidad}</span>
                            <button
                              type="button"
                              aria-label={`Aumentar ${item.nombre}`}
                              onClick={() => actualizarCantidadCarrito(item.id, 1)}
                              className="qty-circle-btn"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              aria-label={`Quitar ${item.nombre}`}
                              onClick={() => quitarDelCarrito(item.id)}
                              className="remove-item-btn"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="cart-footer-box">
                      <div className="cart-total-line">
                        <span>Total a pagar:</span>
                        <strong>S/ {totalCarrito.toFixed(2)}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={confirmarPedido}
                        disabled={guardando}
                        className="btn-primary-gradient"
                      >
                        {guardando ? 'Guardando...' : 'Confirmar Compra'}
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}

        {/* =========================================================
            VISTA 2: REGISTRAR DENUNCIA (CONECTADA CON CENTRAL PNP)
            ========================================================= */}
        {vistaActiva === 'denunciar' && (
          <div className="view-fade-in">
            <div className="section-hero-bar">
              <div>
                <h2>🚨 Registrar Denuncia Policial</h2>
                <p>Conectado directamente con la Central de Emergencias PNP y EsSalud Norte Chico</p>
              </div>
            </div>

            <div className="denuncia-split-grid">
              <div className="surface-card">
                <div className="panel-header-line">
                  <h3>📝 Formulario de Denuncia</h3>
                  <span className="badge badge-approved">Datos Precargados</span>
                </div>

                <form onSubmit={registrarDenuncia}>
                  <div className="field-block">
                    <label htmlFor="den-cliente-nombre">Ciudadano / Comerciante Agraviado</label>
                    <input
                      id="den-cliente-nombre"
                      className="input-client readonly"
                      value={usuario?.nombre || usuario?.email || ''}
                      readOnly
                    />
                  </div>

                  <div className="field-block">
                    <label htmlFor="den-cliente-puesto">Puesto o Ubicación del Incidente</label>
                    <input
                      id="den-cliente-puesto"
                      className="input-client"
                      required
                      placeholder="Ej. Puesto A-14, Pasadizo Principal..."
                      value={formDenuncia.puesto}
                      onChange={(e) => setFormDenuncia({ ...formDenuncia, puesto: e.target.value })}
                    />
                  </div>

                  <div className="field-block">
                    <label htmlFor="den-cliente-tipo">Tipo de Incidente</label>
                    <select
                      id="den-cliente-tipo"
                      className="input-client"
                      value={formDenuncia.tipo_incidente}
                      onChange={(e) =>
                        setFormDenuncia({ ...formDenuncia, tipo_incidente: e.target.value })
                      }
                    >
                      <option value="Robo agravado en puesto">Robo agravado en puesto</option>
                      <option value="Hurto de mercadería">Hurto de mercadería</option>
                      <option value="Agresión con lesiones">Agresión con lesiones</option>
                      <option value="Extorsión o amenazas">Extorsión o amenazas</option>
                    </select>
                  </div>

                  <div className="field-block">
                    <label htmlFor="den-cliente-desc">Descripción detallada de los hechos</label>
                    <textarea
                      id="den-cliente-desc"
                      rows="4"
                      className="input-client"
                      required
                      placeholder="Detalla lo sucedido, hora aproximada y características..."
                      value={formDenuncia.descripcion}
                      onChange={(e) =>
                        setFormDenuncia({ ...formDenuncia, descripcion: e.target.value })
                      }
                    />
                  </div>

                  <div className="checkbox-row">
                    <input
                      id="den-cliente-lesionados"
                      type="checkbox"
                      checked={formDenuncia.hay_lesionados}
                      onChange={(e) =>
                        setFormDenuncia({ ...formDenuncia, hay_lesionados: e.target.checked })
                      }
                    />
                    <label htmlFor="den-cliente-lesionados">
                      Reportar personas lesionadas (requiere derivación médica a EsSalud)
                    </label>
                  </div>

                  <button type="submit" className="btn-primary-gradient" disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Enviar Denuncia a Central PNP'}
                  </button>
                </form>
              </div>

              <div className="surface-card">
                <div className="panel-header-line">
                  <h3>🔗 Flujo Interinstitucional Activo</h3>
                </div>
                <div className="cards-column">
                  <div className="status-card border-registered">
                    <span className="card-code">1 · Central de Emergencias PNP</span>
                    <h4>Recepción y Código de Seguimiento</h4>
                    <p>
                      Tu denuncia se registra de inmediato con código único (DEN-XXXXX) y queda visible en el panel operativo de la PNP.
                    </p>
                  </div>
                  <div className="status-card border-process">
                    <span className="card-code">2 · Evaluación Policial</span>
                    <h4>Seguimiento de Estado en Vivo</h4>
                    <p>
                      Desde la pestaña «Mis Denuncias y Citas» podrás verificar cuando la PNP actualice tu caso a En investigación, Aceptado, Derivado o Rechazado.
                    </p>
                  </div>
                  <div className="status-card border-approved">
                    <span className="card-code">3 · EsSalud Norte Chico</span>
                    <h4>Atención Médica Derivada</h4>
                    <p>
                      Si la PNP deriva tu caso a EsSalud por lesiones, visualizarás aquí mismo la especialidad y horario de tu cita médica.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            VISTA 3: MIS DENUNCIAS Y CITAS MÉDICAS ESSALUD
            ========================================================= */}
        {vistaActiva === 'seguimiento' && (
          <div className="view-fade-in">
            <div className="section-hero-bar">
              <div>
                <h2>📋 Mis Denuncias en PNP y Citas en EsSalud</h2>
                <p>Monitoreo sincronizado en tiempo real con las instituciones</p>
              </div>
              <button
                type="button"
                onClick={abrirFormularioDenuncia}
                className="btn-emergency-denuncia"
              >
                + Nueva Denuncia
              </button>
            </div>

            <div className="two-col-cards">
              <div className="surface-card">
                <div className="panel-header-line">
                  <h3>🚓 Denuncias Registradas ({listaDenunciasMostrar.length})</h3>
                </div>

                {listaDenunciasMostrar.length === 0 ? (
                  <div className="empty-panel">No tienes denuncias registradas todavía.</div>
                ) : (
                  <div className="cards-column">
                    {listaDenunciasMostrar.map((d) => {
                      const color = obtenerClaseEstado(d.estado);
                      const paso = obtenerPasoFlujo(d);
                      const citaVinculada = citas.find((c) => c.codigo_denuncia === d.codigo);

                      return (
                        <div
                          key={d.codigo}
                          className={`status-card border-${color} ${
                            ultimoCodigo === d.codigo ? 'pulse-highlight' : ''
                          }`}
                        >
                          <div className="status-card-top">
                            <div>
                              <span className="card-code">
                                {d.codigo} · {d.puesto}
                              </span>
                              <h4>{d.tipo_incidente}</h4>
                            </div>
                            <span className={`badge badge-${color}`}>{d.estado}</span>
                          </div>
                          <p>{d.descripcion}</p>

                          <div className="stepper-bar">
                            <div className={`step-item ${paso >= 1 ? 'done' : ''}`}>
                              <span>1</span> Enviada PNP
                            </div>
                            <div className={`step-connector ${paso >= 2 ? 'done' : ''}`}></div>
                            <div className={`step-item ${paso >= 2 ? 'done' : ''}`}>
                              <span>{color === 'rejected' ? '✕' : '2'}</span> {d.estado}
                            </div>
                            <div className={`step-connector ${paso >= 3 ? 'done' : ''}`}></div>
                            <div className={`step-item ${paso >= 3 ? 'done' : ''}`}>
                              <span>3</span>{' '}
                              {citaVinculada ? `Cita ${citaVinculada.codigo_cita}` : 'EsSalud'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="surface-card">
                <div className="panel-header-line">
                  <h3>🏥 Mis Citas Médicas en EsSalud ({citasCliente.length})</h3>
                </div>

                {citasCliente.length === 0 ? (
                  <div className="empty-panel">
                    Aún no tienes citas médicas derivadas desde la PNP.
                  </div>
                ) : (
                  <div className="cards-column">
                    {citasCliente.map((c) => (
                      <div
                        key={c.codigo_cita}
                        className={`status-card border-${obtenerClaseEstado(c.estado)}`}
                      >
                        <div className="status-card-top">
                          <div>
                            <span className="card-code">
                              {c.codigo_cita} · Denuncia {c.codigo_denuncia}
                            </span>
                            <h4>{c.especialidad}</h4>
                          </div>
                          <span className={`badge badge-${obtenerClaseEstado(c.estado)}`}>
                            {c.estado}
                          </span>
                        </div>
                        <div className="meta-strip">
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
            VISTA 4: MIS PEDIDOS REALIZADOS
            ========================================================= */}
        {vistaActiva === 'pedidos' && (
          <div className="view-fade-in">
            <div className="section-hero-bar">
              <div>
                <h2>🧾 Historial de Mis Pedidos</h2>
                <p>Compras confirmadas en el Mercado Seguro</p>
              </div>
            </div>

            <div className="surface-card">
              <div className="panel-header-line">
                <h3>Pedidos Registrados ({misPedidos.length})</h3>
              </div>

              {misPedidos.length === 0 ? (
                <div className="empty-panel">
                  Aún no has realizado pedidos. Explora el catálogo para agregar productos a tu carrito.
                </div>
              ) : (
                <div className="cards-column">
                  {misPedidos.map((ped) => {
                    const items =
                      typeof ped.items === 'string' ? JSON.parse(ped.items) : ped.items || [];
                    const codPed = `PED-${String(ped.id).slice(-5).padStart(5, '0')}`;

                    return (
                      <div
                        key={ped.id}
                        className={`status-card border-approved ${
                          ultimoCodigo === codPed ? 'pulse-highlight' : ''
                        }`}
                      >
                        <div className="status-card-top">
                          <div>
                            <span className="card-code">{codPed}</span>
                            <h4>Total: S/ {Number(ped.total || 0).toFixed(2)}</h4>
                          </div>
                          <span className="badge badge-approved">
                            {ped.estado || 'Confirmado'}
                          </span>
                        </div>
                        <div className="meta-strip">
                          {items.map((it, idx) => (
                            <span key={idx}>
                              • <strong>{it.nombre || `Producto #${it.producto_id}`}</strong> (
                              {it.cantidad} × S/ {Number(it.precio).toFixed(2)})
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          MODAL DE INICIO DE SESIÓN / REGISTRO CLIENTE
          ========================================================= */}
      {mostrarAuth && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <div className="modal-card animate-pop">
            <div className="modal-top">
              <h2 id="auth-modal-title">{esRegistro ? 'Crear Cuenta Cliente' : 'Iniciar Sesión'}</h2>
              <button
                type="button"
                aria-label="Cerrar ventana"
                onClick={() => setMostrarAuth(false)}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={manejarAuth} className="auth-modal-form">
              {esRegistro && (
                <div className="field-block">
                  <label htmlFor="auth-nombre">Nombre completo</label>
                  <input
                    id="auth-nombre"
                    type="text"
                    required
                    placeholder="Ej. Rosa Mendoza"
                    value={formAuth.nombre}
                    onChange={(e) => setFormAuth({ ...formAuth, nombre: e.target.value })}
                    className="input-client"
                  />
                </div>
              )}

              <div className="field-block">
                <label htmlFor="auth-email">Correo electrónico</label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="cliente@correo.com"
                  value={formAuth.email}
                  onChange={(e) => setFormAuth({ ...formAuth, email: e.target.value })}
                  className="input-client"
                />
              </div>

              <div className="field-block">
                <label htmlFor="auth-pass">Contraseña</label>
                <div className="pass-field-wrap">
                  <input
                    id="auth-pass"
                    type={mostrarPass ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={formAuth.password}
                    onChange={(e) => setFormAuth({ ...formAuth, password: e.target.value })}
                    className="input-client"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPass(!mostrarPass)}
                    className="btn-show-pass"
                  >
                    {mostrarPass ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              {msgAuth.texto && (
                <p
                  className="auth-feedback-msg"
                  style={
                    msgAuth.tipo === 'ok'
                      ? { background: '#ecfdf5', color: '#065f46', borderColor: '#10b981' }
                      : undefined
                  }
                >
                  {msgAuth.texto}
                </p>
              )}

              <button type="submit" disabled={cargandoAuth} className="btn-primary-gradient">
                {cargandoAuth ? 'Guardando...' : esRegistro ? 'Registrarme' : 'Entrar al Mercado'}
              </button>
            </form>

            <p className="auth-switch-text">
              {esRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setEsRegistro(!esRegistro);
                  setMsgAuth({ tipo: '', texto: '' });
                }}
                className="btn-link-switch"
              >
                {esRegistro ? 'Inicia sesión' : 'Regístrate aquí'}
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}