import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware base ─────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Multer ─────────────────────────────────────────────────────
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, 'upload-' + Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Token ──────────────────────────────────────────────────────
function getNanToken() {
  if (process.env.NAN_API) return process.env.NAN_API;
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^NAN_API=(.+)$/m);
    if (match) return match[1].trim();
  } catch (e) {}
  return '';
}

// ─── Extraccion de texto ────────────────────────────────────────
async function extractPdfText(fileBuffer) {
  const data = await pdfParse(fileBuffer);
  return data.text;
}

// ─── Analisis de diseno con IA (mejorado con colores reales) ───
async function analyzeDesign(text, fileName, detectedColors) {
  const token = getNanToken();
  if (!token) throw new Error('Token de NaN API no configurado');

  const colorInfo = detectedColors && detectedColors.length > 0
    ? '\n\nCOLORES REALES extraidos visualmente del PDF (OBLIGATORIO usar estos como base):\n' +
      detectedColors.map((c, i) => `  ${i + 1}. ${c} (extraido del pixel real del PDF)`).join('\n') +
      '\n\nEstos colores fueron detectados al renderizar las paginas del PDF. DEBES usarlos como base para la paleta. ' +
      'El primario debe ser el color mas dominante, el secundario el segundo mas usado, y el acento el color llamativo.'
    : '';

  const systemPrompt = 'Eres un disenador UX/UI experto que analiza PDFs de propuestas de diseno web con precision quirurgica.\n' +
    'Tu objetivo es EXTRAER la identidad visual EXACTA del PDF, no inventar nada.\n' +
    'Devuelve UN JSON VALIDO con esta estructura:\n' +
    '{\n' +
    '  "empresa": "nombre exacto de la empresa o proyecto como aparece en el PDF",\n' +
    '  "sector": "sector al que pertenece",\n' +
    '  "tono": "formal | informal | creativo | corporativo | minimalista | audaz",\n' +
    '  "paleta": { "primario": "#hex", "secundario": "#hex", "acento": "#hex", "fondo": "#hex", "texto": "#hex" },\n' +
    '  "tipografia": { "heading": "serif | sans-serif | display | monospace", "body": "serif | sans-serif", "heading_weight": "bold | semibold | medium | light", "body_weight": "regular | medium | light" },\n' +
    '  "estilo": "descripcion del estilo visual (max 40 palabras)",\n' +
    '  "secciones": [ {"tipo": "hero|about|services|portfolio|testimonials|contact|cta|pricing|faq|team|footer", "titulo": "titulo exacto del PDF", "descripcion": "descripcion breve"} ],\n' +
    '  "colores_dominantes": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],\n' +
    '  "elementos_visuales": ["iconos | ilustraciones | fotos | gradientes | formas geometricas | bordes redondeados | sombras"],\n' +
    '  "inspiracion": "referencia de estilo similar",\n' +
    '  "call_to_action": "texto exacto del boton principal del PDF",\n' +
    '  "url": "sitio web si aparece en el PDF",\n' +
    '  "texto_hero": "texto principal del hero EXACTO del PDF",\n' +
    '  "subtitulo_hero": "subtexto del hero EXACTO del PDF",\n' +
    '  "features": [ {"titulo": "feature exacto del PDF", "descripcion": "descripcion del PDF"} ],\n' +
    '  "testimonios": [ {"texto": "cita exacta", "autor": "nombre", "cargo": "rol"} ],\n' +
    '  "layout": "descripcion del layout: una columna, dos columnas, grid, etc.",\n' +
    '  "espaciado": "generoso | compacto | equilibrado",\n' +
    '  "bordes": "redondeados | cuadrados | mixtos",\n' +
    '  "sombras": "suaves | fuertes | ninguna",\n' +
    '  "gradientes": "si | no", si es si, descripcion breve del gradiente\n' +
    '}\n' +
    'REGLAS CRITICAS:\n' +
    '1. Responde SOLO con JSON valido, sin markdown, sin backticks\n' +
    '2. Los colores DEBEN ser hex validos (ej: #FF5733)\n' +
    '3. SI HAY COLORES DETECTADOS VISUALMENTE: USA ESOS como base. El primario es el color mas dominante de la marca.\n' +
    '4. "fondo": debe ser el color de fondo REAL del PDF\n' +
    '5. "texto": debe ser el color del texto PRINCIPAL\n' +
    '6. "colores_dominantes": incluye TODOS los colores importantes (minimo 5)\n' +
    '7. Si el PDF tiene un color especifico como marca, el primario DEBE ser ese color\n' +
    '8. Describe el layout EXACTAMENTE como aparece en el PDF\n' +
    '9. NO inventes datos que no aparezcan en el PDF\n' +
    '10. El estilo debe describir la sensacion visual real, no una interpretacion'

  const response = await fetch('https://api.nan.builders/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      model: 'qwen3.6',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analiza este PDF: ' + fileName + '\n\nTexto extraido:\n' + text.substring(0, 8000) + colorInfo }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Error API NaN: ' + response.status + ' ' + err.substring(0, 200));
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Limpiar tags think de qwen3
  let clean = content;
  const thinkStart = clean.indexOf('<think>');
  const thinkEnd = clean.indexOf('</think>');
  if (thinkStart !== -1 && thinkEnd !== -1) {
    clean = clean.substring(0, thinkStart) + clean.substring(thinkEnd + 8);
  }
  clean = clean.trim();

  // Extraer JSON (puede estar envuelto en ```json)
  const jsonStart = clean.indexOf('{');
  const jsonEnd = clean.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    clean = clean.substring(jsonStart, jsonEnd + 1);
  }

  return JSON.parse(clean);
}

