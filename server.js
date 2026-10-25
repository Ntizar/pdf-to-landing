// ─────────────────────────────────────────────────────────────────────────────
// server.js — PDF a landing page, con Aurora como sistema de diseño.
//
// Endpoints limpios (nada monolítico):
//   POST /api/analizar     PDF + colores → identidad + 3 paletas propuestas
//   POST /api/generar      PDF → contenido IA → 3 variantes de landing
//   POST /api/componer     contenido + paleta + formato → variantes (sin IA)
//   POST /api/desde-cero   sin PDF: un formato de ejemplo completo
//   GET  /api/ejemplos     los cinco formatos de web, completos
//   GET  /api/estado       ¿hay IA?
//   GET  /marca/<slug>.css rampa OKLCH de la marca, generada en caliente
//   GET  /vista/<id>       página servida para la vista previa
//
// El HTML generado NO lleva ni un hex a mano: lleva data-nz-marca y un <link>
// a /marca/<slug>.css. Toda clase sale del censo de Aurora y se valida.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { AURORA } from './src/aurora.mjs';
import { generarMarca } from './src/marca.mjs';
import { renderizar, paginaError, PLANTILLAS } from './src/bloques.mjs';
import { analizar, generarContenido, componer, proponerPaletas, ICONOS, PALETAS_OFICIALES } from './src/generador.mjs';
import { todos as ejemplosTodos, EJEMPLOS } from './src/ejemplos.mjs';
import { construir as construirOpenUI, ESTILOS, TEMAS } from './src/openui-generador.mjs';
import { catalogo as catalogoOpenUI, plantillas as plantillasOpenUI, estaListo as openuiListo, iniciar as openuiIniciar } from './src/openui.mjs';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));

// ── Token de la API ─────────────────────────────────────────────────────────
function getToken() {
  if (process.env.NAN_API) return process.env.NAN_API;
  try {
    const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^NAN_API=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* sin .env: se usa el respaldo de plantilla */ }
  return '';
}

// ── Multer en memoria: el PDF no se guarda en disco (es un dato del usuario) ──
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── Almacén de páginas para la vista previa ─────────────────────────────────
const VISTAS = path.join(__dirname, 'vistas');
fs.mkdirSync(VISTAS, { recursive: true });

function limpiarVistas() {
  const limite = Date.now() - 6 * 3600 * 1000;
  try {
    for (const f of fs.readdirSync(VISTAS)) {
      const p = path.join(VISTAS, f);
      if (fs.statSync(p).mtimeMs < limite) fs.unlinkSync(p);
    }
  } catch { /* la limpieza nunca debe tumbar una petición */ }
}

// Devuelve la URL pública de la página (con .html), no el id a secas: la vista
// previa apuntaba a /vista/<id> y express.static responde 404 sin extensión.
function guardarVista(html) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  fs.writeFileSync(path.join(VISTAS, `${id}.html`), html);
  return `/vista/${id}.html`;
}

// ── Utilidades ──────────────────────────────────────────────────────────────
function coloresDe(req) {
  const crudo = req.body?.colores;
  if (!crudo) return [];
  try {
    const c = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    return Array.isArray(c) ? c : [];
  } catch { return []; }
}

// Dos motores: `openui` (el modelo compone con 36 componentes) y `bloques`
// (composición fija del sistema). OpenUI es el de por defecto: es el que da
// variedad de verdad; bloques queda como red de seguridad.
function modoPedido(req) {
  const m = String(req.body?.modo || '').toLowerCase();
  return m === 'bloques' ? 'bloques' : 'openui';
}

function estiloPedido(req) {
  const e = String(req.body?.estilo || '').toLowerCase();
  return ESTILOS[e] ? e : 'producto';
}

function temaPedido(req) {
  const t = String(req.body?.tema || '').toLowerCase();
  return TEMAS[t] ? t : 'claro';
}

function plantillaPedida(req, porDefecto = 'clasica') {
  const p = req.body?.plantilla || porDefecto;
  return PLANTILLAS[p] ? p : porDefecto;
}

function fallo(res, mensaje, estado = 500) {
  console.error('· ' + mensaje);
  res.status(estado).json({ ok: false, error: mensaje });
}

