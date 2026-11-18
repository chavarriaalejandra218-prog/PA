/* =========================================================
   NEXUS · Sistema de Gestión
   Evaluación Traductores e Intérpretes II — Parcial II
   Lógica general: configuración Supabase, autenticación,
   inventario (productos), personal y proveedores.
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   1) CREDENCIALES DE SUPABASE
   Reemplaza estos dos valores por los de tu proyecto:
   Supabase → Project Settings → API → Project URL / anon key
   --------------------------------------------------------- */
const SUPABASE_URL = "https://omqltyzgcvhpbihdnnvd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G3aaTCewqS-D9DZ12NIrvw_kNbmJTP_";

/* ---------------------------------------------------------
   2) Cliente de Supabase
   --------------------------------------------------------- */
const CREDENCIALES_OK = !/TU-PROYECTO|TU_ANON_KEY/.test(SUPABASE_URL + SUPABASE_ANON_KEY);
const MODO_DEMO = !CREDENCIALES_OK;
const db = CREDENCIALES_OK ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* Datos de demostración: solo se usan mientras no haya credenciales reales */
const USUARIO_DEMO = { correo: "demo@nexus.com", clave: "demo1234" };
const DEMO = {
  productos: [
    { id: 4, codigo: "PRD-004", nombre: "Servicio de interpretación simultánea", categoria: "Servicios", descripcion: "Jornada de 4 horas, cabina doble", precio: 6500, stock: 3 },
    { id: 3, codigo: "PRD-003", nombre: "Glosario técnico EN-ES", categoria: "Material", descripcion: "Terminología legal y médica", precio: 480, stock: 12 },
    { id: 2, codigo: "PRD-002", nombre: "Traducción jurada (por página)", categoria: "Traducción", descripcion: "Documentos con sello y fe", precio: 350, stock: 40 },
    { id: 1, codigo: "PRD-001", nombre: "Kit de cabina portátil", categoria: "Equipo", descripcion: "Dos receptores y consola", precio: 12500, stock: 2 }
  ],
  personal: [
    { identidad: "0801-2001-04567", nombres: "Ana Lucía", apellidos: "Mejía Cruz", genero: "Femenino", telefono: "+504 9988-1122", direccion: "Col. Palmira, Tegucigalpa", correo: "ana.mejia@nexus.com", cargo: "Traductora senior" },
    { identidad: "0501-1998-01234", nombres: "Carlos Andrés", apellidos: "Rivas Zelaya", genero: "Masculino", telefono: "+504 9977-4455", direccion: "Barrio El Centro, SPS", correo: "carlos.rivas@nexus.com", cargo: "Intérprete" },
    { identidad: "0801-2004-09981", nombres: "Sofía", apellidos: "Pineda López", genero: "Femenino", telefono: "+504 3399-8877", direccion: "Res. Los Proceres, Tegucigalpa", correo: "sofia.pineda@nexus.com", cargo: "Coordinadora de proyectos" }
  ],
  proveedores: [
    { id: 2, codigo: "PRV-0002", empresa: "TecnoAudio Honduras", representante: "Luis Fernando Paz", encargado: "Karla Núñez", telefono: "+504 2232-7788", direccion: "Blvd. Morazán, Tegucigalpa", email: "contacto@tecnoaudio.hn" },
    { id: 1, codigo: "PRV-0001", empresa: "Editorial Bilingüe S. de R.L.", representante: "Marta Elena Suazo", encargado: "Jorge Castillo", telefono: "+504 2550-1122", direccion: "Bo. El Benque, San Pedro Sula", email: "ventas@editorialbilingue.hn" }
  ]
};

const estado = { productos: [], personal: [], proveedores: [] };
const CLAVE_SESION_DEMO = "nx_sesion_demo";

/* ---------------------------------------------------------
   3) Utilidades generales
   --------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);
const valor = (id) => (document.getElementById(id)?.value || "").trim();

function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const moneda = new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" });
const formatoMoneda = (n) => moneda.format(Number(n) || 0);

function mensajeError(error) {
  if (!error) return "Error desconocido.";
  const codigo = error.code || "";
  if (codigo === "23505") return "Ya existe un registro con ese código o identidad.";
  if (codigo === "23514") return "Algún dato no cumple las reglas de la tabla (revisa el género o los valores negativos).";
  if (codigo === "42P01" || codigo === "PGRST205") return "La tabla no existe: ejecuta supabase/esquema.sql en el SQL Editor.";
  if (codigo === "42501") return "Sin permisos para operar: revisa las políticas RLS del esquema.";
  if (codigo === "PGRST301") return "La sesión expiró. Vuelve a iniciar sesión.";
  return error.message || String(error);
}

/* ---------------------------------------------------------
   4) Notificaciones estilizadas (sin alert() nativas)
   --------------------------------------------------------- */
