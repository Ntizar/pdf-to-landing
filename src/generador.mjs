// ─────────────────────────────────────────────────────────────────────────────
// generador.mjs — La IA escribe CONTENIDO; el diseño lo decide Aurora.
//
// Lo que se aprendió midiendo con qwen3.6:
//  · Pedirle el HTML entero daba páginas que "parecían hechas por una IA".
//    Pedirle solo los textos, y montar el HTML con objetos reales del sistema,
//    da una landing que pasa el lint de Aurora sin discusión.
//  · qwen3.6 devuelve su razonamiento en `reasoning_content`. Si se queda sin
//    tokens, `content` llega a null y el usuario ve una página en blanco.
//    Por eso: enable_thinking:false (medido: 6× menos tokens) + presupuesto
//    holgado + reintento con la salida limpia.
// ─────────────────────────────────────────────────────────────────────────────
import { renderizar, PLANTILLAS } from './bloques.mjs';
import { generarMarca } from './marca.mjs';

const API = 'https://api.nan.builders/v1/chat/completions';
const MODELO = process.env.NAN_MODELO || 'qwen3.6';

// ── Iconos que el modelo puede pedir (del sprite real de Aurora) ─────────────
export const ICONOS = [
  ['111-documento', 'documento, ficha, presupuesto'],
  ['041-descargar', 'descarga, exportar, salida'],
  ['159-imagen', 'imagen, foto, galería'],
  ['168-movil', 'móvil, app, desde el teléfono'],
  ['167-pantalla', 'pantalla, software, panel'],
  ['222-destellos', 'novedad, IA, novedad brillante'],
  ['277-formas', 'diseño, formas, creatividad'],
  ['266-tipografia', 'tipografía, marca, textos'],
  ['120-caja', 'producto, paquete, almacén'],
  ['023-rejilla', 'rejilla, catálogo, tabla'],
  ['056-estrella', 'calidad, valoración, destacado'],
  ['057-corazon', 'cuidado, trato cercano'],
  ['113-archivo-validado', 'verificado, cumplimiento, garantía'],
  ['064-llave', 'acceso, llave, seguridad'],
  ['107-capas', 'capas, integración, servicios'],
  ['202-tarjeta', 'pago, tarjeta, precio'],
  ['051-enlace', 'enlace, integración, conexión'],
  ['273-paleta', 'color, personalización'],
  ['126-libro-abierto', 'formación, curso, documentación'],
  ['067-ajustes', 'configuración, ajustes'],
  ['026-ajustes-rapidos', 'rápido, ágil, automatización'],
  ['291-cohete', 'lanzamiento, crecimiento, rapidez'],
];