// ── POST /api/analizar ──────────────────────────────────────────────────────
async function handleAnalizar(req, res) {
  try {
    if (!req.file) return fallo(res, 'No llegó ningún PDF.', 400);
    let texto = '';
    try {
      const data = await pdfParse(req.file.buffer);
      texto = data.text || '';
    } catch {
      return fallo(res, 'No se pudo leer el PDF. Puede estar protegido; prueba a exportarlo de nuevo.', 422);
    }
    if (texto.trim().length < 40) {
      return fallo(res, 'El PDF no tiene texto seleccionable (parece un escaneo). Prueba con la versión digital del documento.', 422);
    }

    const colores = coloresDe(req);
    const nombreFichero = path.basename(req.file.originalname || 'documento.pdf');
    const token = getToken();

    if (!token) {
      return res.json({
        ok: true, sinIA: true,
        design: { empresa: nombreFichero.replace(/\.pdf$/i, ''), sector: '', plantilla: 'clasica' },
        paletas: proponerPaletas(colores),
        aviso: 'Falta el token de la API: se propone un formato sin análisis de contenido.',
      });
    }

    const { design, paletas, tokens } = await analizar({ token, texto, nombreFichero, colores });
    console.log(`· analizar ${nombreFichero} · ${texto.length} car · ${JSON.stringify(tokens)}`);
    res.json({ ok: true, design, paletas, textoCaracteres: texto.length, tokens });
  } catch (err) {
    fallo(res, 'No se pudo analizar el PDF: ' + err.message);
  }
}

// ── POST /api/componer — sin IA ─────────────────────────────────────────────
function handleComponer(req, res) {
  try {
    const { contenido } = req.body || {};
    if (!contenido) return fallo(res, 'Faltan los datos del contenido.', 400);
    const plantilla = plantillaPedida(req);
    const lista = (req.body.paletas && req.body.paletas.length ? req.body.paletas : proponerPaletas([])).slice(0, 3);
    const out = componer({ contenido, design: req.body.design || {}, paletas: lista, plantilla });
    res.json({
      ok: true, plantilla, nombrePlantilla: out.nombrePlantilla,
      vistas: out.variantes.map((v) => ({
        id: v.id, etiqueta: v.etiqueta, descripcion: v.descripcion, esRecomendada: v.esRecomendada,
        marca: v.marca, contraste: v.contraste, bloques: v.bloques, packs: v.packs,
        url: guardarVista(v.html),
      })),
    });
  } catch (err) {
    fallo(res, 'No se pudo componer la página: ' + err.message);
  }
}

// ── POST /api/desde-cero — un formato de ejemplo, completo ──────────────────
function handleDesdeCero(req, res) {
  try {
    const plantilla = plantillaPedida(req);
    const ejemplo = EJEMPLOS.find((e) => e.plantilla === plantilla) || EJEMPLOS[0];
    const generado = ejemplosTodos().find((e) => e.slug === ejemplo.slug);
    res.json({
      ok: true, plantilla,
      nombrePlantilla: PLANTILLAS[plantilla].nombre,
      url: guardarVista(generado.html),
      bloques: generado.bloques,
    });
  } catch (err) {
    fallo(res, 'No se pudo crear el ejemplo: ' + err.message);
  }
}

// Página de respaldo: el ejemplo de ese formato, con la marca del usuario
function respaldoDe(plantilla, paleta, motivo) {
  const ejemplo = EJEMPLOS.find((e) => e.plantilla === plantilla) || EJEMPLOS[0];
  const generado = ejemplosTodos().find((e) => e.slug === ejemplo.slug);
  const html = generado.html.replace(`/marca/${generado.marca.nombre}.css`, `/marca/${paleta.nombre}.css`);
  return { url: guardarVista(html), motivo };
}

