// ─────────────────────────────────────────────────────────────────────────────
// openui-generador.mjs — El modelo escribe la web en openui-lang.
//
// Aquí está la diferencia de fondo con el modo de bloques fijos: el modelo NO
// elige entre cinco composiciones, COMPONE. Elige componentes, orden, jerarquía
// y densidad; el sistema garantiza que el CSS sea válido, accesible y del censo.
//
// El estilo no es cosmética: cambia las elecciones reales del modelo (densidad,
// jerarquía, cuánto dato, cuánto aire). Y el tema (claro/oscuro) y la marca
// (del PDF o del sistema) rematan la variedad.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  compilar, validarPrograma, validarArgumentos, repararPrograma, ajustarPresupuestoColor,
  documento, packsDe, catalogo, plantillas,
} from './openui.mjs';
import { validar as validarAurora } from './aurora.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://api.nan.builders/v1/chat/completions';
const MODELO = process.env.NAN_MODELO || 'qwen3.6';

function promptBase() {
  return fs.readFileSync(path.join(__dirname, 'openui', 'PROMPT.md'), 'utf8');
}


// Reglas de conversión: comunes a todos los estilos. Sin backticks para no
// pelearse con los template literals de los prompts.
const REGLAS_CONVERSION = [
  'La acción principal va en el HERO, siempre: el primer bloque tras la navegación',
  'lleva un Boton("<cta>", "primario") dentro de una Fila. Si el visitante tiene que',
  'bajar para encontrar cómo contactar, la página ha fallado.',
  'No dupliques el título: si usas Seccion([...], "Título"), dentro NO pongas otro',
  'Titular con el mismo texto — el de la sección ya es el titular.',
  'No repitas un dato en dos sitios: cada cifra aparece una vez, o en los Kpi o en el texto.',
  'El último bloque es el cierre: una frase y el botón otra vez.',
  // Bug real: el modelo puso Seccion(..., "Footer") y la palabra «Footer» salió
  // como titular visible en la página. Los títulos son contenido, no estructura.
  'NUNCA uses como título de sección una palabra de estructura: ni "Footer", ni "Header",',
  'ni "Contenido", ni "Sección", ni "Página". El pie ya lo pone el sistema: no escribas',
  'un bloque final que se llame así. Si una sección no tiene un título con contenido,',
  'pasa null o déjala sin título.',
  // Y todo en castellano, aunque el documento esté en inglés
  'Escribe TODO el contenido en castellano, aunque el documento original esté en inglés',
  'u otro idioma: se traduce el sentido, no se copian los titulares en inglés.',
  // Un párrafo a todo el ancho no se lee
  'REGLA DE PROSA: un Texto de más de dos frases NUNCA va suelto dentro de una',
  'Seccion. Va dentro de DosColumnas junto a una Lista o una Tarjeta, o dentro de',
  'una Tarjeta. Si no cumples esto, la línea ocupa 120 caracteres y no se lee.',
].join(' ');

