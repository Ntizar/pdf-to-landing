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

  const systemPrompt = 'Eres un disenador UX/UI experto que analiza PDFs de propuestas de diseno web.\n' +
    'Analiza el texto extraido y los colores visuales del PDF.\n' +
    'Devuelve UN JSON VALIDO con esta estructura:\n' +
    '{\n' +
    '  "empresa": "nombre de la empresa o proyecto",\n' +
    '  "sector": "sector al que pertenece",\n' +
    '  "tono": "formal | informal | creativo | corporativo | minimalista | audaz",\n' +
    '  "paleta": { "primario": "#hex", "secundario": "#hex", "acento": "#hex", "fondo": "#hex", "texto": "#hex" },\n' +
    '  "tipografia": { "heading": "serif | sans-serif | display | monospace", "body": "serif | sans-serif" },\n' +
    '  "estilo": "descripcion corta del estilo visual (max 30 palabras)",\n' +
    '  "secciones": [ {"tipo": "hero|about|services|portfolio|testimonials|contact|cta|pricing|faq|team|footer", "titulo": "titulo", "descripcion": "descripcion breve"} ],\n' +
    '  "colores_dominantes": ["#hex1", "#hex2", "#hex3"],\n' +
    '  "elementos_visuales": ["iconos | ilustraciones | fotos | gradientes | formas geometricas"],\n' +
    '  "inspiracion": "referencia de estilo (Stripe | Apple | Linear | Notion | Figma | etc.)",\n' +
    '  "call_to_action": "texto del boton principal",\n' +
    '  "url": "sitio web si aparece en el PDF",\n' +
    '  "texto_hero": "texto principal del hero",\n' +
    '  "subtitulo_hero": "subtexto del hero",\n' +
    '  "features": [ {"titulo": "feature", "descripcion": "breve descripcion"} ],\n' +
    '  "testimonios": [ {"texto": "cita", "autor": "nombre", "cargo": "rol"} ]\n' +
    '}\n' +
    'REGLAS:\n' +
    '1. Responde SOLO con JSON valido, sin markdown, sin backticks\n' +
    '2. Si no hay info para un campo, usa null o valores por defecto razonables\n' +
    '3. Los colores DEBEN ser hex validos\n' +
    '4. No inventes datos especificos si no aparecen en el PDF\n' +
    '5. SI HAY COLORES DETECTADOS VISUALMENTE: usa esos como base para la paleta. ' +
    'El color primario es el mas dominante, el secundario complementa, el acento es el color llamativo.\n' +
    '6. El fondo debe ser blanco o muy claro para legibilidad\n' +
    '7. El texto debe ser oscuro sobre fondo claro';

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
    colorEnforcement = '\n\nCOLOLES OBLIGATORIOS (extraidos del PDF real, NO los cambies):\n' +
      `- primario: ${paleta.primario}\n` +
      `- secundario: ${paleta.secundario || '#333333'}\n` +
      `- acento: ${paleta.acento || paleta.primario}\n` +
      `- fondo: ${paleta.fondo || '#ffffff'}\n` +
      `- texto: ${paleta.texto || '#333333'}\n` +
      (detectedColors.length > 0
        ? `- Todos los colores del PDF: ${detectedColors.join(', ')}\n`
        : '') +
      '\nUsa estos colores EXACTAMENTE en las variables CSS y en TODOS los elementos. ' +
      'El primario para headings, botones principales y acentos. ' +
      'El secundario para sub-headings y fondos de seccion. ' +
      'El acento para hover states y elementos destacados. ' +
      'NUNCA uses colores por defecto azul/naranja.';
  }

  const systemPrompt = 'Eres un desarrollador frontend experto que crea landing pages HTML profesionales.\n' +
    'Crea una landing page completa basada en el analisis de diseno proporcionado.\n' +
    'REQUISITOS:\n' +
    '1. Responsive (movil + desktop)\n' +
    '2. Moderna (glassmorphism, gradientes sutiles, animaciones CSS)\n' +
    '3. Un solo archivo HTML con todo inline (CSS + JS)\n' +
    '4. Google Fonts: Inter para body, Space Grotesk para headings\n' +
    '5. Footer: "Hecho con ❤️ por David Antizar"\n' +
    '6. USAR LOS COLORES EXACTOS de la paleta del diseno (NO inventar colores)\n' +
    '7. Incluir: Hero con CTA, servicios/features, sobre nosotros, testimonios si existen, CTA intermedio, footer\n' +
    '8. NO usar frameworks — HTML + CSS + JS vanilla\n' +
    '9. Animaciones fade-in al scroll con IntersectionObserver\n' +
    '10. CSS variables con los colores exactos de la paleta\n' +
    'Responde SOLO con el HTML completo, sin markdown, sin backticks.';

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
        { role: 'user', content: 'Genera la landing page para: ' + JSON.stringify(design, null, 2) + colorEnforcement }
      ],
      max_tokens: 8000,
      temperature: 0.8
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
