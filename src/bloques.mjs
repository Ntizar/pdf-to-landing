// ─────────────────────────────────────────────────────────────────────────────
// bloques.mjs — Renderizador determinista de landing con objetos Aurora.
//
// El experimento que originó esto: pedirle a qwen3.6 el HTML entero sale peor
// que pedirle solo el CONTENIDO. El diseño (layout, jerarquía, espaciado,
// accesibilidad) lo decide el sistema; el modelo solo escribe textos.
//
// · Toda clase sale del censo de Aurora (validada por aurora.mjs).
// · Cero colores a mano: el color viaja por data-nz-marca + /marca/<slug>.css.
// · Cero emojis: iconos del sprite de Aurora (iconos/NNN-nombre.svg).
// · Un solo <h1>, densidad única, ≤ 5 momentos de color.
//
// Bugs reales corregidos aquí (vistos midiendo la página en el navegador):
//  1. `.nz-timeline__title` y `__desc` son inline → sin contenedor en pila se
//     leían en una sola línea corrida.
//  2. `.nz-list--icon` pinta una caja de color y el icono se suma a ella: salía
//     un "checkbox vacío" que parecía un placeholder. Se usa `--check`.
//  3. Los iconos de ventaja sin tono eran grises casi invisibles: azulejo en marca.
//  4. Rejilla fija de 3 columnas con 2 tarjetas dejaba un tercio vacío:
//     `nz-grid-auto` se ajusta al número de datos.
//  5. Un `.nz-lbl` suelto se estira a todo el ancho y parece una barra vacía.
//  6. `.nz-hero-bleed--brand` no tiene utilidad de tinta invertida en el sistema:
//     el hero de marca dejaba el subtítulo ilegible. El formato producto lleva
//     las cifras dentro del hero, en fondo suave.
// ─────────────────────────────────────────────────────────────────────────────
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AURORA, ATRIBUCION, escapar, packsNecesarios } from './aurora.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_ICONOS = path.join(__dirname, 'iconos');

// ── Iconos: sprite real de Aurora, incrustado en línea (sin red en el HTML) ───
const CACHE_ICONOS = new Map();