// ─── Generacion de HTML (mejorado con colores exactos) ──────────
async function generateLandingHTML(design) {
  const token = getNanToken();
  if (!token) throw new Error('Token de NaN API no configurado');

  // Build color enforcement block
  const paleta = design.paleta || {};
  const detectedColors = design._detectedColors || [];
  let colorEnforcement = '';

  if (paleta.primario) {
    colorEnforcement = '\n\n=== PALETA DE COLORES EXACTA (OBLIGATORIO) ===\n' +
      `Primario: ${paleta.primario} (botones, headings, acentos principales)\n` +
      `Secundario: ${paleta.secundario || '#333333'} (sub-headings, bordes, fondos de seccion)\n` +
      `Acento: ${paleta.acento || paleta.primario} (hover states, elementos destacados, links)\n` +
      `Fondo: ${paleta.fondo || '#ffffff'} (background de toda la pagina)\n` +
      `Texto: ${paleta.texto || '#333333'} (parrafos, contenido principal)\n` +
      (detectedColors.length > 0
        ? `Colores adicionales del PDF: ${detectedColors.join(', ')}\n`
        : '') +
      'NO uses ningun otro color. Cada elemento debe usar estos colores exactamente.\n';
  }

  // Build design guidance from analysis
  let designGuidance = '';
  if (design.layout) designGuidance += `Layout: ${design.layout}\n`;
  if (design.espaciado) designGuidance += `Espaciado: ${design.espaciado}\n`;
  if (design.bordes) designGuidance += `Bordes: ${design.bordes}\n`;
  if (design.sombras) designGuidance += `Sombras: ${design.sombras}\n`;
  if (design.gradientes) designGuidance += `Gradientes: ${design.gradientes}\n`;
  if (design.tipografia) {
    designGuidance += `Tipografia heading: ${design.tipografia.heading || 'sans-serif'}, peso: ${design.tipografia.heading_weight || 'bold'}\n`;
    designGuidance += `Tipografia body: ${design.tipografia.body || 'sans-serif'}, peso: ${design.tipografia.body_weight || 'regular'}\n`;
  }

  const systemPrompt = 'Eres un desarrollador frontend experto que crea landing pages HTML profesionales.\n' +
    'Crea una landing page que sea una REPLICA FIEL del diseno original del PDF.\n' +
    '\n' +
    '=== GUÍA DE DISEÑO COMPLETA ===\n' +
    'COLORES:\n' +
    '- Usa SOLO los colores de la paleta proporcionada\n' +
    '- CSS variables para TODOS los colores: --color-primary, --color-secondary, --color-accent, --color-bg, --color-text\n' +
    '- Nunca uses colores por defecto (azul, naranja, etc.)\n' +
    '- Los colores del PDF son la VERDAD ABSOLUTA\n' +
    '\n' +
    'TIPOGRAFÍA:\n' +
    '- Google Fonts: Inter para body, Space Grotesk para headings\n' +
    '- Respeta el peso indicado (bold/semibold/medium/light)\n' +
    '- Tamaños: h1 (2.5-3.5rem), h2 (1.8-2.5rem), h3 (1.2-1.5rem), body (1rem)\n' +
    '- Line height: 1.4-1.6 para body, 1.1-1.2 para headings\n' +
    '\n' +
    'LAYOUT:\n' +
    '- Respeta el layout descrito (1 columna, 2 columnas, grid, etc.)\n' +
    '- Max-width: 1200px para desktop, padding generoso\n' +
    '- Grid gap: 1.5-2rem\n' +
    '- Secciones con padding vertical: 4-6rem\n' +
    '\n' +
    'BOTONES:\n' +
    '- Primario: fondo con color primario, texto blanco, border-radius según diseño\n' +
    '- Secundario: borde con color primario, fondo transparente\n' +
    '- Hover: cambio sutil de color + sombra\n' +
    '- Padding: 0.75rem 1.5rem, font-weight: 600\n' +
    '\n' +
    'CARD / GLASS:\n' +
    '- Si el PDF usa cards: background rgba(255,255,255,0.7), backdrop-filter: blur(20px)\n' +
    '- Border: 1px solid rgba(0,0,0,0.08)\n' +
    '- Border-radius: según diseño (8-16px)\n' +
    '- Box-shadow: 0 4px 24px rgba(0,0,0,0.06)\n' +
    '\n' +
    'ANIMACIONES:\n' +
    '- Fade-in al scroll con IntersectionObserver\n' +
    '- Transiciones suaves en hover (0.2-0.3s ease)\n' +
    '- Sin animaciones excesivas (no bouncing, no spinning)\n' +
    '\n' +
    'ESTRUCTURA HTML:\n' +
    '- Un solo archivo HTML con CSS + JS inline\n' +
    '- Meta viewport para responsive\n' +
    '- Footer: "Hecho con ❤️ por David Antizar"\n' +
    '- NO frameworks — vanilla HTML + CSS + JS\n' +
    '\n' +
    'FIDELIDAD AL ORIGINAL:\n' +
    '- Copia el TEXT exacto del PDF (hero, features, CTA)\n' +
    '- Respeta los COLORES exactos detectados\n' +
    '- Mantiene el ESTILO visual (minimalista, corporativo, etc.)\n' +
    '- Respeta el ESPACIADO y proporciones\n' +
    '- Si hay gradientes en el original, incluyelos\n' +
    '- Si hay bordes redondeados, respétalos\n' +
    '\n' +
    'Responde SOLO con el HTML completo, sin markdown, sin backticks.';

  const userPrompt = 'Genera la landing page basada en este analisis del PDF:\n' +
    JSON.stringify(design, null, 2) +
    colorEnforcement +
    (designGuidance ? '\n\n=== DETALLES DEL DISEÑO ORIGINAL ===\n' + designGuidance : '') +
    '\n\nIMPORTANTE: El resultado debe parecerse LO MAXIMO POSSIBLE al PDF original. ' +
    'Mismos colores, mismo estilo, misma sensacion visual.';

  const response = await fetch('https://api.nan.builders/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
      body: JSON.stringify({
      model: 'qwen3.6',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 10000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Error API NaN: ' + response.status + ' ' + err.substring(0, 200));
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Limpiar markdown wrapping
  let html = content.replace(/```html\n?/g, '').replace(/```/g, '').trim();
  if (!html.startsWith('<!DOCTYPE')) {
    html = '<!DOCTYPE html>\n' + html;
  }
  return html;
}

// ─── Handlers ───────────────────────────────────────────────────
async function handleAnalyze(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subio ningun PDF' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = req.file.originalname;

    // Accept detected colors from client (extracted via pdf.js + median cut)
    const detectedColors = req.body.detectedColors
      ? JSON.parse(req.body.detectedColors)
      : [];

    const text = await extractPdfText(fileBuffer);
    const design = await analyzeDesign(text, fileName, detectedColors);

    // Limpiar archivo temporal
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json({ success: true, design });
  } catch (err) {
    console.error('Error en /api/analyze:', err);
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ error: err.message || 'Error analizando el PDF' });
  }
}

async function handleGenerate(req, res) {
  try {
    const { design } = req.body;
    if (!design) {
      return res.status(400).json({ error: 'Datos de diseno requeridos' });
    }

    const html = await generateLandingHTML(design);
    res.json({ success: true, html });
  } catch (err) {
    console.error('Error en /api/generate:', err);
    res.status(500).json({ error: err.message || 'Error generando la landing' });
  }
}

// ─── Rutas API (ANTES de static) ────────────────────────────────
app.post('/api/analyze', upload.single('pdf'), handleAnalyze);
app.post('/api/generate', handleGenerate);

// ─── Static files (DESPUES de API routes) ───────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Health Check ───────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('PDF-to-Landing v3 corriendo en http://localhost:' + PORT);
});
