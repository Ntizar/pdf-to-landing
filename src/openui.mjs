// ─────────────────────────────────────────────────────────────────────────────
// openui.mjs — Compilador de openui-lang a HTML de Aurora, en Node.
//
// El repositorio de Aurora trae un runtime en navegador (`openui/aurora-openui.js`)
// que es un IIFE: se cuelga de `window` y su `iniciar()` pide la spec por fetch.
// Aquí se carga tal cual, en un contexto controlado, con dos inyecciones:
//
//   · fetch  → devuelve la spec desde disco (sin red, determinista)
//   · import → rechaza, para forzar el PARSER LOCAL (el del propio runtime)
//
// Y se le llama con `pintar(programa, null)`: sin contenedor, no toca DOM y
// devuelve el HTML como cadena. Ni una clase fuera del censo: lo garantiza el
// runtime y lo comprueba `validarPrograma`.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { packsNecesarios } from './aurora.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_OPENUI = path.join(__dirname, 'openui');

const RUTA_RUNTIME = path.join(DIR_OPENUI, 'aurora-openui.js');
const RUTA_SPEC = path.join(DIR_OPENUI, 'aurora.spec.json');
const RUTA_COMPONENTES = path.join(DIR_OPENUI, 'componentes.json');

let runtime = null;
let spec = null;
let componentes = null;
let errorCarga = null;

// ── Carga del runtime en un contexto aislado ────────────────────────────────
function cargar() {
  if (runtime) return runtime;
  if (errorCarga) throw errorCarga;

  try {
    const codigo = fs.readFileSync(RUTA_RUNTIME, 'utf8');
    spec = JSON.parse(fs.readFileSync(RUTA_SPEC, 'utf8'));

    // El `fetch` del runtime solo pide la spec: se la servimos de memoria.
    const fetchFalso = async (url) => ({
      ok: true,
      status: 200,
      json: async () => spec,
    });

    const sandbox = {
      fetch: fetchFalso,
      // `import()` del lang-core oficial: no hay red en el contenedor, así que
      // cae al parser local del propio runtime (mismo subconjunto del lenguaje).
      import: async () => { throw new Error('sin CDN: parser local'); },
      console,
      setTimeout,
      clearTimeout,
      Promise,
      JSON,
      Math,
      Date,
      Object,
      Array,
      String,
      Number,
      Boolean,
      isFinite,
      parseFloat,
      parseInt,
      document: undefined,
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(codigo, sandbox, { filename: 'aurora-openui.js' });

    if (!sandbox.AuroraOpenUI) throw new Error('el runtime no expuso AuroraOpenUI');
    runtime = sandbox.AuroraOpenUI;
    return runtime;
  } catch (err) {
    errorCarga = new Error('No se pudo cargar el runtime de OpenUI: ' + err.message);
    throw errorCarga;
  }
}

// Arranque perezoso: la primera compilación inicializa parser y spec.
let arrancado = null;
export async function iniciar() {
  if (arrancado) return arrancado;
  const rt = cargar();
  arrancado = await rt.iniciar({ parser: 'local' });
  return arrancado;
}

export function estaListo() {
  return Boolean(runtime) && Boolean(arrancado);
}

export function modo() {
  return runtime ? runtime.modo : 'sin-cargar';
}

// ── Catálogo de componentes (para el prompt y para validar) ─────────────────
export function catalogo() {
  if (componentes) return componentes;
  try {
    const crudo = JSON.parse(fs.readFileSync(RUTA_COMPONENTES, 'utf8'));
    const lista = crudo.componentes || crudo.components || [];
    componentes = lista.map((c) => ({
      nombre: c.nombre,
      grupo: c.grupo || '',
      firma: c.firma || '',
      descripcion: c.descripcion || '',
      clases: c.clases || [],
    }));
    return componentes;
  } catch {
    componentes = [];
    return componentes;
  }
}

export function plantillas() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR_OPENUI, 'plantillas', 'index.json'), 'utf8'));
  } catch {
    return [];
  }
}

// ── Compilación ─────────────────────────────────────────────────────────────
// Devuelve { html, ok, errores, sentencias, componentes, nodos, modo }
export async function compilar(programa) {
  await iniciar();
  const rt = cargar();
  const texto = String(programa || '').trim();
  if (!texto) return { ok: false, html: '', errores: ['el programa está vacío'], sentencias: 0, componentes: {}, nodos: 0, modo: rt.modo };

  let salida;
  try {
    // null como contenedor: no toca DOM, devuelve el HTML
    salida = rt.pintar(texto, null, { streaming: false });
  } catch (err) {
    return { ok: false, html: '', errores: ['no se pudo pintar: ' + err.message], sentencias: 0, componentes: {}, nodos: 0, modo: rt.modo };
  }

  const errores = (salida.errores || []).map((e) => (typeof e === 'string' ? e : e.mensaje || e.message || JSON.stringify(e)));
  const html = salida.html || '';
  // Un programa que solo pinta el marco vacío no es una página
  const sinContenido = !/nz-(h1|h2|h3|prose|lead)/.test(html);
  if (sinContenido && !errores.length) errores.push('el programa no produce contenido visible (solo el marco)');

  return {
    ok: errores.length === 0 && html.length > 0,
    html,
    errores,
    sentencias: salida.sentencias || 0,
    componentes: salida.componentes || {},
    nodos: salida.nodos || 0,
    modo: salida.modo || rt.modo,
  };
}