export function icono(nombre, { clase = '', tamano = '' } = {}) {
  if (!CACHE_ICONOS.has(nombre)) {
    let interior = '';
    try {
      const svg = fs.readFileSync(path.join(DIR_ICONOS, `${nombre}.svg`), 'utf8');
      interior = svg
        .replace(/^[\s\S]*?<svg[^>]*>/, '')
        .replace(/<\/svg>[\s\S]*$/, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim();
    } catch {
      interior = '';
    }
    CACHE_ICONOS.set(nombre, interior);
  }
  const interior = CACHE_ICONOS.get(nombre);
  if (!interior) return '';
  const clases = ['nz-icon', tamano ? `nz-icon--${tamano}` : '', clase].filter(Boolean).join(' ');
  return `<svg class="${clases}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${interior}</svg>`;
}

// ── Piezas básicas ───────────────────────────────────────────────────────────
const seccion = (id, etiqueta, interior, { clase = '' } = {}) =>
  `<section${id ? ` id="${escapar(id)}"` : ''} class="nz-container nz-stack${clase ? ` ${clase}` : ''}"${etiqueta ? ` aria-label="${escapar(etiqueta)}"` : ''}>\n${interior}\n</section>`;

const parrafo = (t, clase = '') => (t ? `<p${clase ? ` class="${clase}"` : ''}>${escapar(t)}</p>` : '');

const kpiHTML = (k, acento = false) => `      <div class="nz-kpi${acento ? ' nz-kpi--accent' : ''}">
        <span class="nz-kpi__label">${escapar(k.etiqueta || '')}</span>
        <span class="nz-kpi__value">${escapar(k.valor || '')}</span>
        ${k.nota ? `<span class="nz-kpi__delta">${escapar(k.nota)}</span>` : ''}
      </div>`;

function slugAncla(txt) {
  return String(txt).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Bloques ──────────────────────────────────────────────────────────────────
export const BLOQUES = {
  // Cabecera: marca + enlaces + acción
  navegacion(d, ctx) {
    const enlaces = (d.enlaces || []).slice(0, 4)
      .map((e) => `    <a class="nz-cta nz-cta--muted" href="#${escapar(slugAncla(e))}">${escapar(e)}</a>`)
      .join('\n');
    const cta = d.cta
      ? `<a class="nz-btn nz-btn--ghost nz-btn--sm" href="#contacto">${escapar(d.cta)}</a>`
      : '';
    return `<header class="nz-container nz-cluster nz-cluster--between nz-navbar nz-navbar--bordered" style="padding-block:var(--nz-space-3)">
  <span class="nz-lbl">${escapar(d.empresa || 'Marca')}</span>
  <nav class="nz-cluster nz-cluster--compact" aria-label="Principal">
${enlaces}
    ${cta}
  </nav>
</header>`;
  },

  // Hero: tres direcciones según la plantilla
  hero(d, ctx) {
    const ctaPrincipal = d.cta || ctx.cta;
    const acciones = [
      ctaPrincipal ? `<a class="nz-btn nz-btn--primary nz-btn--lg" href="#contacto">${escapar(ctaPrincipal)}</a>` : '',
      d.cta_secundario ? `<a class="nz-cta nz-cta--accent" href="#producto">${escapar(d.cta_secundario)}<span class="nz-cta__arrow">→</span></a>` : '',
    ].filter(Boolean).join('\n        ');
    // rótulo en línea: un .nz-lbl suelto se estira y parece una barra vacía
    const prueba = d.dato_hero
      ? `<div class="nz-cluster nz-cluster--compact">
      <span class="nz-lbl">${escapar(d.dato_hero)}</span>
    </div>`
      : '';
    const variante = ctx.varianteHero || 'sangre';
    const titulo = escapar(d.titulo || d.empresa || 'Tu propuesta');

    // Editorial: dos columnas, el titular manda y la entradilla respira al lado
    if (variante === 'editorial') {
      return `<div class="nz-hero-bleed">
  <div class="nz-container">
    <div class="nz-split nz-split--3-2">
      <div class="nz-stack">
        ${d.eyebrow ? `<span class="nz-eyebrow">${escapar(d.eyebrow)}</span>` : ''}
        <h1 class="nz-h1">${titulo}</h1>
        ${d.dato_hero ? `<div class="nz-cluster nz-cluster--compact"><span class="nz-lbl">${escapar(d.dato_hero)}</span></div>` : ''}
      </div>
      <div class="nz-stack">
        ${d.subtitulo ? `<p class="nz-lead">${escapar(d.subtitulo)}</p>` : ''}
        <div class="nz-cluster">
          ${acciones}
        </div>
      </div>
    </div>
  </div>
</div>`;
    }

    // Producto: fondo suave + tira de cifras dentro (la derecha no queda vacía y
    // el texto conserva contraste: el hero de marca no tiene tinta invertida)
    if (variante === 'producto') {
      const tira = (ctx.cifrasHero || []).length
        ? `
    <div class="nz-grid-auto" style="margin-top:var(--nz-space-6)">
${(ctx.cifrasHero || []).slice(0, 3).map((k, i) => kpiHTML(k, i === 0)).join('\n')}
    </div>`
        : '';
      return `<div class="nz-hero-bleed">
  <div class="nz-container nz-stack">
    ${d.eyebrow ? `<span class="nz-eyebrow">${escapar(d.eyebrow)}</span>` : ''}
    <h1 class="nz-h1">${titulo}</h1>
    ${d.subtitulo ? `<p class="nz-lead nz-lead--lg">${escapar(d.subtitulo)}</p>` : ''}
    <div class="nz-cluster">
        ${acciones}
    </div>
    ${prueba}${tira}
  </div>
</div>`;
    }

    // Sangre (clásica, catálogo, evento): una columna, todo el peso en el titular
    return `<div class="nz-hero-bleed">
  <div class="nz-container nz-stack">
    ${d.eyebrow ? `<span class="nz-eyebrow">${escapar(d.eyebrow)}</span>` : ''}
    <h1 class="nz-h1">${titulo}</h1>
    ${d.subtitulo ? `<p class="nz-lead nz-lead--lg">${escapar(d.subtitulo)}</p>` : ''}
    <div class="nz-cluster">
        ${acciones}
    </div>
    ${prueba}
  </div>
</div>`;
  },

  // Ventajas en tarjetas con azulejo de icono
  ventajas(d) {
    if (!(d.items || []).length) return '';
    const tarjetas = d.items.slice(0, 3).map((f) => `    <article class="nz-article">
      ${f.icono ? `<span class="nz-icon-tile">${icono(f.icono)}</span>` : ''}
      <h3 class="nz-h5">${escapar(f.titulo || '')}</h3>
      ${parrafo(f.descripcion)}
    </article>`).join('\n');
    return seccion('producto', d.titulo || 'Ventajas', `    <h2 class="nz-h3">${escapar(d.titulo || 'Lo que cambia')}</h2>
${d.entradilla ? `    <p class="nz-lead nz-lead--sm">${escapar(d.entradilla)}</p>` : ''}
    <div class="nz-grid-auto">
${tarjetas}
    </div>`);
  },

  // Cifras de apoyo
  cifras(d, ctx) {
    if (!(d.items || []).length) return '';
    const kpis = d.items.slice(0, 3).map((k, i) => kpiHTML(k, i === 0 && ctx.acentoEnCifras)).join('\n');
    return seccion('', d.titulo || 'En cifras', `    <h2 class="nz-h3">${escapar(d.titulo || 'En cifras')}</h2>
    <div class="nz-grid-auto">
${kpis}
    </div>`);
  },

  // Texto a dos columnas con lista de puntos
  lista(d) {
    if (!(d.items || []).length) return '';
    const puntos = d.items.slice(0, 6)
      .map((i) => `        <li class="nz-list__item"><span>${escapar(typeof i === 'string' ? i : i.texto || '')}</span></li>`)
      .join('\n');
    return seccion('servicios', d.titulo || 'Servicios', `    <div class="nz-split nz-split--2-1">
      <div class="nz-stack">
        <h2 class="nz-h3">${escapar(d.titulo || 'Servicios')}</h2>
        ${d.entradilla ? `<p class="nz-lead nz-lead--sm">${escapar(d.entradilla)}</p>` : ''}
      </div>
      <ul class="nz-list nz-list--check nz-list--divided">
${puntos}
      </ul>
    </div>`);
  },

  // Planes y precios
  precios(d, ctx) {
    if (!(d.items || []).length) return '';
    const planes = d.items.slice(0, 3).map((p, i) => `      <div class="nz-plan${i === 1 ? ' nz-plan--featured' : ''}">
        ${i === 1 ? `<span class="nz-badge ${ctx.acentoEnPlan ? 'nz-badge--accent' : 'nz-badge--neutral'} nz-plan__flag">Más elegido</span>` : ''}
        <span class="nz-plan__name">${escapar(p.nombre || '')}</span>
        ${p.descripcion ? `<span class="nz-plan__desc">${escapar(p.descripcion)}</span>` : ''}
        <span class="nz-plan__price">${escapar(p.precio || 'A medida')}${p.periodo ? ` <small>${escapar(p.periodo)}</small>` : ''}</span>
        <div class="nz-plan__features">
${(p.caracteristicas || []).slice(0, 4).map((c) => `          <span class="nz-plan__feature"><i></i>${escapar(c)}</span>`).join('\n')}
        </div>
        <button class="nz-btn ${i === 1 ? 'nz-btn--primary' : 'nz-btn--outline'} nz-plan__cta" type="button">${escapar(p.cta || 'Elegir')}</button>
      </div>`).join('\n');
    return seccion('precios', d.titulo || 'Precios', `    <h2 class="nz-h3">${escapar(d.titulo || 'Precios sin letra pequeña')}</h2>
    <div class="nz-plans">
${planes}
    </div>`);
  },

  // Cita de cliente
  testimonio(d, ctx) {
    if (!d.texto) return '';
    const inicial = (d.autor || '?').trim().charAt(0).toUpperCase();
    const tono = ctx.acentoEnTestimonio ? ' nz-blockquote--accent' : '';
    return seccion('', 'Testimonio', `    <blockquote class="nz-blockquote${tono}">
      <p>${escapar(d.texto)}</p>
      <footer class="nz-cluster nz-cluster--compact">
        <span class="nz-avatar nz-avatar--sm">${escapar(inicial)}</span>
        <span class="nz-lbl">${escapar(d.autor || 'Cliente')}${d.cargo ? ` · ${escapar(d.cargo)}` : ''}</span>
      </footer>
    </blockquote>`);
  },

  // Preguntas frecuentes (acordeón nativo del sistema)
  faq(d) {
    if (!(d.items || []).length) return '';
    const items = d.items.slice(0, 5).map((q, i) => `      <details class="nz-preguntas-frecuentes__item"${i === 0 ? ' open' : ''}>
        <summary class="nz-preguntas-frecuentes__pregunta"><span>${escapar(q.pregunta || '')}</span>${icono('011-angulo-abajo', { clase: '' })}</summary>
        <div class="nz-preguntas-frecuentes__respuesta">${escapar(q.respuesta || '')}</div>
      </details>`).join('\n');
    return seccion('faq', d.titulo || 'Preguntas frecuentes', `    <h2 class="nz-h3">${escapar(d.titulo || 'Preguntas frecuentes')}</h2>
    <div class="nz-preguntas-frecuentes">
${items}
    </div>`);
  },

  // Llamada final
  cta_final(d) {
    // El banner es flex en columna: un .nz-split hijo no repartía y el texto
    // quedaba en una columna de un carácter. Cuerpo en dos bloques y la acción
    // siempre a la vista.
    return seccion('contacto', 'Empezar', `    <div class="nz-cta-banner nz-cta-banner--bordered">
      ${d.eyebrow ? `<span class="nz-cta-banner__eyebrow">${escapar(d.eyebrow)}</span>` : ''}
      <div class="nz-cluster nz-cluster--between" style="align-items:center;width:100%">
        <div class="nz-stack nz-stack--2xs" style="flex:1 1 22rem;min-width:0">
          <h2 class="nz-cta-banner__title">${escapar(d.titulo || 'Empezamos')}</h2>
          ${d.texto ? `<p class="nz-cta-banner__body">${escapar(d.texto)}</p>` : ''}
        </div>
        <div class="nz-cta-banner__actions">
          <a class="nz-btn nz-btn--outline nz-btn--lg" href="#">${escapar(d.cta || 'Contactar')}</a>
        </div>
      </div>
      ${d.nota ? `<span class="nz-text--small nz-text--muted">${escapar(d.nota)}</span>` : ''}
    </div>`);
  },

  // Datos de contacto
  contacto(d) {
    const filas = (d.items || []).slice(0, 4).map((c) => `      <div class="nz-article">
        <span class="nz-lbl">${escapar(c.etiqueta || '')}</span>
        <p>${escapar(c.valor || '')}</p>
      </div>`).join('\n');
    if (!filas) return '';
    return seccion('', 'Contacto', `    <h2 class="nz-h3">${escapar(d.titulo || 'Hablemos')}</h2>
    <div class="nz-grid-auto">
${filas}
    </div>`);
  },

  // Pasos o proceso (línea de tiempo del sistema)
  pasos(d) {
    if (!(d.items || []).length) return '';
    // El timeline del sistema deja los pasos en una columna estrecha: con textos
    // cortos el bloque se ve flaco y a la izquierda. Con tarjetas numeradas la
    // sección ocupa el ancho y se lee como un proceso terminado.
    const tarjetas = d.items.slice(0, 4).map((p, i) => `      <article class="nz-article">
        <span class="nz-badge nz-badge--neutral">Paso ${i + 1}</span>
        <h3 class="nz-h5" style="margin-top:var(--nz-space-2)">${escapar(p.titulo || '')}</h3>
        ${p.descripcion ? `<p class="nz-text--small nz-text--muted">${escapar(p.descripcion)}</p>` : ''}
      </article>`).join(String.fromCharCode(10));
    return seccion('proceso', d.titulo || 'Cómo funciona', `    <h2 class="nz-h3">${escapar(d.titulo || 'Cómo funciona')}</h2>
    ${d.entradilla ? `<p class="nz-lead nz-lead--sm">${escapar(d.entradilla)}</p>` : ''}
    <div class="nz-grid-auto">
${tarjetas}
    </div>`);
  },

  // Galería de piezas
  galeria(d) {
    if (!(d.items || []).length) return '';
    const piezas = d.items.slice(0, 3).map((g) => `      <figure class="nz-figura">
        <div class="nz-mapa-placeholder nz-mapa-placeholder--neutral" style="min-height:9rem">
          <span class="nz-mapa-placeholder__label">${escapar(g.pie || g.titulo || 'Imagen')}</span>
        </div>
        <figcaption class="nz-figura__pie">${escapar(g.titulo || g.pie || '')}</figcaption>
      </figure>`).join('\n');
    return seccion('galeria', d.titulo || 'Galería', `    <h2 class="nz-h3">${escapar(d.titulo || 'Galería')}</h2>
    <div class="nz-grid-auto">
${piezas}
    </div>`);
  },

  // Ficha técnica en lista de definición
  ficha(d) {
    if (!(d.items || []).length) return '';
    const filas = d.items.slice(0, 6)
      .map((f) => `        <div class="nz-dl__row"><dt class="nz-dl__dt">${escapar(f.etiqueta || '')}</dt><dd class="nz-dl__dd">${escapar(f.valor || '')}</dd></div>`)
      .join('\n');
    return seccion('ficha', d.titulo || 'Ficha', `    <h2 class="nz-h3">${escapar(d.titulo || 'Ficha')}</h2>
    <div class="nz-dl">
${filas}
    </div>`);
  },

  // Aviso breve
  nota(d) {
    if (!d.texto) return '';
    return seccion('', 'Aviso', `    <div class="nz-alert nz-alert--info">
      <div class="nz-alert__body">
        ${d.titulo ? `<span class="nz-alert__title">${escapar(d.titulo)}</span>` : ''}
        <span class="nz-alert__msg">${escapar(d.texto)}</span>
      </div>
    </div>`);
  },
};

// alias: el contenido puede llamarlo "proceso" o "pasos"
BLOQUES.proceso = (d, ctx) => BLOQUES.pasos(d, ctx);

export const ORDEN = ['navegacion', 'hero', 'ventajas', 'cifras', 'lista', 'pasos', 'proceso',
  'galeria', 'precios', 'ficha', 'testimonio', 'faq', 'contacto', 'nota', 'cta_final'];

// ── Plantillas: direcciones visuales con los MISMOS objetos del sistema ──────
export const PLANTILLAS = {
  clasica: {
    nombre: 'Clásica',
    descripcion: 'Hero a sangre, tres ventajas y cierre con precios. La más legible para servicios profesionales.',
    orden: ['navegacion', 'hero', 'ventajas', 'cifras', 'lista', 'precios', 'testimonio', 'faq', 'contacto', 'cta_final'],
    hero: 'sangre',
  },
  editorial: {
    nombre: 'Editorial',
    descripcion: 'Titular grande a dos columnas, texto largo y ficha de datos. Para marca personal, despachos y estudios.',
    orden: ['navegacion', 'hero', 'lista', 'cifras', 'galeria', 'testimonio', 'ficha', 'faq', 'cta_final'],
    hero: 'editorial',
  },
  producto: {
    nombre: 'Producto',
    descripcion: 'Hero con cifras dentro, planes y FAQ. Para SaaS y apps.',
    orden: ['navegacion', 'hero', 'cifras', 'ventajas', 'precios', 'pasos', 'faq', 'cta_final'],
    hero: 'producto',
  },
  evento: {
    nombre: 'Evento',
    descripcion: 'Fechas, programa y ficha técnica. Para congresos, cursos y presentaciones.',
    orden: ['navegacion', 'hero', 'ficha', 'pasos', 'galeria', 'cifras', 'contacto', 'cta_final'],
    hero: 'sangre',
  },
  catalogo: {
    nombre: 'Catálogo',
    descripcion: 'Galería protagonista con ventajas cortas. Para estudios, interiorismo y producto físico.',
    orden: ['navegacion', 'hero', 'galeria', 'ventajas', 'testimonio', 'precios', 'contacto', 'cta_final'],
    hero: 'sangre',
  },
};

// ── Composición de la página ─────────────────────────────────────────────────
export function renderizar(contenido, { marca, marcaColor, marcaAcento, titulo, packsExtra = [], plantilla = 'clasica' } = {}) {
  const plan = PLANTILLAS[plantilla] || PLANTILLAS.clasica;

  // La doctrina de Aurora: el acento marca el dato que importa y se gasta UNA vez.
  // Prioridad: plan destacado > primera cifra > testimonio.
  const hayCifras = Boolean(contenido.cifras && (contenido.cifras.items || []).length);
  const hayPlanes = Boolean(contenido.precios && (contenido.precios.items || []).length);
  const cifrasEnHero = plan.hero === 'producto' && hayCifras;

  const ctx = {
    marca,
    cta: contenido.cta,
    varianteHero: plan.hero,
    cifrasHero: cifrasEnHero ? contenido.cifras.items : [],
    // un único momento de acento por página (si no, marca y acento compiten)
    acentoEnCifras: hayCifras && !hayPlanes,
    acentoEnTestimonio: false,
    acentoEnCtaSecundario: !hayCifras && !hayPlanes,
    acentoEnPlan: hayPlanes,
  };

  const partes = [];
  const usados = [];
  const usadosSet = new Set();

  const nav = contenido.navegacion || (contenido.hero
    ? { empresa: contenido.empresa, enlaces: contenido.enlaces, cta: contenido.cta }
    : null);
  if (nav) { partes.push(BLOQUES.navegacion(nav, ctx)); usados.push('nav'); }

  partes.push('<main class="nz-stack">');

  const pintar = (tipo) => {
    if (tipo === 'navegacion' || usadosSet.has(tipo)) return;
    if (typeof BLOQUES[tipo] !== 'function') return;
    if (tipo === 'cifras' && cifrasEnHero) return; // ya viven en el hero
    const datos = contenido[tipo];
    if (!datos) return;
    const html = BLOQUES[tipo](datos, ctx);
    if (html) { partes.push(html); usados.push(tipo); usadosSet.add(tipo); }
  };

  for (const tipo of plan.orden) pintar(tipo);
  // ningún bloque del contenido se queda fuera por no estar en la plantilla
  for (const tipo of ORDEN) pintar(tipo);

  partes.push('</main>');

  const cuerpo = partes.join('\n\n');

  const packs = new Set([...packsNecesarios(cuerpo), ...packsExtra]);
  const enlaces = ['tokens.css', ...[...packs].sort()]
    .map((f) => `  <link rel="stylesheet" href="${AURORA.cdn}${f}">`)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="es" data-nz-theme="light"${marca ? ` data-nz-marca="${escapar(marca)}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo || contenido.empresa || 'Landing page')}</title>
${enlaces}
  <!-- la marca va DESPUÉS de tokens: misma especificidad, gana la última regla -->
  <link rel="stylesheet" href="/marca/${escapar(marca || 'aurora')}.css${marcaColor ? `?c=${encodeURIComponent(marcaColor)}&a=${encodeURIComponent(marcaAcento || '')}` : ''}">
  <style>
    /* El acordeón del sistema no trae indicador de apertura: el icono gira. */
    .nz-preguntas-frecuentes__pregunta { justify-content: space-between; }
    .nz-preguntas-frecuentes__pregunta .nz-icon { transition: transform .2s ease; }
    .nz-preguntas-frecuentes__item[open] .nz-preguntas-frecuentes__pregunta .nz-icon { transform: rotate(180deg); }
  </style>
</head>
<body class="nz">
${cuerpo}

<footer class="nz-footer nz-footer--compact">
  <div class="nz-container">
    ${escapar(contenido.empresa || '')}${contenido.empresa ? ' · ' : ''}${ATRIBUCION}
  </div>
</footer>
</body>
</html>`;

  return { html, bloques: usados, packs: [...packs], plantilla, nombrePlantilla: plan.nombre };
}

// Página de error de la fase de generación (nunca un 500 en blanco)
export function paginaError({ titulo, texto, detalle }) {
  return `<!DOCTYPE html>
<html lang="es" data-nz-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
  <link rel="stylesheet" href="${AURORA.cdn}tokens.css">
  <link rel="stylesheet" href="${AURORA.cdn}packs/p1-layout.css">
  <link rel="stylesheet" href="${AURORA.cdn}packs/p3-typography.css">
  <link rel="stylesheet" href="${AURORA.cdn}packs/p4-actions.css">
  <link rel="stylesheet" href="${AURORA.cdn}packs/p6-feedback.css">
</head>
<body class="nz">
<main class="nz-container nz-stack" style="padding-block:var(--nz-space-16)">
  <span class="nz-eyebrow">Vista de ejemplo</span>
  <h1 class="nz-h2">${escapar(titulo)}</h1>
  <p class="nz-lead">${escapar(texto)}</p>
  <div class="nz-alert nz-alert--warning">
    <div class="nz-alert__body">
      <span class="nz-alert__title">La IA no llegó a responder</span>
      <span class="nz-alert__msg">${escapar(detalle || 'Vuelve a intentarlo en unos segundos: esta vista usa un diseño de ejemplo para que puedas seguir probando la app.')}</span>
    </div>
  </div>
</main>
<footer class="nz-footer nz-footer--compact">${ATRIBUCION}</footer>
</body>
</html>`;
}