// ── POST /api/generar — la cadena completa con IA ───────────────────────────
async function handleGenerar(req, res) {
  try {
    if (!req.file) return fallo(res, 'Falta el PDF.', 400);
    let texto = '';
    try {
      const data = await pdfParse(req.file.buffer);
      texto = data.text || '';
    } catch {
      return fallo(res, 'No se pudo leer el PDF.', 422);
    }
    if (texto.trim().length < 40) {
      return fallo(res, 'El PDF no tiene texto seleccionable (parece un escaneo). Prueba con la versión digital.', 422);
    }

    const colores = coloresDe(req);
    const plantilla = plantillaPedida(req);
    const nombreFichero = path.basename(req.file.originalname || 'documento.pdf');
    const token = getToken();
    const paletasIniciales = proponerPaletas(colores);

    if (!token) {
      const r = respaldoDe(plantilla, paletasIniciales[0], 'Sin token de la API: se muestra una vista de ejemplo de ese formato.');
      return res.json({ ok: true, degradado: true, plantilla, nombrePlantilla: PLANTILLAS[plantilla].nombre, ...r });
    }

    let design = {};
    let paletas = paletasIniciales;
    try {
      const a = await analizar({ token, texto, nombreFichero, colores });
      design = a.design || {};
      paletas = a.paletas || paletasIniciales;
    } catch (e) {
      console.error('· análisis falló, sigo con la plantilla:', e.message);
    }

    const modo = modoPedido(req);
    const estilo = estiloPedido(req);
    const tema = temaPedido(req);
    const marca = { nombre: paletas[0].nombre, marca: paletas[0].marca, acento: paletas[0].acento };

    // ── MODO OPENUI: el modelo compone con los 36 componentes ──────────────
    // Es el modo que da variedad: el mismo negocio con otro estilo produce otra
    // estructura. Si el programa no sale, se cae al modo de bloques.
    if (modo === 'openui') {
      try {
        const r = await construirOpenUI({ token, design, texto, estilo, tema, marca });
        if (r.ok) {
          console.log(`· openui ${nombreFichero} · ${estilo}/${tema} · ${r.nodos} nodos · ${Object.keys(r.componentes).length} componentes · ${r.intentos} intento(s)`);
          res.json({
            ok: true, modo: 'openui', estilo, tema,
            estiloNombre: ESTILOS[estilo].nombre, temaNombre: TEMAS[tema].nombre,
            design, marca,
            url: guardarVista(r.html),
            programa: r.programa,
            componentes: r.componentes,
            packs: r.packs,
            nodos: r.nodos,
            intentos: r.intentos,
            avisos: r.avisos,
            ajustesColor: r.ajustesColor,
          });
          limpiarVistas();
          return;
        }
        console.error('· openui no llegó a buen puerto:', r.errores.join(' | '));
        // se guarda el motivo y se sigue al modo de bloques
        var motivoOpenUI = r.errores.slice(0, 2).join(' · ');
      } catch (e) {
        console.error('· openui falló:', e.message);
        var motivoOpenUI = e.message;
      }
    }

    let contenido;
    let razon = 0;
    try {
      const g = await generarContenido({ token, design, texto, plantilla });
      contenido = g.contenido;
      razon = g.razon;
    } catch (e) {
      console.error('· contenido falló:', e.message);
      const r = respaldoDe(plantilla, paletas[0], 'La IA no respondió a tiempo. Se muestra una vista de ejemplo de ese formato: vuelve a intentarlo.');
      return res.json({ ok: true, degradado: true, plantilla, nombrePlantilla: PLANTILLAS[plantilla].nombre, design, ...r });
    }

    const out = componer({ contenido, design, paletas, plantilla });
    console.log(`· generar ${nombreFichero} · ${plantilla} · ${out.variantes[0].bloques.length} bloques · razonamiento ${razon} car`);

    res.json({
      ok: true, modo: 'bloques', plantilla, nombrePlantilla: out.nombrePlantilla,
      motivoCambioModo: typeof motivoOpenUI === 'string' ? motivoOpenUI : undefined,
      design, contenido: out.contenido, razonamiento: razon,
      vistas: out.variantes.map((v) => ({
        id: v.id, etiqueta: v.etiqueta, descripcion: v.descripcion, esRecomendada: v.esRecomendada,
        marca: v.marca, contraste: v.contraste, bloques: v.bloques, packs: v.packs,
        url: guardarVista(v.html),
      })),
    });
    limpiarVistas();
  } catch (err) {
    fallo(res, 'No se pudo generar la landing: ' + err.message);
  }
}

// ── Marca en caliente ───────────────────────────────────────────────────────
const PALETAS_SISTEMA = Object.fromEntries(PALETAS_OFICIALES.map((p) => [p.nombre, p]));
const MARCAS_CACHE = new Map();