// ── Estilos: el registro visual que pide el usuario ─────────────────────────
// Cada estilo empuja al modelo a decisiones distintas de verdad, no a un adjetivo.
export const ESTILOS = {
  corporativo: {
    nombre: 'Corporativo',
    descripcion: 'Sobrio y denso: mucho dato, jerarquía estricta, cero adorno.',
    instruccion: `ESTILO CORPORATIVO. Sobrio y denso, sin aire de más.
- Entra pronto en materia: la cabecera lleva los datos que importan (Kpi en Rejilla de 4 o "auto").
- Usa Tabla o TablaBarras para comparar. El visitante viene a decidir, no a pasear.
- Densidad compacta: Pila(..., "2xs") o "sm"; Seccion con borde=true.
- Titulares cortos y secos. Cero frases de marketing.
- Un solo Boton primario, al final de cada bloque que pida acción.`,
  },
  editorial: {
    nombre: 'Editorial',
    descripcion: 'Aire, titular grande y prosa. Para marca personal y despachos.',
    instruccion: `ESTILO EDITORIAL. Aire, tipografía grande, texto que se lee.
- El hero es un Titular("1") grande con Entradilla("lg") al lado derecho usando DosColumnas("60-40").
- Usa Lista("dividida") y Texto() para la prosa. Nada de Rejilla de 4 donde quepa DosColumnas.
- Densidad amplia: Pila(..., "lg") o "xl".
- Precios solo si son el argumento; si no, una Nota("marca") con la tarifa.
- Cero Kpi salvo que sean el corazón del negocio.`,
  },
  producto: {
    nombre: 'Producto',
    descripcion: 'Cifras arriba, planes en rejilla y prueba concreta.',
    instruccion: `ESTILO PRODUCTO. Es un SaaS o una app: el dato convence.
- Hero con Rejilla de 3-4 Kpi pegada al titular (encima o justo después).
- Una sección de tres Tarjeta en Rejilla("auto") con las capacidades, cada una con Lista o Texto.
- Precios: Rejilla("auto") de Tarjeta, una destacada con Etiqueta("acento") y su Boton primario.
- Cierra con Aviso("info") para la letra pequeña real y un Boton de prueba.
- Barras o MiniTendencia si hay una métrica de producto que enseñar.`,
  },
  calido: {
    nombre: 'Cálido',
    descripcion: 'Cercano y humano: menos dato, más trato y confianza.',
    instruccion: `ESTILO CÁLIDO. Cercano, de barrio, con nombre y apellidos.
- Tono de conversación en el Titular("1") y la Entradilla. Tutea.
- Las ventajas van en Tarjeta con Texto corto, no en Lista de bullets.
- Usa Nota("consejo") para la información de confianza (garantía, primera visita).
- Densidad equilibrada: Pila(..., "sm").
- Sin Kpi salvo uno o dos que sean prueba social (años, clientes).`,
  },
  tecnico: {
    nombre: 'Técnico',
    descripcion: 'Ficha y tabla: para ingeniería, laboratorio y B2B.',
    instruccion: `ESTILO TÉCNICO. Ficha, especificación y precisión.
- El hero lleva la especificación resumida en Tabla con apilable=true.
- Secciones con Tabla() para las características y Lista("num") para el procedimiento.
- Cifra() para unidades y tolerancias; MiniTendencia si hay serie.
- Densidad compacta y Seccion con borde=true.
- Cero adjetivos: solo lo que se puede medir.`,
  },
};

export const TEMAS = {
  claro: { nombre: 'Claro', valor: 'light', descripcion: 'Fondo blanco, para leer y para imprimir.' },
  oscuro: { nombre: 'Oscuro', valor: 'dark', descripcion: 'Fondo oscuro, para producto y pantalla.' },
};

// ── Llamada al modelo ──────────────────────────────────────────────────────
async function chat(token, { sistema, usuario, maxTokens = 6000, temperatura = 0.55 }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: MODELO,
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
      max_tokens: maxTokens,
      temperature: temperatura,
      // sin esto qwen3.6 se come el presupuesto razonando
      enable_thinking: false,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!res.ok) throw new Error(`API NaN ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  const m = d.choices?.[0]?.message || {};
  return { texto: String(m.content || '').trim(), tokens: d.usage || {} };
}

// Limpia el programa de lo que el modelo a veces añade igual
function limpiarPrograma(texto) {
  let t = String(texto || '').trim();
  t = t.split('```openui').join('').split('```').join('');
  const i = t.indexOf('root');
  if (i > 0) t = t.slice(i);
  return t.trim();
}

// ── Generación del programa ────────────────────────────────────────────────
export async function generarPrograma({ token, design, texto, estilo = 'producto', tema = 'claro', arquetipo = '' }) {
  const est = ESTILOS[estilo] || ESTILOS.producto;
  const temaValor = (TEMAS[tema] || TEMAS.claro).valor;
  const componentes = catalogo().map((c) => c.firma).join('\n');
  const plantilla = arquetipo && plantillas().find((p) => p.nombre === arquetipo);
  const pista = plantilla
    ? `\nTienes una plantilla auditada de este arquetipo («${plantilla.nombre}»). Úsala como esqueleto y cambia los datos:\n---\n${plantilla.programa}\n---`
    : '';

  const sistema = `${promptBase()}

## Contexto de esta generación
Vas a producir UNA landing page para el negocio de abajo, con openui-lang.
Responde SOLO con el programa completo: sin markdown, sin \`\`\`, sin explicaciones
antes ni después. La primera línea es \`root = Pagina([...])\`.
${pista}`;

  const usuario = `## Negocio
${JSON.stringify({
    empresa: design.empresa || '',
    sector: design.sector || '',
    publico: design.publico || '',
    tono: design.tono || '',
    propuesta: design.titulo_hero || '',
    subtitulo: design.subtitulo_hero || '',
    cta: design.cta || '',
    datos_clave: design.datos_clave || [],
  }, null, 1)}

## Material del documento original
${String(texto || '').slice(0, 5000)}

## Reglas de conversión (obligatorias)
${REGLAS_CONVERSION}

## Qué se te pide
${est.instruccion}

OBJETIVO: que el visitante haga una sola cosa — ${design.cta || 'contactar'}. Todo lo que no ayude a eso, sobra.
Escribe el programa openui-lang completo.`;

  const { texto: bruto, tokens } = await chat(token, { sistema, usuario });
  return { programa: limpiarPrograma(bruto), tokens };
}