// ── Validación del programa ANTES de compilar ───────────────────────────────
// Barato y determinista: nombres de componente que no existen, argumentos con
// nombre (la sintaxis no existe y rompe el programa) y falta de `root`.
export function validarPrograma(programa) {
  const texto = String(programa || '');
  const fallos = [];
  const conocidos = new Set(catalogo().map((c) => c.nombre));

  if (!/^\s*root\s*=/m.test(texto)) fallos.push('falta la sentencia `root = Pagina([...])`');

  // Las llamadas son `Nombre(` al principio de una expresión o tras separador.
  const llamadas = [...texto.matchAll(/(?:^|[\s=,([:])([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9]*)\s*\(/gm)].map((m) => m[1]);
  const desconocidos = [...new Set(llamadas.filter((n) => !conocidos.has(n)))];
  // Pagina, Pila… están en el catálogo; cualquier otro CamelCase es sospechoso
  if (desconocidos.length) fallos.push('componentes que no existen: ' + desconocidos.join(', '));

  // Argumentos con nombre (`Kpi(etiqueta: "x")`) no existen en el lenguaje
  if (/\(\s*[a-zA-Z_][\w]*\s*:/.test(texto) || /,\s*[a-zA-Z_][\w]*\s*:/.test(texto)) {
    fallos.push('argumentos con nombre: los argumentos son POSICIONALES');
  }
  // Markdown colado
  if (/```/.test(texto)) fallos.push('el programa trae bloques de markdown');
  if (/<\w+[^>]*>/.test(texto)) fallos.push('el programa trae HTML; debe ser solo openui-lang');

  return { ok: fallos.length === 0, fallos };
}

// ── Firmas de la spec: para validar argumentos posicionales ─────────────────
// La spec trae $defs con properties (en orden), enum, required y tipo. Con eso
// se comprueba cada llamada: nº de argumentos, obligatorios y valores de enum.
// una barra invertida, sin pelearse con los escapes de la cadena
const BARRA = String.fromCharCode(92);
const SALTO = String.fromCharCode(10);
let firmasCache = null;
export function firmas() {
  if (firmasCache) return firmasCache;
  cargar();
  const defs = (spec && spec.schema && spec.schema.$defs) || {};
  const salida = {};
  for (const [nombre, def] of Object.entries(defs)) {
    const props = def.properties || {};
    salida[nombre] = {
      orden: Object.keys(props),
      props,
      required: def.required || [],
    };
  }
  firmasCache = salida;
  return salida;
}

// Parte los argumentos de una llamada por comas de nivel 1.
function partirArgs(texto) {
  const args = [];
  let actual = '';
  let nivel = 0;
  let comilla = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) {
      actual += c;
      if (c === BARRA && i + 1 < texto.length) { actual += texto[++i]; continue; }
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'") { comilla = c; actual += c; continue; }
    if (c === '(' || c === '[' || c === '{') { nivel++; actual += c; continue; }
    if (c === ')' || c === ']' || c === '}') { nivel--; actual += c; continue; }
    if (c === ',' && nivel === 0) { args.push(actual.trim()); actual = ''; continue; }
    actual += c;
  }
  if (actual.trim()) args.push(actual.trim());
  return args;
}

// Extrae las llamadas de un programa: { nombre, args, linea, texto }
export function llamadas(programa) {
  const texto = String(programa || '');
  const salida = [];
  const re = /([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9]*)\s*\(/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const nombre = m[1];
    const abre = m.index + m[0].length - 1;
    // recorrer hasta el paréntesis que cierra, respetando strings y anidamiento
    let nivel = 0;
    let comilla = null;
    let i = abre;
    for (; i < texto.length; i++) {
      const c = texto[i];
      if (comilla) {
        if (c === BARRA) { i++; continue; }
        if (c === comilla) comilla = null;
        continue;
      }
      if (c === '"' || c === "'") { comilla = c; continue; }
      if (c === '(') nivel++;
      else if (c === ')') { nivel--; if (nivel === 0) break; }
    }
    const interior = texto.slice(abre + 1, i);
    const linea = texto.slice(0, m.index).split(SALTO).length;
    salida.push({ nombre, args: partirArgs(interior), linea, texto: texto.slice(m.index, i + 1) });
    re.lastIndex = i;
  }
  return salida;
}

// Valida los argumentos de cada llamada contra la spec.
export function validarArgumentos(programa) {
  const f = firmas();
  const errores = [];
  for (const c of llamadas(programa)) {
    const firma = f[c.nombre];
    if (!firma) continue; // el nombre ya lo caza validarPrograma
    const max = firma.orden.length;
    if (c.args.length > max) {
      errores.push(`línea ${c.linea}: ${c.nombre} admite ${max} argumento(s) y recibe ${c.args.length}`);
      continue;
    }
    for (const req of firma.required) {
      const pos = firma.orden.indexOf(req);
      if (pos >= 0 && c.args.length <= pos) {
        errores.push(`línea ${c.linea}: a ${c.nombre} le falta el argumento obligatorio «${req}» (posición ${pos + 1})`);
      }
    }
    // enums: un valor fuera de la lista pinta una clase que no existe (.nz-btn--true)
    c.args.forEach((arg, idx) => {
      const prop = firma.props[firma.orden[idx]];
      if (!prop) return;

      // ── tipos (no dependen de que haya enum) ──────────────────────────────
      // Un array esperado que recibe un literal se PINTA como contenido
      // (bug real: DosColumnas([...], "60-40") enseñaba «60-40» en la página).
      const esLista = arg.startsWith('[');
      const esIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(arg);
      const esLiteral = /^["']/.test(arg);
      if (prop.type === 'array' && !esLista && !esIdent) {
        errores.push(`línea ${c.linea}: ${c.nombre} «${firma.orden[idx]}» espera una lista [...] y recibe ${arg.slice(0, 24)}`);
        return;
      }
      if (prop.type === 'string' && esLista) {
        errores.push(`línea ${c.linea}: ${c.nombre} «${firma.orden[idx]}» espera un texto y recibe una lista`);
        return;
      }
      if (!prop.enum) return;
      const literal = esLiteral ? arg.match(/^["'](.*)["']$/) : null;
      if (literal) {
        if (!prop.enum.includes(literal[1])) {
          errores.push(`línea ${c.linea}: ${c.nombre} «${firma.orden[idx]}» = "${literal[1]}" no es válido (usa ${prop.enum.map((e) => `"${e}"`).join(' | ')})`);
        }
      } else if (/^(true|false)$/.test(arg)) {
        errores.push(`línea ${c.linea}: ${c.nombre} «${firma.orden[idx]}» espera ${prop.enum.map((e) => `"${e}"`).join(' | ')} y recibe ${arg} — los opcionales se rellenan desde el principio, no se saltan`);
      }

    });
  }
  return errores;
}

// Reparación determinista del error más común: un booleano en la posición de un
// enum (el modelo se salta el opcional intermedio). Se rellena el hueco con el
// primer valor del enum y el booleano se corre a su sitio.
export function repararPrograma(programa) {
  const f = firmas();
  const cambios = [];
  let salida = String(programa || '');
  for (const c of llamadas(programa).reverse()) {
    const firma = f[c.nombre];
    if (!firma) continue;
    const nuevos = [...c.args];
    let tocado = false;
    for (let idx = 0; idx < nuevos.length; idx++) {
      const prop = firma.props[firma.orden[idx]];
      if (!prop) break;
      if (prop.enum && /^(true|false)$/.test(nuevos[idx])) {
        nuevos.splice(idx, 0, `"${prop.enum[0]}"`);
        tocado = true;
      }
    }
    // booleanos entrecomillados: Tarjeta(..., "true") pinta nz-article--true
    for (let idx = 0; idx < nuevos.length; idx++) {
      const prop = firma.props[firma.orden[idx]];
      if (prop && prop.type === 'boolean') {
        const lit = nuevos[idx].match(/^["'](true|false)["']$/);
        if (lit) { nuevos[idx] = lit[1]; tocado = true; }
      }
    }
    if (tocado) {
      const reemplazo = `${c.nombre}(${nuevos.join(', ')})`;
      salida = salida.slice(0, salida.indexOf(c.texto)) + reemplazo + salida.slice(salida.indexOf(c.texto) + c.texto.length);
      cambios.push(`línea ${c.linea}: ${c.nombre} con un opcional saltado`);
    }
  }
  return { programa: salida, cambios };
}

// ── Presupuesto de color ────────────────────────────────────────────────────
// El modelo tiende a poner tono de color en todo (9 de marca y 5 de acento en una
// prueba real), y el auditor lo canta: la doctrina de Aurora es que el acento
// marca el dato que importa y la marca hace la estructura. Se ajusta en el
// PROGRAMA (no en el HTML): el primero de cada tipo conserva el tono y el resto
// se degrada. Determinista y sin tocar el diseño que el modelo eligió.
export function ajustarPresupuestoColor(programa) {
  const cambios = [];
  let salida = String(programa || '');
  const f = firmas();
  const TONOS_COLOR = ['marca', 'acento', 'exito', 'peligro', 'aviso', 'primario', 'info', 'success', 'warning', 'danger'];

  // Para cada componente se busca un tono "apagado" que EXISTA en su enum.
  // (Cifra no tiene neutro: si no hay valor válido, no se toca — mejor dejarlo
  // que romper el programa.)
  const APAGADOS = ['neutro', 'contorno', 'fantasma', 'suave'];
  function tonoApagado(comp, pos) {
    const firma = f[comp];
    if (!firma) return null;
    const prop = firma.props[firma.orden[pos]];
    if (!prop || !prop.enum) return null;
    return APAGADOS.find((v) => prop.enum.includes(v)) || null;
  }

  // (comp, posición del tono, cuántos conservan color)
  const REGLAS = [
    ['Kpi', 4, 1], ['Etiqueta', 1, 2], ['Chip', 1, 2], ['Cifra', 1, 2], ['Boton', 1, 2],
    ['Titular', 2, 1], ['Entradilla', 2, 1],
  ];
  for (const [comp, pos, max] of REGLAS) {
    const apagado = tonoApagado(comp, pos);
    const llamadasComp = llamadas(salida).filter((c) => c.nombre === comp).reverse();
    let conColor = 0;
    for (const c of llamadasComp) {
      const arg = c.args[pos];
      if (arg === undefined) continue;
      const lit = arg.match(/^["'](.*)["']$/);
      if (!lit || !TONOS_COLOR.includes(lit[1])) continue;
      conColor++;
      if (conColor <= max) continue;
      const nuevos = [...c.args];
      let nota;
      if (apagado) {
        nuevos[pos] = `"${apagado}"`;
        nota = `→ «${apagado}»`;
      } else if (pos === c.args.length - 1) {
        // sin tono apagado en su enum, pero el tono es el último argumento:
        // se quita y el componente queda en su tono por defecto
        nuevos.pop();
        nota = '→ sin tono';
      } else {
        continue; // no se puede apagar sin romper el programa
      }
      const reemplazo = `${c.nombre}(${nuevos.join(', ')})`;
      const i = salida.indexOf(c.texto);
      if (i >= 0) {
        salida = salida.slice(0, i) + reemplazo + salida.slice(i + c.texto.length);
        cambios.push(`línea ${c.linea}: ${c.nombre} «${lit[1]}» ${nota}`);
      }
    }
  }
  return { programa: salida, cambios };
}

// ── Página completa alrededor del programa ──────────────────────────────────
// `pintar` devuelve SOLO el contenido. El documento (tokens, packs, marca, tema,
// pie) lo pone esto, igual que en el modo de bloques fijos.
export function documento({ contenido, marca, marcaColor, marcaAcento, tema = 'light', titulo, packs }) {
  const base = 'https://cdn.jsdelivr.net/gh/Ntizar/Aurora@v10.1.0/';
  const lista = ['tokens.css', ...(packs || [])].map((f) => `  <link rel="stylesheet" href="${base}${f}">`).join('\n');
  const marcaLink = marca ? marca : 'aurora';
  const query = marcaColor ? `?c=${encodeURIComponent(marcaColor)}&a=${encodeURIComponent(marcaAcento || '')}` : '';
  return `<!DOCTYPE html>
<html lang="es" data-nz-theme="${tema}"${marcaLink ? ` data-nz-marca="${marcaLink}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo || 'Landing page')}</title>
${lista}
  <!-- la marca va DESPUÉS de tokens: misma especificidad, gana la última regla -->
  <link rel="stylesheet" href="/marca/${marcaLink}.css${query}">
</head>
<body class="nz">
${contenido}
<footer class="nz-footer nz-footer--compact">
  <div class="nz-container">Hecho con ❤️ por David Antizar</div>
</footer>
</body>
</html>`;
}

export function escapar(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Packs que necesita una página de OpenUI.
//
// Al principio esto era un mapa a mano componente→pack y se equivocaba: `Nota`
// apuntaba a p17 cuando su clase vive en p6, y el auditor lo cazó en la primera
// prueba real. Los packs se derivan del HTML ya compilado con el censo del
// sistema: si una clase existe, su pack se enlaza; si no, no se enlaza.
export function packsDe(htmlOComponentes, posibleHtml) {
  const html = typeof htmlOComponentes === 'string' ? htmlOComponentes : posibleHtml || '';
  return [...packsNecesarios(html)].sort();
}
