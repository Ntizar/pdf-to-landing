// ─────────────────────────────────────────────────────────────────────────────
// ejemplos.mjs — Cinco landings completas, una por formato de web.
//
// No son capturas ni maquetas: cada ejemplo se compone con el MISMO renderizador
// que la app usa en producción y se valida contra el auditor oficial de Aurora
// (scripts/auditar-uso.py). El contenido es real (castellano, sin lorem ipsum)
// y la paleta sale de las marcas oficiales del repositorio.
// ─────────────────────────────────────────────────────────────────────────────
import { renderizar, PLANTILLAS } from './bloques.mjs';

export const EJEMPLOS = [
  {
    slug: 'estudio-arquitectura',
    formato: 'Estudio de arquitectura',
    plantilla: 'catalogo',
    marca: { nombre: 'cobalto', color: '#1d4ed8', acento: '#c2410c' },
    resumen: 'Portafolio de obra construida: la galería manda y el texto acompaña.',
    contenido: {
      empresa: 'Taller Segovia',
      cta: 'Pedir visita',
      enlaces: ['Proyectos', 'Estudio', 'Contacto'],
      hero: {
        eyebrow: 'Arquitectura · Madrid y Segovia',
        titulo: 'Casas que se terminan',
        subtitulo: 'Diseñamos vivienda unifamiliar con presupuesto cerrado desde el primer plano. Obra nueva, rehabilitación y reforma integral.',
        cta_secundario: 'Ver proyectos',
        dato_hero: '34 obras entregadas · 0 desviaciones medias de presupuesto',
      },
      galeria: {
        titulo: 'Obra reciente',
        items: [
          { titulo: 'Casa Patio, Brunete', pie: '220 m² · 2025' },
          { titulo: 'Rehabilitación Cava Baja', pie: '180 m² · 2024' },
          { titulo: 'Nave Taller, Segovia', pie: '420 m² · 2024' },
        ],
      },
      ventajas: {
        titulo: 'Cómo trabajamos',
        entradilla: 'Un solo interlocutor desde el anteproyecto hasta la entrega de llaves.',
        items: [
          { icono: '111-documento', titulo: 'Presupuesto antes del plano', descripcion: 'Mediciones y precios cerrados con tres ofertas de constructor comparadas.' },
          { icono: '026-ajustes-rapidos', titulo: 'Dirección de obra propia', descripcion: 'Visitamos la obra dos veces por semana. El constructor no se autodirige.' },
          { icono: '113-archivo-validado', titulo: 'Cierre y licencia', descripcion: 'Certificado final, libro del edificio y cédula en el mismo paquete.' },
        ],
      },
      testimonio: {
        texto: 'Nos dieron un precio en marzo y en noviembre seguía siendo ese precio. Con la obra anterior no pasó.',
        autor: 'Marta Ibáñez',
        cargo: 'Casa Patio, Brunete',
      },
      precios: {
        titulo: 'Tarifas de proyecto',
        items: [
          { nombre: 'Anteproyecto', descripcion: 'Para saber si tu parcela es viable.', precio: '900 €', periodo: 'una vez', caracteristicas: ['Estudio de viabilidad', 'Tres esquemas', 'Presupuesto orientativo'], cta: 'Encargar' },
          { nombre: 'Proyecto completo', descripcion: 'Del solar a las llaves.', precio: '8 %', periodo: 'del PEM', caracteristicas: ['Proyecto de ejecución', 'Dirección de obra', 'Cierre y licencias'], cta: 'Hablamos' },
        ],
      },
      contacto: {
        titulo: 'Hablemos de tu obra',
        items: [
          { etiqueta: 'Estudio', valor: 'Calle del Pez 21, Madrid' },
          { etiqueta: 'Correo', valor: 'hola@tallersegovia.es' },
          { etiqueta: 'Visitas', valor: 'Martes y jueves, 10:00–13:00' },
        ],
      },
      cta_final: {
        eyebrow: 'Primera visita sin coste',
        titulo: 'Tu parcela tiene más de lo que parece',
        texto: 'Vamos, la medimos y te decimos qué se puede construir y cuánto cuesta antes de firmar nada.',
        cta: 'Pedir visita',
      },
    },
  },

  {
    slug: 'clinica-dental',
    formato: 'Clínica de servicios',
    plantilla: 'clasica',
    marca: { nombre: 'esmeralda-clinica', color: '#0d9488', acento: '#ea580c' },
    resumen: 'Servicios, precios claros y preguntas frecuentes. La conversión es pedir cita.',
    contenido: {
      empresa: 'Clínica Aravaca Dental',
      cta: 'Pedir cita',
      enlaces: ['Tratamientos', 'Precios', 'Equipo'],
      hero: {
        eyebrow: 'Odontología · Aravaca',
        titulo: 'Entras con una duda, sales con un plan',
        subtitulo: 'Diagnóstico completo en la primera visita, con presupuesto escrito y financiación sin intereses.',
        cta_secundario: 'Ver precios',
        dato_hero: 'Primera visita y radiografía: 0 €',
      },
      ventajas: {
        titulo: 'Lo que nos diferencia',
        entradilla: 'Tres cosas que casi ninguna clínica hace y que aquí son norma.',
        items: [
          { icono: '111-documento', titulo: 'Presupuesto por escrito', descripcion: 'Con cada acto, su precio y su garantía. Te lo llevas a casa antes de decidir.' },
          { icono: '167-pantalla', titulo: 'Escáner intraoral', descripcion: 'Ves tu boca en 3D en la pantalla mientras te exploramos. Sin moldes con pasta.' },
          { icono: '064-llave', titulo: 'Urgencias el mismo día', descripcion: 'Dos huecos reservados cada mañana para dolor agudo. Llamas y entras.' },
        ],
      },
      lista: {
        titulo: 'Tratamientos',
        entradilla: 'Lo que hacemos y lo que no. Si algo no es nuestro, te lo decimos y te derivamos.',
        items: [
          'Implantes con cirugía guiada por escáner',
          'Ortodoncia invisible y brackets estéticos',
          'Endodoncia con microscopio',
          'Estética dental: carillas y blanqueamiento',
          'Periodoncia y mantenimiento',
          'Odontopediatría',
        ],
      },
      cifras: {
        titulo: 'La clínica en números',
        items: [
          { etiqueta: 'Pacientes activos', valor: '2 480', nota: '+9 % este año' },
          { etiqueta: 'Garantía en implantes', valor: '10 años' },
          { etiqueta: 'Cita media', valor: '48 h' },
        ],
      },
      precios: {
        titulo: 'Precios publicados',
        items: [
          { nombre: 'Revisión', descripcion: 'Diagnóstico y plan de tratamiento.', precio: '0 €', periodo: 'primera visita', caracteristicas: ['Radiografía panorámica', 'Presupuesto escrito', 'Sin compromiso'], cta: 'Pedir cita' },
          { nombre: 'Implante', descripcion: 'Con corona de circonio.', precio: '1 190 €', periodo: 'por pieza', caracteristicas: ['Cirugía guiada', 'Corona incluida', 'Garantía 10 años'], cta: 'Valorar mi caso' },
          { nombre: 'Ortodoncia', descripcion: 'Alineadores transparentes.', precio: '2 400 €', periodo: 'tratamiento', caracteristicas: ['Estudio 3D', 'Revisiones incluidas', 'Financiación 24 meses'], cta: 'Pedir estudio' },
        ],
      },
      testimonio: {
        texto: 'Llevaba años dando vueltas con una muela. Aquí me enseñaron la fisura en la pantalla y salí con cita para el día siguiente.',
        autor: 'Javier Ruiz',
        cargo: 'Paciente desde 2023',
      },
      faq: {
        titulo: 'Antes de venir',
        items: [
          { pregunta: '¿Trabajáis con seguros dentales?', respuesta: 'Sí, con Adeslas, Sanitas y DKV. Te decimos en la primera visita qué cubre tu póliza y qué no, sin sorpresas en la factura.' },
          { pregunta: '¿Duele un implante?', respuesta: 'La cirugía se hace con anestesia local y dura entre 30 y 50 minutos. El 90 % de nuestros pacientes no toma ni un analgésico al día siguiente.' },
          { pregunta: '¿Puedo financiar el tratamiento?', respuesta: 'Sí: hasta 24 meses sin intereses con aprobación en el mismo día. No trabajamos con financieras externas.' },
          { pregunta: '¿Atendéis urgencias?', respuesta: 'Reservamos dos huecos cada mañana. Si es dolor agudo, llama a primera hora y entras ese día.' },
        ],
      },
      contacto: {
        titulo: 'Dónde estamos',
        items: [
          { etiqueta: 'Dirección', valor: 'Avenida de Aravaca 14, Madrid' },
          { etiqueta: 'Teléfono', valor: '910 22 44 88' },
          { etiqueta: 'Horario', valor: 'L–V 9:00–21:00 · S 9:00–14:00' },
        ],
      },
      cta_final: {
        eyebrow: 'Sin lista de espera',
        titulo: 'Te vemos esta semana',
        texto: 'Pide cita y elige hora por teléfono o por correo. Te confirmamos el mismo día.',
        cta: 'Pedir cita',
      },
    },
  },

  {
    slug: 'saas-inventario',
    formato: 'Producto SaaS',
    plantilla: 'producto',
    marca: { nombre: 'indigo-stock', color: '#4f46e5', acento: '#0891b2' },
    resumen: 'Cifras arriba, planes en tabla y prueba técnica del producto antes de pagar.',
    contenido: {
      empresa: 'Fardo',
      cta: 'Probar 14 días',
      enlaces: ['Producto', 'Precios', 'Casos'],
      hero: {
        eyebrow: 'Inventario para tiendas medianas',
        titulo: 'Sabes qué tienes, sin contar cajas',
        subtitulo: 'Fardo une tu tienda online, el mostrador y el almacén en un solo stock. Lo que se vende en la web descuenta en el local en el mismo segundo.',
        cta_secundario: 'Ver una demo',
        dato_hero: '14 días gratis · sin tarjeta · migración desde Excel incluida',
      },
      cifras: {
        titulo: 'Lo que consiguen las tiendas',
        items: [
          { etiqueta: 'Roturas de stock', valor: '−42 %', nota: 'media a los 3 meses' },
          { etiqueta: 'Tiempo de inventario', valor: '6 h → 40 min' },
          { etiqueta: 'Tiendas activas', valor: '1 480' },
        ],
      },
      ventajas: {
        titulo: 'Qué hace y qué no',
        entradilla: 'Preferimos decirlo claro: Fardo es inventario, no un ERP. Si necesitas contabilidad, te pasamos el dato a tu gestoría.',
        items: [
          { icono: '120-caja', titulo: 'Un stock, tres canales', descripcion: 'Web, mostrador y almacén sobre la misma cifra. Sin sincronizaciones cada hora que descuadran.' },
          { icono: '023-rejilla', titulo: 'Lectura de códigos sin app', descripcion: 'La cámara del móvil lee EAN y QR desde el navegador. Nada que instalar en el móvil del dependiente.' },
          { icono: '041-descargar', titulo: 'Salida sin secuestro', descripcion: 'Exportas todo a CSV cuando quieras, con histórico de movimientos incluido. No hay trampa en el plan.' },
        ],
      },
      precios: {
        titulo: 'Precios por tienda, no por usuario',
        items: [
          { nombre: 'Mostrador', descripcion: 'Una tienda y dos personas.', precio: '29 €', periodo: '/mes', caracteristicas: ['Un punto de venta', 'Usuarios ilimitados', 'Soporte por correo'], cta: 'Empezar' },
          { nombre: 'Cadena', descripcion: 'Varias tiendas y almacén.', precio: '79 €', periodo: '/mes', caracteristicas: ['Tiendas ilimitadas', 'Transferencias entre locales', 'Soporte por teléfono'], cta: 'Probar 14 días' },
          { nombre: 'Taller', descripcion: 'Con producción y kits.', precio: '149 €', periodo: '/mes', caracteristicas: ['Escandallos y kits', 'Lotes y caducidades', 'API y webhooks'], cta: 'Hablar con ventas' },
        ],
      },
      proceso: {
        titulo: 'Cómo se migra sin parar la tienda',
        items: [
          { titulo: 'Subes tu Excel', descripcion: 'Lo leemos, te decimos qué columnas faltan y lo limpiamos contigo.' },
          { titulo: 'Un día en paralelo', descripcion: 'Fardo corre al lado de tu sistema actual y comparamos los descuadres.' },
          { titulo: 'Cambio en lunes', descripcion: 'Se apaga el viejo y se queda Fardo. Nadie pierde una venta.' },
          { titulo: 'Soporte los 15 días', descripcion: 'Un técnico con nombre y teléfono durante las dos primeras semanas.' },
        ],
      },
      faq: {
        titulo: 'Preguntas que nos hacen siempre',
        items: [
          { pregunta: '¿Funciona sin internet?', respuesta: 'El punto de venta aguanta 4 horas en local y sincroniza al recuperar la conexión. El alta de productos y la web sí necesitan red.' },
          { pregunta: '¿Se integra con Shopify o WooCommerce?', respuesta: 'Sí, con las dos de serie, y con PrestaShop mediante plugin. La sincronización es por webhook: tarda menos de dos segundos.' },
          { pregunta: '¿Qué pasa si me voy?', respuesta: 'Exportas productos, movimientos, clientes y facturas en CSV. Sin coste y sin pedir permiso.' },
          { pregunta: '¿Cuánto tarda la migración?', respuesta: 'Una tienda de hasta 3 000 referencias, entre 3 y 5 días laborables con nuestro equipo. Nunca lo dejamos a medias en un viernes.' },
        ],
      },
      cta_final: {
        eyebrow: 'Sin tarjeta, sin permanencia',
        titulo: 'Prueba con tu stock real',
        texto: 'Sube tu Excel y en 10 minutos ves tus roturas de stock en el panel. Si no te sirve, borras la cuenta.',
        cta: 'Empezar gratis',
      },
    },
  },

  {
    slug: 'congreso',
    formato: 'Evento / congreso',
    plantilla: 'evento',
    marca: { nombre: 'granate-evento', color: '#9f1239', acento: '#0f766e' },
    resumen: 'Fechas, programa, sede y entradas. Todo lo que se pregunta antes de inscribirse.',
    contenido: {
      empresa: 'Encuentro de Movilidad Sostenible',
      cta: 'Inscribirme',
      enlaces: ['Programa', 'Sede', 'Entradas'],
      hero: {
        eyebrow: '5ª edición · Madrid, 12–14 marzo',
        titulo: 'Movilidad que se puede pagar',
        subtitulo: 'Tres días sobre financiación del transporte público, tarificación y reparto urbano. Con datos de operadores, no con promesas.',
        cta_secundario: 'Ver programa',
        dato_hero: '48 ponentes · 12 talleres · 600 plazas',
      },
      ficha: {
        titulo: 'Lo esencial',
        items: [
          { etiqueta: 'Fechas', valor: '12, 13 y 14 de marzo de 2027' },
          { etiqueta: 'Sede', valor: 'Escuela de Ingenieros de Caminos, Madrid' },
          { etiqueta: 'Entrada general', valor: '180 € · estudiantes 40 €' },
          { etiqueta: 'Idiomas', valor: 'Castellano e inglés con traducción simultánea' },
          { etiqueta: 'Créditos', valor: '1,5 ECTS reconocidos' },
          { etiqueta: 'Aforo', valor: '600 plazas, sin venta en puerta' },
        ],
      },
      pasos: {
        titulo: 'Programa en tres bloques',
        items: [
          { titulo: 'Día 1 · Quién paga', descripcion: 'Financiación del transporte público: tarifa, subvención y peaje. Con datos de las cinco áreas metropolitanas españolas.' },
          { titulo: 'Día 2 · Reparto urbano', descripcion: 'Última milla, zonas de carga y descarga y el coste real de la devolución. Dos talleres prácticos con datos abiertos.' },
          { titulo: 'Día 3 · Qué se puede implantar', descripcion: 'Casos que ya funcionan en ciudades de 200 000 habitantes. Cierre con mesa de alcaldes y turno de preguntas.' },
        ],
      },
      galeria: {
        titulo: 'Ediciones anteriores',
        items: [
          { titulo: '2026 · Valencia', pie: '520 asistentes' },
          { titulo: '2025 · Sevilla', pie: '410 asistentes' },
          { titulo: '2024 · Bilbao', pie: '380 asistentes' },
        ],
      },
      cifras: {
        titulo: 'La edición en cifras',
        items: [
          { etiqueta: 'Ponencias aceptadas', valor: '38', nota: 'de 210 propuestas' },
          { etiqueta: 'Instituciones', valor: '14' },
          { etiqueta: 'Becas de matrícula', valor: '90' },
        ],
      },
      contacto: {
        titulo: 'Cómo llegar y a quién escribir',
        items: [
          { etiqueta: 'Dirección', valor: 'Calle del Profesor Aranguren 3, Madrid' },
          { etiqueta: 'Metro', valor: 'Ciudad Universitaria (L6) · 8 min andando' },
          { etiqueta: 'Secretaría', valor: 'secretaria@encuentromovilidad.es' },
        ],
      },
      cta_final: {
        eyebrow: 'Aforo limitado · sin venta en puerta',
        titulo: 'Inscríbete antes del 28 de febrero',
        texto: 'La entrada incluye los tres días, comida y acceso a las grabaciones durante un año.',
        cta: 'Inscribirme',
      },
    },
  },

  {
    slug: 'despacho-legal',
    formato: 'Marca personal / despacho',
    plantilla: 'editorial',
    marca: { nombre: 'pizarra-legal', color: '#334155', acento: '#b45309' },
    resumen: 'Dirección editorial: titular a dos columnas, texto largo y credenciales por delante.',
    contenido: {
      empresa: 'Carme Vidal · Abogada',
      cta: 'Primera consulta',
      enlaces: ['Áreas', 'Honorarios', 'Sobre mí'],
      hero: {
        eyebrow: 'Derecho laboral · Barcelona',
        titulo: 'Te explico tu caso antes de cobrarte',
        subtitulo: 'Veinte años negociando despidos y convenios. La primera consulta es gratuita porque la mitad de los casos que me llegan no necesitan abogado, y te lo digo igual.',
        cta_secundario: 'Cómo trabajo',
        dato_hero: 'Colegiada 34 812 · 640 casos cerrados',
      },
      lista: {
        titulo: 'En qué te puedo ayudar',
        entradilla: 'Si tu asunto no es de esta lista, te derivo a un compañero. Cobrar por acompañarte a donde no toca no es mi negocio.',
        items: [
          'Despidos objetivos y disciplinarios: negociación y demanda',
          'Reclamación de cantidad y horas extras',
          'Incapacidad permanente y revisión de grado',
          'Convenios colectivos: interpretación y conflicto',
          'Acoso laboral y protocolos de empresa',
          'Trabajo a distancia y derecho a la desconexión',
        ],
      },
      cifras: {
        titulo: 'Cómo se mide un abogado laboralista',
        items: [
          { etiqueta: 'Casos cerrados', valor: '640', nota: 'desde 2006' },
          { etiqueta: 'Acuerdos antes de juicio', valor: '71 %' },
          { etiqueta: 'Honorarios pactados', valor: '100 %', nota: 'nunca por sorpresa' },
        ],
      },
      testimonio: {
        texto: 'Me dijo en la primera llamada que mi despido era procedente y que no merecía la pena demandar. Aun así me explicó cómo negociar la salida. Le debo más a esa honestidad que a cualquier juicio.',
        autor: 'Ana Ferrer',
        cargo: 'Jefa de producción, sector textil',
      },
      ficha: {
        titulo: 'Formación y credenciales',
        items: [
          { etiqueta: 'Colegiación', valor: 'Il·lustre Col·legi de l’Advocacia de Barcelona, nº 34 812' },
          { etiqueta: 'Formación', valor: 'Licenciatura en Derecho (UB, 2004) · Máster en Derecho del Trabajo (UPF)' },
          { etiqueta: 'Docencia', valor: 'Profesora asociada de Derecho Procesal Laboral, UB (2014–2023)' },
          { etiqueta: 'Idiomas', valor: 'Castellano, catalán, inglés' },
          { etiqueta: 'Seguro', valor: 'Responsabilidad civil profesional, 600 000 €' },
        ],
      },
      faq: {
        titulo: 'Sobre honorarios',
        items: [
          { pregunta: '¿Cuánto cuesta la primera consulta?', respuesta: 'Nada. Treinta minutos por teléfono o en el despacho para saber si tu caso tiene recorrido. Si no lo tiene, te lo digo ahí mismo.' },
          { pregunta: '¿Cobras por horas o a tanto alzado?', respuesta: 'A tanto alzado por fase, siempre por escrito antes de empezar. Sé lo que cuesta un procedimiento y no te voy a facturar la incertidumbre.' },
          { pregunta: '¿Hay éxito y porcentaje?', respuesta: 'Solo en reclamaciones de cantidad, y siempre con un mínimo pactado. En despidos nunca: el resultado no cambia lo que me llevo.' },
        ],
      },
      cta_final: {
        eyebrow: 'Primera consulta gratuita',
        titulo: 'Cuéntame qué ha pasado',
        texto: 'Escríbeme con las fechas y el documento que tengas. Te respondo en dos días laborables con una valoración honesta.',
        cta: 'Escribir',
      },
    },
  },
];

export function generarEjemplo(ejemplo) {
  const { html, bloques, packs, plantilla, nombrePlantilla } = renderizar(ejemplo.contenido, {
    marca: ejemplo.marca.nombre,
    titulo: `${ejemplo.contenido.empresa} · ${ejemplo.formato}`,
    plantilla: ejemplo.plantilla,
  });
  return {
    slug: ejemplo.slug,
    formato: ejemplo.formato,
    resumen: ejemplo.resumen,
    plantilla,
    nombrePlantilla: PLANTILLAS[plantilla].nombre,
    bloques,
    packs,
    html,
    marca: ejemplo.marca,
    empresa: ejemplo.contenido.empresa,
  };
}

export function todos() {
  return EJEMPLOS.map(generarEjemplo);
}