// ── Corrección con feedback preciso ────────────────────────────────────────
export async function corregirPrograma({ token, programa, errores }) {
  const sistema = `${promptBase()}

## Corrección
El programa de abajo tiene errores. Devuelve el programa COMPLETO corregido.
Solo el programa: sin markdown, sin explicaciones. Primera línea \`root = Pagina([...])\`.`;
  const usuario = `Errores que hay que corregir:
${errores.map((e) => '- ' + e).join('\n')}

Programa a corregir:
${programa}`;
  const { texto, tokens } = await chat(token, { sistema, usuario, temperatura: 0.3, maxTokens: 6000 });
  return { programa: limpiarPrograma(texto), tokens };
}

// ── Cadena completa: programa → HTML verificado ────────────────────────────
// Devuelve { ok, html, programa, errores, intentos, componentes, packs, avisos }
export async function construir({ token, design, texto, estilo, tema, marca, arquetipo }) {
  const errores = [];
  let intentos = 0;
  let programa = '';
  // 'claro'/'oscuro' → 'light'/'dark' (los valores de data-nz-theme)
  const temaValor = (TEMAS[tema] || TEMAS.claro).valor;

  const intentar = async (prog) => {
    const vNombre = validarPrograma(prog);
    if (!vNombre.ok) return { ok: false, errores: vNombre.fallos };
    const vArgs = validarArgumentos(prog);
    if (vArgs.length) return { ok: false, errores: vArgs };
    const r = await compilar(prog);
    if (!r.ok) return { ok: false, errores: r.errores };
    // y el HTML resultante pasa el MISMO listón que el resto de la app
    const packs = packsDe(r.html);
    const pagina = documento({
      contenido: r.html, marca: marca?.nombre, marcaColor: marca?.marca,
      marcaAcento: marca?.acento, tema: temaValor, titulo: design?.empresa || 'Landing', packs,
    });
    const v = validarAurora(pagina);
    if (v.fallos.length) return { ok: false, errores: v.fallos, html: pagina, componentes: r.componentes, packs, avisos: v.avisos };
    return { ok: true, html: pagina, componentes: r.componentes, packs, avisos: v.avisos, nodos: r.nodos };
  };

  // 1) primera escritura
  let r = await generarPrograma({ token, design: design || {}, texto, estilo, tema, arquetipo });
  // el presupuesto de color se ajusta ANTES de compilar: es doctrina del sistema,
  // no un gusto. Y se hace sobre el programa, no parcheando el HTML.
  const pc = ajustarPresupuestoColor(r.programa);
  programa = pc.programa;
  const ajustesColor = pc.cambios;
  intentos++;
  let salida = await intentar(programa);
  if (salida.ok) salida.avisos = salida.avisos || [];

  // 2) una corrección con el error exacto + reparación mecánica del opcional saltado
  if (!salida.ok) {
    const rep = repararPrograma(programa);
    if (rep.cambios.length) {
      programa = rep.programa;
      salida = await intentar(programa);
    }
  }
  if (!salida.ok && token) {
    const c = await corregirPrograma({ token, programa, errores: salida.errores.slice(0, 8) });
    intentos++;
    const rep = repararPrograma(c.programa);
    programa = rep.cambios.length ? rep.programa : c.programa;
    salida = await intentar(programa);
  }

  return {
    ok: Boolean(salida.ok),
    html: salida.html || '',
    programa,
    errores: salida.ok ? [] : (salida.errores || ['no se pudo construir']).slice(0, 8),
    avisos: salida.avisos || [],
    componentes: salida.componentes || {},
    packs: salida.packs || [],
    nodos: salida.nodos || 0,
    intentos,
    ajustesColor,
  };
}

export { ESTILOS as estilos };