// ── Llamada al modelo ────────────────────────────────────────────────────────
async function chat(token, { sistema, usuario, maxTokens = 4000, temperatura = 0.4 }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: MODELO,
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
      max_tokens: maxTokens,
      temperature: temperatura,
      // sin esto qwen3.6 se gasta el presupuesto razonando y devuelve content:null
      enable_thinking: false,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API NaN ${res.status}: ${err.slice(0, 180)}`);
  }
  const datos = await res.json();
  const msg = datos.choices?.[0]?.message || {};
  const razon = msg.reasoning_content || '';
  let texto = msg.content;
  if ((texto === null || texto === undefined || texto === '') && razon) texto = razon;
  texto = String(texto || '');
  // limpieza sin regex (los backslashes de regex se escriben mal y rompen el parseo)
  const abre = texto.indexOf('<think>');
  const cierra = texto.indexOf('</think>');
  if (abre >= 0 && cierra > abre) texto = texto.slice(0, abre) + texto.slice(cierra + 8);
  texto = texto.trim();
  return { texto, razon: razon.length, tokens: datos.usage || {} };
}

function extraerJson(texto) {
  const abre = texto.indexOf('{');
  const cierra = texto.lastIndexOf('}');
  if (abre < 0 || cierra <= abre) throw new Error('La IA no devolvió un JSON: ' + texto.slice(0, 160));
  return JSON.parse(texto.slice(abre, cierra + 1));
}

// ── Paletas deterministas desde los colores reales del PDF ───────────────────
const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16));
const luminancia = (hex) => {
  const [r, g, b] = aRgb(hex).map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const saturacion = (hex) => {
  const [r, g, b] = aRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};
const distancia = (a, b) => {
  const [r1, g1, b1] = aRgb(a);
  const [r2, g2, b2] = aRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

// Devuelve hasta 3 paletas (marca + acento) a partir de los colores del PDF.
//
// La heurística ingenua (ordenar por saturación) fallaba con un caso real:
// un PDF con tres verdes y un naranja elegía el naranja como marca. Lo que
// identifica la marca es la FAMILIA DE MATIZ que más aparece, no el color más
// chillón. El acento es el que está más lejos en el círculo de color.
const matiz = (hex) => {
  const [r, g, b] = aRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null; // gris: no tiene matiz
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return (h + 360) % 360;
};

const distMatiz = (a, b) => {
  if (a === null || b === null) return 180;
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const esUtil = (hex) => {
  const l = luminancia(hex);
  return l > 0.015 && l < 0.92;
};

export function proponerPaletas(colores) {
  const validos = (colores || [])
    .map((c) => String(c.hex || c).toLowerCase())
    .filter((h) => /^#[0-9a-f]{6}$/.test(h))
    .filter((h, i, a) => a.indexOf(h) === i)
    .filter(esUtil);

  const paletas = [];
  const firma = (m, a) => `${m.toLowerCase()}|${a.toLowerCase()}`;
  const yaEsta = (m, a) => paletas.some((p) => firma(p.marca, p.acento) === firma(m, a));

  if (validos.length) {
    // familias de matiz: se agrupan los que están a menos de 30° entre sí
    const familias = [];
    for (const hex of validos) {
      const h = matiz(hex);
      const fam = familias.find((f) => distMatiz(f.h, h) < 30);
      if (fam) { fam.colores.push(hex); if (fam.h === null) fam.h = h; }
      else familias.push({ h, colores: [hex] });
    }
    // la familia dominante pesa por número de colores y por saturación
    familias.forEach((f) => {
      f.peso = f.colores.length * 2 + f.colores.reduce((s, c) => s + saturacion(c), 0);
      f.representante = f.colores.slice().sort((a, b) => {
        // el representante es el más saturado sin ser ni casi negro ni casi blanco
        const va = saturacion(a) * (1 - Math.abs(luminancia(a) - 0.5));
        const vb = saturacion(b) * (1 - Math.abs(luminancia(b) - 0.5));
        return vb - va;
      })[0];
    });
    familias.sort((a, b) => b.peso - a.peso);

    const dom = familias[0];
    if (dom) {
      // acento: primero el más lejano en matiz; si no hay, el más contrastado en luz
      const resto = validos.filter((c) => c !== dom.representante);
      let acento = resto.slice().sort((a, b) => distMatiz(matiz(b), dom.h) - distMatiz(matiz(a), dom.h))[0];
      const lejano = acento && distMatiz(matiz(acento), dom.h) > 40;
      if (!lejano) {
        acento = resto.slice().sort((a, b) => Math.abs(luminancia(b) - luminancia(dom.representante)) - Math.abs(luminancia(a) - luminancia(dom.representante)))[0];
      }
      añadir('marca', dom.representante, acento);

      // alterna: intercambia los papeles
      if (acento && distMatiz(matiz(acento), dom.h) > 40) añadir('alterna', acento, dom.representante);

      // sobria: la familia secundaria como marca (más matices, menos ruido)
      const seg = familias[1];
      if (seg) añadir('sobria', seg.representante, dom.representante);
    }
  }

  function añadir(nombre, marca, acento) {
    const m = String(marca || '').match(/^#[0-9a-f]{6}$/) ? marca : '#2563eb';
    let ac = String(acento || '').match(/^#[0-9a-f]{6}$/) ? acento : '#f97316';
    if (distancia(m, ac) < 70) ac = luminancia(m) > 0.5 ? '#0f172a' : '#f97316';
    if (distancia(m, ac) < 55 || yaEsta(m, ac)) return;
    const g = generarMarca(nombre, m, ac);
    if (yaEsta(g.marca, g.acento)) return;
    paletas.push({
      nombre,
      marca: g.marca,
      acento: g.acento,
      etiqueta: `${g.marca} · ${g.acento}`,
      contraste: g.contraste,
      ajustada: g.ajustada,
      descripcion: `${descripcionPaleta(nombre)}${g.ajustada ? ' (ajustada a AA)' : ''}`,
    });
  }

  // Completar con paletas del sistema: el usuario siempre tiene tres opciones
  for (const [nombre, m, a] of [
    ['aurora', '#2563eb', '#f97316'],
    ['esmeralda', '#00875e', '#f59e0b'],
    ['violeta', '#7c3aed', '#ec4899'],
    ['carmesi', '#dc2626', '#0891b2'],
    ['ntizar', '#0057ff', '#ff6a00'],
    ['pizarra', '#334155', '#b45309'],
  ]) {
    if (paletas.length >= 3) break;
    const g = generarMarca(nombre, m, a);
    if (yaEsta(g.marca, g.acento)) continue;
    paletas.push({
      nombre,
      marca: g.marca,
      acento: g.acento,
      etiqueta: `${g.marca} · ${g.acento}`,
      contraste: g.contraste,
      ajustada: g.ajustada,
      descripcion: `Paleta ${nombre} del sistema`,
    });
  }
  return paletas.slice(0, 3);
}

function descripcionPaleta(nombre) {
  if (nombre === 'marca') return 'El color dominante del PDF como marca';
  if (nombre === 'alterna') return 'Intercambia marca y acento';
  return 'El tono más oscuro como marca';
}

// ── Análisis del PDF (la IA lee, no diseña) ──────────────────────────────────
const SISTEMA_ANALISIS = `Eres un consultor que lee propuestas de diseño web y las resume en datos.
Devuelves SOLO un JSON válido, sin markdown ni backticks, con esta forma exacta:
{
  "empresa": "nombre exacto como aparece en el documento",
  "sector": "sector en 3-6 palabras",
  "publico": "a quién va dirigido, en 1 frase",
  "tono": "formal|informal|creativo|corporativo|minimalista|audaz",
  "titulo_hero": "el titular más potente del documento, tal cual o mejorado",
  "subtitulo_hero": "una frase que explica qué hacen y para quién",
  "cta": "el texto del botón principal (2-4 palabras)",
  "plantilla": "clasica|editorial|producto|evento|catalogo",
  "secciones": ["hero","ventajas",...],
  "datos_clave": ["cifras o hechos concretos que aparecen en el documento"],
  "aviso": "algo que la IA NO debe inventar porque no está en el documento"
}
REGLAS:
1. NO inventes datos: si algo no está, deja la cadena vacía.
2. Elige la plantilla por el tipo de negocio: "catalogo" para estudio/taller/arquitectura/interiorismo; "producto" para SaaS o app; "evento" para congreso, curso o jornada; "editorial" para marca personal, despacho, abogado o consultor; "clasica" para servicios locales (clínica, restaurante, taller mecánico).
3. Todo en castellano. Nada de emojis.`;

export async function analizar({ token, texto, nombreFichero, colores }) {
  const paletas = proponerPaletas(colores);
  const infoColor = (colores || []).length
    ? `\n\nColores reales extraídos del PDF (por orden de presencia): ${colores.map((c) => c.hex || c).join(', ')}`
    : '';
  const { texto: salida, tokens } = await chat(token, {
    sistema: SISTEMA_ANALISIS,
    usuario: `Analiza esta propuesta de diseño web (archivo: ${nombreFichero}).\n\n--- TEXTO DEL DOCUMENTO ---\n${texto.slice(0, 7000)}${infoColor}`,
    maxTokens: 2500,
  });
  const datos = extraerJson(salida);
  if (datos.plantilla && !PLANTILLAS[datos.plantilla]) datos.plantilla = 'clasica';
  datos.plantilla = datos.plantilla || 'clasica';
  return { design: datos, paletas, tokens, pedidoLLM: true };
}

// ── Contenido de la landing (aquí es donde la IA aporta de verdad) ───────────
const listaIconos = ICONOS.map(([n, d]) => `${n} (${d})`).join(' · ');

const SISTEMA_CONTENIDO = `Escribes el CONTENIDO de una landing page en castellano. NO escribes HTML ni CSS:
el diseño lo pone el sistema con objetos ya probados. Tú solo rellenas textos.
Devuelves SOLO un JSON válido (sin markdown) con los bloques que tenga sentido usar:
{
  "empresa": "nombre de la empresa",
  "cta": "texto del botón principal",
  "enlaces": ["3 o 4 enlaces de menú, una palabra cada uno"],
  "hero": { "eyebrow": "categoría corta en mayúsculas naturales", "titulo": "titular potente, máx 8 palabras", "subtitulo": "1-2 frases concretas", "cta_secundario": "enlace secundario, 2-3 palabras", "dato_hero": "un dato de confianza corto" },
  "ventajas": { "titulo": "...", "entradilla": "una frase", "items": [ { "icono": "nombre-de-la-lista", "titulo": "máx 5 palabras", "descripcion": "1-2 frases concretas" } ] },
  "cifras": { "titulo": "...", "items": [ { "etiqueta": "...", "valor": "cifra corta", "nota": "contexto breve" } ] },
  "lista": { "titulo": "...", "entradilla": "...", "items": ["servicio o punto, máx 10 palabras"] },
  "pasos": { "titulo": "...", "items": [ { "titulo": "máx 4 palabras", "descripcion": "1 frase" } ] },
  "galeria": { "titulo": "...", "items": [ { "titulo": "nombre de la pieza", "pie": "detalle corto" } ] },
  "precios": { "titulo": "...", "items": [ { "nombre": "...", "descripcion": "...", "precio": "19 €", "periodo": "/mes", "caracteristicas": ["3 o 4 puntos cortos"], "cta": "2 palabras" } ] },
  "ficha": { "titulo": "...", "items": [ { "etiqueta": "...", "valor": "..." } ] },
  "testimonio": { "texto": "una cita creíble de 1-2 frases", "autor": "nombre y apellido", "cargo": "rol o relación con la empresa" },
  "faq": { "titulo": "...", "items": [ { "pregunta": "...", "respuesta": "2-3 frases útiles" } ] },
  "contacto": { "titulo": "...", "items": [ { "etiqueta": "Dirección|Teléfono|Horario|Correo", "valor": "..." } ] },
  "nota": { "titulo": "...", "texto": "aviso breve" },
  "cta_final": { "eyebrow": "una frase corta", "titulo": "máx 7 palabras", "texto": "1-2 frases", "cta": "2-3 palabras" }
}
ICONOS DISPONIBLES (usa exactamente estos nombres): ${listaIconos}.
REGLAS:
1. Castellano, tuteo, concreto. Cero emojis. Nada de "soluciones innovadoras", "líderes del sector", "revoluciona tu negocio" ni promesas vacías.
2. NO inventes cifras, premios, clientes ni testimonios reales: si el documento no los trae, usa cifras plausibles y redondas del sector o deja el bloque fuera. Mejor un bloque menos que un dato falso.
3. Usa los datos del análisis que te doy: respeta nombre, sector, público y tono.
4. Frases cortas. Cada descripcion, una idea.
5. Deja fuera los bloques que no aporten al negocio; cuanto más concreto, mejor.
6. En "precios", si el documento no trae precios, no los inventes: omite el bloque.`;

export async function generarContenido({ token, design, texto, plantilla }) {
  const plan = PLANTILLAS[plantilla] || PLANTILLAS.clasica;
  const { texto: salida, razon, tokens } = await chat(token, {
    sistema: SISTEMA_CONTENIDO,
    usuario: `Datos del análisis:\n${JSON.stringify(design, null, 1)}\n\nFormato de web elegido: ${plan.nombre} — ${plan.descripcion}\nBloques que encajan en ese formato (priorízalos): ${plan.orden.filter((b) => b !== 'navegacion').join(', ')}\n\n--- EXTRACTO DEL DOCUMENTO ORIGINAL ---\n${String(texto || '').slice(0, 6000)}`,
    maxTokens: 6000,
    temperatura: 0.6,
  });
  const contenido = extraerJson(salida);
  return { contenido, razon, tokens };
}

// ── Cadena completa: contenido → HTML + variantes → lint ─────────────────────
export function componer({ contenido, design, paletas, plantilla }) {
  const plan = PLANTILLAS[plantilla] || PLANTILLAS.clasica;
  const contenidoFinal = { ...contenido };
  if (!contenidoFinal.empresa) contenidoFinal.empresa = design?.empresa || '';
  if (!contenidoFinal.cta) contenidoFinal.cta = design?.cta || 'Contactar';
  if (!contenidoFinal.hero && design?.titulo_hero) {
    contenidoFinal.hero = { eyebrow: design.sector, titulo: design.titulo_hero, subtitulo: design.subtitulo_hero, dato_hero: (design.datos_clave || [])[0] || '' };
  }

  const titulo = `${contenidoFinal.empresa || design?.empresa || 'Landing'} · ${design?.sector || plan.nombre}`;
  const base = {
    html: renderizar(contenidoFinal, { marca: paletas[0].nombre, titulo, plantilla }).html,
  };

  const variantes = paletas.map((p, i) => {
    // los colores van en la URL del CSS: si no, la vista previa de una paleta
    // generada del PDF se pintaba con el color por defecto del sistema
    const r = renderizar(contenidoFinal, { marca: p.nombre, marcaColor: p.marca, marcaAcento: p.acento, titulo, plantilla });
    return {
      id: p.nombre,
      etiqueta: p.etiqueta,
      descripcion: p.descripcion,
      esRecomendada: i === 0,
      html: r.html,
      bloques: r.bloques,
      packs: r.packs,
      marca: { nombre: p.nombre, color: p.marca, acento: p.acento, ajustada: p.ajustada },
      contraste: p.contraste,
    };
  });

  return { html: base.html, variantes, contenido: contenidoFinal, plantilla, nombrePlantilla: plan.nombre };
}

// Marca por defecto cuando no hay PDF: elige la mejor de las paletas propuestas
export function paletaDe(nombre) {
  return PALETAS_OFICIALES.find((p) => p.nombre === nombre) || PALETAS_OFICIALES[0];
}

export const PALETAS_OFICIALES = [
  { nombre: 'aurora', marca: '#2563eb', acento: '#f97316' },
  { nombre: 'indigo', marca: '#4f46e5', acento: '#06b6d4' },
  { nombre: 'esmeralda', marca: '#00875e', acento: '#f59e0b' },
  { nombre: 'violeta', marca: '#7c3aed', acento: '#ec4899' },
  { nombre: 'carmesi', marca: '#dc2626', acento: '#0891b2' },
  { nombre: 'ntizar', marca: '#0057ff', acento: '#ff6a00' },
  { nombre: 'pizarra', marca: '#334155', acento: '#b45309' },
  { nombre: 'cobalto', marca: '#1d4ed8', acento: '#c2410c' },
];

export { PLANTILLAS };