function mostrarNotificacion(mensaje, tipo = "info") {
  let contenedor = document.getElementById("toasts");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "toasts";
    contenedor.className = "toasts";
    contenedor.setAttribute("aria-live", "polite");
    document.body.appendChild(contenedor);
  }

  const iconos = { ok: "✓", error: "✕", alerta: "!", info: "i" };
  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo}`;
  toast.setAttribute("role", "status");

  const icono = document.createElement("span");
  icono.className = "toast__icon";
  icono.textContent = iconos[tipo] || iconos.info;

  const texto = document.createElement("span");
  texto.textContent = mensaje;

  toast.append(icono, texto);
  contenedor.appendChild(toast);

  while (contenedor.children.length > 3) contenedor.firstElementChild.remove();

  const cerrar = () => {
    toast.classList.add("is-out");
    setTimeout(() => toast.remove(), 240);
  };
  const temporizador = setTimeout(cerrar, 4200);
  toast.addEventListener("click", () => {
    clearTimeout(temporizador);
    cerrar();
  });
}

/* Diálogo de confirmación propio (evita confirm() nativo) */
function confirmar(mensaje, textoBoton = "Eliminar") {
  const modal = document.getElementById("modalConfirmar");
  if (!modal) return Promise.resolve(window.confirm(mensaje));

  const texto = document.getElementById("modalTexto");
  const aceptar = document.getElementById("modalAceptar");
  const cancelar = document.getElementById("modalCancelar");
  if (texto) texto.textContent = mensaje;
  if (aceptar) aceptar.textContent = textoBoton;

  modal.hidden = false;
  aceptar?.focus();

  return new Promise((resolver) => {
    const terminar = (resultado) => {
      modal.hidden = true;
      aceptar.removeEventListener("click", alAceptar);
      cancelar.removeEventListener("click", alCancelar);
      modal.removeEventListener("click", alFondo);
      document.removeEventListener("keydown", alTeclado);
      resolver(resultado);
    };
    const alAceptar = () => terminar(true);
    const alCancelar = () => terminar(false);
    const alFondo = (ev) => { if (ev.target === modal) terminar(false); };
    const alTeclado = (ev) => { if (ev.key === "Escape") terminar(false); };

    aceptar.addEventListener("click", alAceptar);
    cancelar.addEventListener("click", alCancelar);
    modal.addEventListener("click", alFondo);
    document.addEventListener("keydown", alTeclado);
  });
}

/* Filas de apoyo para las tablas */
function filaCargando(columnas) {
  return `<tr class="tabla--vacia"><td colspan="${columnas}">Cargando datos desde la nube…</td></tr>`;
}

function filaVacia(columnas, mensaje) {
  return `<tr class="tabla--vacia"><td colspan="${columnas}">${esc(mensaje)}</td></tr>`;
}

/* ---------------------------------------------------------
   5) Sesión / autenticación
   --------------------------------------------------------- */
async function sesionActiva() {
  if (MODO_DEMO) return sessionStorage.getItem(CLAVE_SESION_DEMO) === USUARIO_DEMO.correo;
  const { data } = await db.auth.getSession();
  return Boolean(data.session);
}

async function correoSesion() {
  if (MODO_DEMO) return sessionStorage.getItem(CLAVE_SESION_DEMO) || "";
  const { data } = await db.auth.getUser();
  return data.user?.email || "";
}

async function protegerPagina() {
  if (await sesionActiva()) return true;
  window.location.replace("login.html");
  return false;
}

function pintarUsuario(correo) {
  const chip = document.getElementById("usuarioActual");
  if (chip) chip.textContent = correo || "sesión activa";
}

async function cerrarSesion() {
  if (MODO_DEMO) {
    sessionStorage.removeItem(CLAVE_SESION_DEMO);
  } else {
    await db.auth.signOut();
  }
  mostrarNotificacion("Sesión cerrada correctamente.", "ok");
  setTimeout(() => window.location.replace("login.html"), 550);
}

/* Aviso cuando aún no se han colocado las credenciales */
function mostrarAvisoConfiguracion() {
  if (!MODO_DEMO) return;
  const main = document.querySelector("main");
  if (!main || document.getElementById("avisoDemo")) return;

  const aviso = document.createElement("div");
  aviso.id = "avisoDemo";
  aviso.className = "aviso";
  aviso.innerHTML =
    '<strong>Modo demostración.</strong> ' +
    'Coloca <span class="mono">SUPABASE_URL</span> y <span class="mono">SUPABASE_ANON_KEY</span> ' +
    "en <span class=\"mono\">app.js</span> para conectar la base de datos real. " +
    'Usuario demo: <span class="mono">demo@nexus.com</span> / <span class="mono">demo1234</span>';
  main.prepend(aviso);
}

/* ---------------------------------------------------------
   6) Login
   --------------------------------------------------------- */
function initLogin() {
  const form = document.getElementById("formLogin");
  if (!form) return;

  if (MODO_DEMO) {
    const caja = document.getElementById("credencialesDemo");
    if (caja) caja.hidden = false;
  }

  sesionActiva().then((activa) => {
    if (activa) window.location.replace("inventario.html");
  });

  const boton = form.querySelector('button[type="submit"]');
  const cajaError = document.getElementById("errorLogin");

  const mostrarError = (texto) => {
    if (!cajaError) return mostrarNotificacion(texto, "error");
    cajaError.textContent = texto;
    cajaError.hidden = false;
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (cajaError) cajaError.hidden = true;

    const correo = valor("loginCorreo");
    const clave = document.getElementById("loginClave").value;
    const recordar = document.getElementById("loginRecordar")?.checked;

    if (!correo || !clave) {
      mostrarError("Escribe tu correo y tu contraseña para continuar.");
      mostrarNotificacion("Faltan credenciales.", "alerta");
      return;
    }

    boton.disabled = true;
    const textoOriginal = boton.textContent;
    boton.textContent = "Verificando…";

    try {
      if (MODO_DEMO) {
        await new Promise((r) => setTimeout(r, 450));
        if (correo.toLowerCase() !== USUARIO_DEMO.correo || clave !== USUARIO_DEMO.clave) {
          throw new Error("Correo o contraseña incorrectos.");
        }
        sessionStorage.setItem(CLAVE_SESION_DEMO, USUARIO_DEMO.correo);
      } else {
        const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });
        if (error) throw error;
        if (recordar) localStorage.setItem("nx_correo", correo);
        else localStorage.removeItem("nx_correo");
      }

      mostrarNotificacion("Bienvenido. Abriendo el inventario…", "ok");
      setTimeout(() => window.location.assign("inventario.html"), 500);
    } catch (error) {
      const texto = /invalid login credentials/i.test(error.message || "")
        ? "Correo o contraseña incorrectos."
        : /email not confirmed/i.test(error.message || "")
          ? "El correo aún no está confirmado en Supabase."
          : mensajeError(error);
      mostrarError(texto);
      mostrarNotificacion(texto, "error");
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  });

  const guardado = localStorage.getItem("nx_correo");
  if (guardado) {
    const campo = document.getElementById("loginCorreo");
    if (campo) campo.value = guardado;
  }
}

/* ---------------------------------------------------------
   7) MÓDULO INVENTARIO (productos)
   --------------------------------------------------------- */
async function cargarInventario() {
  const tbody = document.getElementById("tablaProductos");
  if (!tbody) return;
  tbody.innerHTML = filaCargando(6);

  try {
    if (MODO_DEMO) {
      estado.productos = DEMO.productos.map((p) => ({ ...p }));
    } else {
      const { data, error } = await db.from("productos").select("*").order("id", { ascending: false });
      if (error) throw error;
      estado.productos = data || [];
    }
    pintarProductos();
    actualizarKpisInventario();
  } catch (error) {
    tbody.innerHTML = filaVacia(6, "No se pudo cargar el inventario: " + mensajeError(error));
    mostrarNotificacion("Error al cargar inventario: " + mensajeError(error), "error");
  }
}

function pintarProductos() {
  const tbody = document.getElementById("tablaProductos");
  if (!tbody) return;

  if (!estado.productos.length) {
    tbody.innerHTML = filaVacia(6, "Aún no hay productos registrados. Agrega el primero con el formulario.");
    return;
  }

  tbody.innerHTML = estado.productos
    .map((p) => {
      const stock = Number(p.stock) || 0;
      return `
        <tr>
          <td data-label="Código"><span class="mono">${esc(p.codigo)}</span></td>
          <td data-label="Producto">
            <strong>${esc(p.nombre)}</strong>
            ${p.descripcion ? `<small class="muted block">${esc(p.descripcion)}</small>` : ""}
          </td>
          <td data-label="Categoría">${esc(p.categoria || "—")}</td>
          <td data-label="Precio">${formatoMoneda(p.precio)}</td>
          <td data-label="Stock">${stock <= 5 ? `<span class="badge badge--alerta">${stock}</span>` : stock}</td>
          <td data-label="Acciones">
            <div class="acciones">
              <button class="btn btn--ghost btn--sm" type="button" data-accion="editar" data-id="${esc(p.id)}">Editar</button>
              <button class="btn btn--danger btn--sm" type="button" data-accion="eliminar" data-id="${esc(p.id)}">Eliminar</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");
}