app.get('/marca/:slug.css', (req, res) => {
  const slug = String(req.params.slug || 'aurora').replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'aurora';
  const color = /^#[0-9a-f]{6}$/i.test(req.query.c || '') ? req.query.c : null;
  const acento = /^#[0-9a-f]{6}$/i.test(req.query.a || '') ? req.query.a : null;
  const clave = `${slug}|${color}|${acento}`;
  let css = MARCAS_CACHE.get(clave);
  if (!css) {
    const base = PALETAS_SISTEMA[slug] || { marca: '#2563eb', acento: '#f97316' };
    css = generarMarca(slug, color || base.marca, acento || base.acento).css;
    MARCAS_CACHE.set(clave, css);
  }
  res.type('text/css').set('Cache-Control', 'public, max-age=86400').send(css);
});

// ── Rutas ───────────────────────────────────────────────────────────────────
app.post('/api/analizar', subida.single('pdf'), handleAnalizar);
app.post('/api/generar', subida.single('pdf'), handleGenerar);
app.post('/api/componer', handleComponer);
app.post('/api/desde-cero', handleDesdeCero);

app.get('/api/ejemplos', (req, res) => {
  try {
    res.json({
      ok: true,
      plantillas: Object.entries(PLANTILLAS).map(([id, p]) => ({ id, nombre: p.nombre, descripcion: p.descripcion })),
      ejemplos: ejemplosTodos().map((e) => ({
        slug: e.slug, formato: e.formato, resumen: e.resumen, empresa: e.empresa,
        plantilla: e.plantilla, nombrePlantilla: e.nombrePlantilla,
        bloques: e.bloques, packs: e.packs, marca: e.marca,
        url: guardarVista(e.html),
      })),
      iconos: ICONOS.map(([nombre]) => nombre),
    });
  } catch (err) {
    fallo(res, 'No se pudieron listar los ejemplos: ' + err.message);
  }
});

app.get('/api/motores', (req, res) => {
  res.json({
    ok: true,
    modos: [
      { id: 'openui', nombre: 'Libre', descripcion: 'El modelo compone con 36 componentes: cada negocio sale distinto.' },
      { id: 'bloques', nombre: 'Composición fija', descripcion: 'Bloques del sistema en un orden probado. Más predecible.' },
    ],
    estilos: Object.entries(ESTILOS).map(([id, e]) => ({ id, nombre: e.nombre, descripcion: e.descripcion })),
    temas: Object.entries(TEMAS).map(([id, t]) => ({ id, nombre: t.nombre, descripcion: t.descripcion })),
    componentes: catalogoOpenUI().length,
    plantillas: plantillasOpenUI().length,
    openuiListo: openuiListo(),
  });
});

app.get('/api/aurora', (req, res) => {
  res.json({ ok: true, version: AURORA.version, cdn: AURORA.cdn, clases: Object.keys(AURORA.clases).length, packs: AURORA.packs.length });
});

app.get('/api/estado', (req, res) => {
  res.json({ ok: true, ia: Boolean(getToken()), version: AURORA.version, uptime: Math.round(process.uptime()) });
});

app.use('/vista', express.static(VISTAS));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return fallo(res, 'Ruta no encontrada: ' + req.path, 404);
  res.status(404).type('html').send(paginaError({
    titulo: 'Esa página no existe',
    texto: 'La dirección que buscas no está en esta aplicación.',
    detalle: 'Vuelve al inicio para generar tu landing page.',
  }));
});

const servidor = app.listen(PORT, () => {
  console.log(`PDF a Landing · Aurora ${AURORA.version} · http://localhost:${PORT} · IA ${getToken() ? 'lista' : 'sin token'}`);
  // El runtime de OpenUI se carga una vez al arrancar: si fallara, el modo libre
  // avisa y la app sigue sirviendo el modo de bloques.
  openuiIniciar()
    .then(() => console.log(`· OpenUI listo · ${catalogoOpenUI().length} componentes · parser ${'local'}`))
    .catch((e) => console.error('· OpenUI no disponible:', e.message));
});
servidor.requestTimeout = 5 * 60 * 1000;
servidor.headersTimeout = 5 * 60 * 1000;
