# NEXUS · Sistema de Gestión

Proyecto de la evaluación de **Traductores e Intérpretes II — Parcial II**.
Aplicación web estática (HTML, CSS y JavaScript) con autenticación, inventario, personal y
proveedores conectados a **Supabase**, desplegada en **Vercel** y publicada en **GitHub**.

## Estructura

```
├── index.html            Portada (línea estética neón)
├── login.html            Inicio de sesión (Supabase Auth)
├── inventario.html       Módulo de productos
├── personal.html         Módulo de personal
├── proveedores.html      Módulo de proveedores
├── app.js                Credenciales + lógica de autenticación y CRUD
├── assets/css/estilos.css
├── supabase/esquema.sql  Tablas, trigger de código y políticas RLS
└── vercel.json
```

## 1. Supabase (ya conectado)

El proyecto **Trabajo_1** (`omqltyzgcvhpbihdnnvd`) ya está creado, con el esquema aplicado:
tablas `productos`, `personal` y `proveedores`, trigger del código autogenerado
(`PRV-0001`, `PRV-0002`, …), políticas RLS y datos de ejemplo.

Credenciales configuradas al inicio de `app.js`:

```js
const SUPABASE_URL = "https://omqltyzgcvhpbihdnnvd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_…";   // clave pública, apta para el navegador
```

**Usuario de acceso:** `admin@nexus.com` · **Contraseña:** `Nexus2026*`
(correo ya confirmado). Se pueden crear más usuarios en
**Authentication → Users → Add user**.

Si se trabaja sobre otro proyecto de Supabase: ejecutar `supabase/esquema.sql` en el
**SQL Editor** y reemplazar las dos constantes de `app.js`.

> Si se dejan los valores de ejemplo (`TU-PROYECTO` / `TU_ANON_KEY`), la aplicación entra en
> **modo demostración** (`demo@nexus.com` / `demo1234`) con datos locales para revisar el diseño.

## 2. Publicar en GitHub

```bash
git init
git add .
git commit -m "Sistema NEXUS: login, inventario, personal y proveedores con Supabase"
git branch -M main
git remote add origin https://github.com/USUARIO/PA.git
git push -u origin main
```

El repositorio debe ser **público** para la revisión.

## 3. Desplegar en Vercel

1. En <https://vercel.com> → **Add New → Project** → importa el repositorio `PA`.
2. Framework preset: **Other**. Sin build command, output en la raíz.
3. **Deploy** y verifica que el enlace público abra `index.html`.

`vercel.json` ya deja las URLs limpias (`/login` además de `/login.html`).

## 4. Módulos y criterios cubiertos

| Módulo | Tabla | Campos principales |
| --- | --- | --- |
| Inventario | `productos` | `codigo`, `nombre`, `categoria`, `precio`, `stock`, `descripcion` |
| Personal | `personal` | `identidad` (PK), `nombres`, `apellidos`, `genero`, `telefono`, `direccion` |
| Proveedores | `proveedores` | `codigo` (autogenerado), `empresa`, `representante`, `encargado`, `telefono`, `direccion`, `email` |

- **Login:** valida con `supabase.auth.signInWithPassword`, intercepta el `submit`, muestra
  alertas estilizadas y redirige a `inventario.html`; las demás páginas redirigen a
  `login.html` si no hay sesión.
- **CRUD:** `cargarInventario()` dibuja los datos; insertar, editar y eliminar usan los
  IDs reales de la base de datos (en personal, la identidad).
- **Notificaciones:** `mostrarNotificacion()` reemplaza a `alert()`; la eliminación se
  confirma con un modal propio en lugar de `confirm()`.
- **Responsivo:** las tablas se convierten en tarjetas apiladas en pantallas menores a 720 px.