function actualizarKpisInventario() {
  const total = estado.productos.length;
  const bajo = estado.productos.filter((p) => (Number(p.stock) || 0) <= 5).length;
  const valorTotal = estado.productos.reduce(
    (suma, p) => suma + (Number(p.precio) || 0) * (Number(p.stock) || 0),
    0
  );

  if ($("#kpiProductos")) $("#kpiProductos").textContent = total;
  if ($("#kpiStockBajo")) $("#kpiStockBajo").textContent = bajo;
  if ($("#kpiValor")) $("#kpiValor").textContent = formatoMoneda(valorTotal);
}

function limpiarFormProducto() {
  document.getElementById("formProducto")?.reset();
  if ($("#productoId")) $("#productoId").value = "";
  const titulo = $("#tituloFormProducto");
  if (titulo) titulo.textContent = "Nuevo producto";
  const boton = $("#btnGuardarProducto");
  if (boton) boton.textContent = "Guardar producto";
}

function cargarProductoEnFormulario(producto) {
  if (!producto) return;
  $("#productoId").value = producto.id;
  $("#productoCodigo").value = producto.codigo || "";
  $("#productoNombre").value = producto.nombre || "";
  $("#productoCategoria").value = producto.categoria || "";
  $("#productoPrecio").value = producto.precio ?? "";
  $("#productoStock").value = producto.stock ?? 0;
  $("#productoDescripcion").value = producto.descripcion || "";
  $("#tituloFormProducto").textContent = "Editar producto";
  $("#btnGuardarProducto").textContent = "Guardar cambios";
  document.getElementById("formProducto").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function guardarProducto(ev) {
  ev.preventDefault();
  const id = valor("productoId");
  const datos = {
    codigo: valor("productoCodigo").toUpperCase(),
    nombre: valor("productoNombre"),
    categoria: valor("productoCategoria"),
    descripcion: valor("productoDescripcion"),
    precio: Number(valor("productoPrecio") || 0),
    stock: Number(valor("productoStock") || 0)
  };

  if (!datos.codigo || !datos.nombre) {
    mostrarNotificacion("El código y el nombre del producto son obligatorios.", "alerta");
    return;
  }
  if (datos.precio < 0 || datos.stock < 0) {
    mostrarNotificacion("El precio y el stock no pueden ser negativos.", "alerta");
    return;
  }

  const boton = $("#btnGuardarProducto");
  if (boton) boton.disabled = true;

  try {
    if (MODO_DEMO) {
      await new Promise((r) => setTimeout(r, 250));
      if (id) {
        const indice = estado.productos.findIndex((p) => String(p.id) === String(id));
        if (indice >= 0) estado.productos[indice] = { ...estado.productos[indice], ...datos };
      } else {
        const nuevoId = estado.productos.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
        estado.productos.unshift({ id: nuevoId, ...datos });
      }
      pintarProductos();
      actualizarKpisInventario();
    } else if (id) {
      const { error } = await db.from("productos").update(datos).eq("id", id);
      if (error) throw error;
      await cargarInventario();
    } else {
      const { error } = await db.from("productos").insert(datos);
      if (error) throw error;
      await cargarInventario();
    }

    mostrarNotificacion(id ? "Producto actualizado correctamente." : "Producto registrado en Supabase.", "ok");
    limpiarFormProducto();
  } catch (error) {
    mostrarNotificacion("No se pudo guardar: " + mensajeError(error), "error");
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function manejarAccionesProducto(ev) {
  const boton = ev.target.closest("[data-accion]");
  if (!boton) return;

  const id = boton.dataset.id;
  const producto = estado.productos.find((p) => String(p.id) === String(id));

  if (boton.dataset.accion === "editar") {
    cargarProductoEnFormulario(producto);
    return;
  }

  const seguro = await confirmar(
    `Se eliminará "${producto?.nombre || "el producto"}". Esta acción no se puede deshacer.`
  );
  if (!seguro) return;

  try {
    if (MODO_DEMO) {
      estado.productos = estado.productos.filter((p) => String(p.id) !== String(id));
      pintarProductos();
      actualizarKpisInventario();
    } else {
      const { error } = await db.from("productos").delete().eq("id", id);
      if (error) throw error;
      await cargarInventario();
    }
    mostrarNotificacion("Producto eliminado.", "ok");
  } catch (error) {
    mostrarNotificacion("No se pudo eliminar: " + mensajeError(error), "error");
  }
}

function initInventario() {
  const tabla = document.getElementById("tablaProductos");
  if (!tabla) return;

  protegerPagina().then(async (ok) => {
    if (!ok) return;
    pintarUsuario(await correoSesion());
    mostrarAvisoConfiguracion();
    await cargarInventario();
  });

  document.getElementById("formProducto")?.addEventListener("submit", guardarProducto);
  $("#btnCancelarProducto")?.addEventListener("click", limpiarFormProducto);
  $("#btnRefrescar")?.addEventListener("click", () => {
    mostrarNotificacion("Sincronizando inventario con Supabase…", "info");
    cargarInventario();
  });
  tabla.addEventListener("click", manejarAccionesProducto);
  $("#btnSalir")?.addEventListener("click", cerrarSesion);
}

/* ---------------------------------------------------------
   8) NUEVO MÓDULO PERSONAL
   --------------------------------------------------------- */
async function cargarPersonal() {
  const tbody = document.getElementById("tablaPersonal");
  if (!tbody) return;
  tbody.innerHTML = filaCargando(6);

  try {
    if (MODO_DEMO) {
      estado.personal = DEMO.personal.map((p) => ({ ...p }));
    } else {
      const { data, error } = await db
        .from("personal")
        .select("*")
        .order("apellidos", { ascending: true });
      if (error) throw error;
      estado.personal = data || [];
    }
    pintarPersonal();
    if ($("#kpiPersonal")) $("#kpiPersonal").textContent = estado.personal.length;
  } catch (error) {
    tbody.innerHTML = filaVacia(6, "No se pudo cargar el personal: " + mensajeError(error));
    mostrarNotificacion("Error al cargar personal: " + mensajeError(error), "error");
  }
}

function pintarPersonal() {
  const tbody = document.getElementById("tablaPersonal");
  if (!tbody) return;

  if (!estado.personal.length) {
    tbody.innerHTML = filaVacia(6, "Todavía no hay colaboradores registrados.");
    return;
  }

  tbody.innerHTML = estado.personal
    .map(
      (p) => `
        <tr>
          <td data-label="Identidad"><span class="mono">${esc(p.identidad)}</span></td>
          <td data-label="Nombre">
            <strong>${esc(p.nombres)} ${esc(p.apellidos)}</strong>
            ${p.cargo ? `<small class="muted block">${esc(p.cargo)}</small>` : ""}
          </td>
          <td data-label="Género">${esc(p.genero || "—")}</td>
          <td data-label="Teléfono">${esc(p.telefono || "—")}</td>
          <td data-label="Dirección">${esc(p.direccion || "—")}</td>
          <td data-label="Acciones">
            <div class="acciones">
              <button class="btn btn--ghost btn--sm" type="button" data-accion="editar" data-id="${esc(p.identidad)}">Editar</button>
              <button class="btn btn--danger btn--sm" type="button" data-accion="eliminar" data-id="${esc(p.identidad)}">Eliminar</button>
            </div>
          </td>
        </tr>`
    )
    .join("");
}

function limpiarFormPersonal() {
  document.getElementById("formPersonal")?.reset();
  $("#personalOriginal") && ($("#personalOriginal").value = "");
  if ($("#tituloFormPersonal")) $("#tituloFormPersonal").textContent = "Nuevo colaborador";
  if ($("#btnGuardarPersonal")) $("#btnGuardarPersonal").textContent = "Guardar colaborador";
  const identidad = $("#personalIdentidad");
  if (identidad) identidad.readOnly = false;
}

function cargarPersonalEnFormulario(persona) {
  if (!persona) return;
  $("#personalOriginal").value = persona.identidad;
  $("#personalIdentidad").value = persona.identidad || "";
  $("#personalIdentidad").readOnly = true;
  $("#personalNombres").value = persona.nombres || "";
  $("#personalApellidos").value = persona.apellidos || "";
  $("#personalGenero").value = persona.genero || "";
  $("#personalTelefono").value = persona.telefono || "";
  $("#personalDireccion").value = persona.direccion || "";
  $("#personalCorreo").value = persona.correo || "";
  $("#personalCargo").value = persona.cargo || "";
  $("#tituloFormPersonal").textContent = "Editar colaborador";
  $("#btnGuardarPersonal").textContent = "Guardar cambios";
  document.getElementById("formPersonal").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function guardarPersonal(ev) {
  ev.preventDefault();
  const original = valor("personalOriginal");
  const datos = {
    identidad: valor("personalIdentidad"),
    nombres: valor("personalNombres"),
    apellidos: valor("personalApellidos"),
    genero: valor("personalGenero"),
    telefono: valor("personalTelefono"),
    direccion: valor("personalDireccion"),
    correo: valor("personalCorreo") || null,
    cargo: valor("personalCargo") || null
  };

  if (!datos.identidad || !datos.nombres || !datos.apellidos || !datos.genero || !datos.telefono || !datos.direccion) {
    mostrarNotificacion("Completa identidad, nombres, apellidos, género, teléfono y dirección.", "alerta");
    return;
  }

  const boton = $("#btnGuardarPersonal");
  if (boton) boton.disabled = true;

  try {
    if (MODO_DEMO) {
      await new Promise((r) => setTimeout(r, 250));
      if (original) {
        const indice = estado.personal.findIndex((p) => p.identidad === original);
        if (indice >= 0) estado.personal[indice] = { ...datos };
      } else {
        if (estado.personal.some((p) => p.identidad === datos.identidad)) {
          throw new Error("Ya existe un colaborador con esa identidad.");
        }
        estado.personal.unshift({ ...datos });
      }
      pintarPersonal();
      if ($("#kpiPersonal")) $("#kpiPersonal").textContent = estado.personal.length;
    } else if (original) {
      const { error } = await db.from("personal").update(datos).eq("identidad", original);
      if (error) throw error;
      await cargarPersonal();
    } else {
      const { error } = await db.from("personal").insert(datos);
      if (error) throw error;
      await cargarPersonal();
    }

    mostrarNotificacion(original ? "Colaborador actualizado." : "Colaborador registrado en Supabase.", "ok");
    limpiarFormPersonal();
  } catch (error) {
    mostrarNotificacion("No se pudo guardar: " + mensajeError(error), "error");
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function manejarAccionesPersonal(ev) {
  const boton = ev.target.closest("[data-accion]");
  if (!boton) return;

  const identidad = boton.dataset.id;
  const persona = estado.personal.find((p) => p.identidad === identidad);

  if (boton.dataset.accion === "editar") {
    cargarPersonalEnFormulario(persona);
    return;
  }

  const seguro = await confirmar(
    `Se eliminará a "${persona ? persona.nombres + " " + persona.apellidos : identidad}". Esta acción no se puede deshacer.`
  );
  if (!seguro) return;

  try {
    if (MODO_DEMO) {
      estado.personal = estado.personal.filter((p) => p.identidad !== identidad);
      pintarPersonal();
      if ($("#kpiPersonal")) $("#kpiPersonal").textContent = estado.personal.length;
    } else {
      const { error } = await db.from("personal").delete().eq("identidad", identidad);
      if (error) throw error;
      await cargarPersonal();
    }
    mostrarNotificacion("Colaborador eliminado.", "ok");
  } catch (error) {
    mostrarNotificacion("No se pudo eliminar: " + mensajeError(error), "error");
  }
}

function initPersonal() {
  const tabla = document.getElementById("tablaPersonal");
  if (!tabla) return;

  protegerPagina().then(async (ok) => {
    if (!ok) return;
    pintarUsuario(await correoSesion());
    mostrarAvisoConfiguracion();
    await cargarPersonal();
  });

  document.getElementById("formPersonal")?.addEventListener("submit", guardarPersonal);
  $("#btnCancelarPersonal")?.addEventListener("click", limpiarFormPersonal);
  $("#btnRefrescarPersonal")?.addEventListener("click", () => cargarPersonal());
  tabla.addEventListener("click", manejarAccionesPersonal);
  $("#btnSalir")?.addEventListener("click", cerrarSesion);
}

/* ---------------------------------------------------------
   9) NUEVO MÓDULO PROVEEDORES
   --------------------------------------------------------- */
async function cargarProveedores() {
  const tbody = document.getElementById("tablaProveedores");
  if (!tbody) return;
  tbody.innerHTML = filaCargando(6);

  try {
    if (MODO_DEMO) {
      estado.proveedores = DEMO.proveedores.map((p) => ({ ...p }));
    } else {
      const { data, error } = await db
        .from("proveedores")
        .select("*")
        .order("id", { ascending: false });
      if (error) throw error;
      estado.proveedores = data || [];
    }
    pintarProveedores();
    if ($("#kpiProveedores")) $("#kpiProveedores").textContent = estado.proveedores.length;
  } catch (error) {
    tbody.innerHTML = filaVacia(6, "No se pudo cargar los proveedores: " + mensajeError(error));
    mostrarNotificacion("Error al cargar proveedores: " + mensajeError(error), "error");
  }
}

function pintarProveedores() {
  const tbody = document.getElementById("tablaProveedores");
  if (!tbody) return;

  if (!estado.proveedores.length) {
    tbody.innerHTML = filaVacia(6, "Aún no hay proveedores registrados.");
    return;
  }

  tbody.innerHTML = estado.proveedores
    .map(
      (p) => `
        <tr>
          <td data-label="Código"><span class="mono">${esc(p.codigo)}</span></td>
          <td data-label="Empresa">
            <strong>${esc(p.empresa)}</strong>
            <small class="muted block">${esc(p.email || "")}</small>
          </td>
          <td data-label="Representante">${esc(p.representante || "—")}</td>
          <td data-label="Encargado">${esc(p.encargado || "—")}</td>
          <td data-label="Contacto">
            ${esc(p.telefono || "—")}
            <small class="muted block">${esc(p.direccion || "")}</small>
          </td>
          <td data-label="Acciones">
            <div class="acciones">
              <button class="btn btn--ghost btn--sm" type="button" data-accion="editar" data-id="${esc(p.id)}">Editar</button>
              <button class="btn btn--danger btn--sm" type="button" data-accion="eliminar" data-id="${esc(p.id)}">Eliminar</button>
            </div>
          </td>
        </tr>`
    )
    .join("");
}

function limpiarFormProveedor() {
  document.getElementById("formProveedor")?.reset();
  if ($("#proveedorId")) $("#proveedorId").value = "";
  if ($("#tituloFormProveedor")) $("#tituloFormProveedor").textContent = "Nuevo proveedor";
  if ($("#btnGuardarProveedor")) $("#btnGuardarProveedor").textContent = "Guardar proveedor";
}

function cargarProveedorEnFormulario(proveedor) {
  if (!proveedor) return;
  $("#proveedorId").value = proveedor.id;
  $("#proveedorEmpresa").value = proveedor.empresa || "";
  $("#proveedorRepresentante").value = proveedor.representante || "";
  $("#proveedorEncargado").value = proveedor.encargado || "";
  $("#proveedorTelefono").value = proveedor.telefono || "";
  $("#proveedorDireccion").value = proveedor.direccion || "";
  $("#proveedorEmail").value = proveedor.email || "";
  $("#tituloFormProveedor").textContent = "Editar proveedor";
  $("#btnGuardarProveedor").textContent = "Guardar cambios";
  document.getElementById("formProveedor").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function guardarProveedor(ev) {
  ev.preventDefault();
  const id = valor("proveedorId");
  const datos = {
    empresa: valor("proveedorEmpresa"),
    representante: valor("proveedorRepresentante"),
    encargado: valor("proveedorEncargado"),
    telefono: valor("proveedorTelefono"),
    direccion: valor("proveedorDireccion"),
    email: valor("proveedorEmail").toLowerCase()
  };

  const camposObligatorios = ["empresa", "representante", "encargado", "telefono", "direccion", "email"];
  if (camposObligatorios.some((campo) => !datos[campo])) {
    mostrarNotificacion("Completa todos los campos del proveedor (el código se genera solo).", "alerta");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
    mostrarNotificacion("Escribe un correo electrónico válido.", "alerta");
    return;
  }

  const boton = $("#btnGuardarProveedor");
  if (boton) boton.disabled = true;

  try {
    if (MODO_DEMO) {
      await new Promise((r) => setTimeout(r, 250));
      if (id) {
        const indice = estado.proveedores.findIndex((p) => String(p.id) === String(id));
        if (indice >= 0) estado.proveedores[indice] = { ...estado.proveedores[indice], ...datos };
      } else {
        const nuevoId = estado.proveedores.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
        const codigo = "PRV-" + String(nuevoId).padStart(4, "0");
        estado.proveedores.unshift({ id: nuevoId, codigo, ...datos });
      }
      pintarProveedores();
      if ($("#kpiProveedores")) $("#kpiProveedores").textContent = estado.proveedores.length;
    } else if (id) {
      /* El código es autogenerado por la base de datos, por eso no se envía */
      const { error } = await db.from("proveedores").update(datos).eq("id", id);
      if (error) throw error;
      await cargarProveedores();
    } else {
      const { error } = await db.from("proveedores").insert(datos);
      if (error) throw error;
      await cargarProveedores();
    }

    mostrarNotificacion(id ? "Proveedor actualizado." : "Proveedor registrado en Supabase.", "ok");
    limpiarFormProveedor();
  } catch (error) {
    mostrarNotificacion("No se pudo guardar: " + mensajeError(error), "error");
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function manejarAccionesProveedor(ev) {
  const boton = ev.target.closest("[data-accion]");
  if (!boton) return;

  const id = boton.dataset.id;
  const proveedor = estado.proveedores.find((p) => String(p.id) === String(id));

  if (boton.dataset.accion === "editar") {
    cargarProveedorEnFormulario(proveedor);
    return;
  }

  const seguro = await confirmar(
    `Se eliminará a "${proveedor?.empresa || "el proveedor"}". Esta acción no se puede deshacer.`
  );
  if (!seguro) return;

  try {
    if (MODO_DEMO) {
      estado.proveedores = estado.proveedores.filter((p) => String(p.id) !== String(id));
      pintarProveedores();
      if ($("#kpiProveedores")) $("#kpiProveedores").textContent = estado.proveedores.length;
    } else {
      const { error } = await db.from("proveedores").delete().eq("id", id);
      if (error) throw error;
      await cargarProveedores();
    }
    mostrarNotificacion("Proveedor eliminado.", "ok");
  } catch (error) {
    mostrarNotificacion("No se pudo eliminar: " + mensajeError(error), "error");
  }
}

function initProveedores() {
  const tabla = document.getElementById("tablaProveedores");
  if (!tabla) return;

  protegerPagina().then(async (ok) => {
    if (!ok) return;
    pintarUsuario(await correoSesion());
    mostrarAvisoConfiguracion();
    await cargarProveedores();
  });

  document.getElementById("formProveedor")?.addEventListener("submit", guardarProveedor);
  $("#btnCancelarProveedor")?.addEventListener("click", limpiarFormProveedor);
  $("#btnRefrescarProveedor")?.addEventListener("click", () => cargarProveedores());
  tabla.addEventListener("click", manejarAccionesProveedor);
  $("#btnSalir")?.addEventListener("click", cerrarSesion);
}

/* ---------------------------------------------------------
   10) Arranque
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  if (MODO_DEMO) console.info("[NEXUS] Modo demostración activo: faltan las credenciales de Supabase en app.js.");

  const pagina = document.body.dataset.page;
  if (pagina === "login") initLogin();
  if (pagina === "inventario") initInventario();
  if (pagina === "personal") initPersonal();
  if (pagina === "proveedores") initProveedores();
});
