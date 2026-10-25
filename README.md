# PDF a landing page

Sube el PDF de tu propuesta y llévate una landing page de una página, con tus
textos y tus colores. **La IA escribe el contenido; el diseño lo decide el
[sistema Aurora](https://github.com/Ntizar/Aurora).**

Eso no es un detalle de marketing: es lo que hace que la página no pueda salir con
clases inventadas, gradientes de más, emojis en los botones ni cinco titulares
compitiendo. Cada página se valida contra el mismo lint que usa el repositorio de
Aurora antes de entregarse.

## Cómo funciona

```
PDF ──▶ pdf.js (navegador)      extrae el texto
   └──▶ median cut (navegador)  detecta los colores reales del documento
        └──▶ /api/analizar      identidad: empresa, sector, tono, formato
             └──▶ /api/generar  la IA escribe SOLO los textos
                  └──▶ Aurora   compone el HTML con objetos reales
                       └──▶ lint de Aurora: 0 fallos
```

1. **El PDF se lee en el navegador** para sacar los colores (median cut sobre las
   páginas renderizadas). El fichero se envía después al servidor solo para
   extraer el texto, en memoria, y se descarta.
2. **El modelo analiza** el documento: nombre, sector, público, tono y qué formato
   de web encaja.
3. **El modelo escribe el contenido** con un JSON estricto: hero, ventajas, cifras,
   precios, FAQ, contacto. Nada de HTML.
4. **El sistema compone** con bloques de Aurora y una de las cinco plantillas.
5. **Se valida** con `src/aurora.mjs`, que es un port del `auditar-uso.py` del
   repositorio de Aurora, y se ofrecen tres paletas con contraste AA comprobado.

## Dos motores: libre y composición fija

La IA escribe el contenido en los dos. Lo que cambia es **quién decide el diseño**.

| Motor | Qué hace | Cuándo |
|---|---|---|
| **Libre (OpenUI)** — por defecto | El modelo escribe un **programa openui-lang** con los 36 componentes del sistema. Elige estructura, orden, jerarquía y densidad. El mismo negocio con otro estilo produce **otra web**. | Cuando quieres que cada cliente se vea distinto |
| **Composición fija** | Bloques del sistema en un orden probado, con 5 plantillas. | Cuando quieres predecir el resultado |

En los dos, el CSS es de Aurora y la página pasa **el mismo validador**. La
diferencia es la libertad de composición: en libre el modelo compone; en fijo elige
entre cinco composiciones.

### Por qué openui y no dejarle escribir HTML

Si el modelo escribe HTML/CSS libre vuelve el problema original: clases inventadas,
gradientes de más, emojis en los botones. openui-lang es un **lenguaje intermedio**:
el modelo solo puede llamar a componentes que existen, con argumentos que existen.
Su libertad es real (estructura), pero está acotada por el sistema (estilo).

El programa se valida **tres veces** antes de pintarse:

1. `validarPrograma` — nombres de componente, `root`, markdown colado, HTML colado.
2. `validarArgumentos` — número de argumentos, obligatorios y **enums** contra la
   spec del repo. Esto caza el `.nz-btn--true` (un opcional saltado).
3. `validar` (el lint de Aurora) — sobre el HTML resultante.

Si algo no cuadra: **una** corrección con el error exacto, reparación mecánica del
opcional saltado, y si aun así no sale, **cae al modo fijo** diciéndolo.

### Estilos: la variedad visual

Cinco registros que empujan al modelo a decisiones distintas de verdad, no a un
adjetivo: **corporativo** (denso, con datos), **editorial** (aire y prosa),
**producto** (cifras y planes), **cálido** (cercano) y **técnico** (ficha y tabla).
Más **tema** claro/oscuro y la **marca** del PDF o del sistema.

Medido: el mismo PDF con tres estilos da **tres estructuras distintas** (37, 39 y
48 nodos; 14, 13 y 14 componentes), y las tres pasan el auditor de Aurora.

## Los cinco formatos

Cada formato es una landing completa con contenido real, no una miniatura:

| Formato | Para qué | Composición |
|---|---|---|
| **Clásica** | servicios locales, clínicas | hero a sangre, ventajas, precios, FAQ |
| **Editorial** | marca personal, despachos | titular a dos columnas, texto largo, ficha |
| **Producto** | SaaS y apps | cifras dentro del hero, planes, pasos |
| **Evento** | congresos, cursos | ficha, programa, sedes |
| **Catálogo** | estudios, interiorismo | galería protagonista, ventajas cortas |

Los cinco se generan con `src/ejemplos.mjs` y se pueden ver en `/api/ejemplos`.

## Arrancar

```bash
npm install
printf 'NAN_API=<tu_token>\n' > .env
npm start
```

Sin token también arranca: la app usa las vistas de ejemplo de cada formato en vez
de llamar al modelo, para que siempre se pueda probar.

## Verificación

```bash
npm test                 # todo (necesita el servidor arriba para el grupo 6)
node arnes.mjs lint      # los 5 formatos contra el lint de Aurora
node arnes.mjs marcas    # las rampas OKLCH coinciden con las del repo
node arnes.mjs descarga  # el HTML descargado es autocontenido y válido
node arnes.mjs paletas   # la heurística del color del PDF acierta
node arnes.mjs openui    # el motor libre: compilador, argumentos y color
```

El arnés tiene **86 comprobaciones**. Criterio: **cero fallos de lint** (obligatorio)
y como mucho **2 avisos**, que es lo que saca la propia receta oficial de landing
de Aurora.

## Estructura

```
server.js              Express: analizar, generar, componer, marca, vistas
src/aurora-censo.json  2.198 clases reales de Aurora v10.1.0
src/aurora.mjs         validador + reparación determinista (port del lint del repo)
src/marca.mjs          rampas OKLCH, port de scripts/generar-marca.py
src/bloques.mjs        14 bloques con objetos del sistema + 5 plantillas
src/generador.mjs      los prompts de la IA + la cadena de composición
src/ejemplos.mjs       5 landings completas (una por formato)
src/iconos/            iconos del sprite de Aurora, incrustados en línea
src/openui/            el runtime, la spec y las plantillas de openui (del repo Aurora)
src/openui.mjs         compilador openui-lang → HTML, validador de argumentos, presupuesto de color
src/openui-generador.mjs  los estilos, los prompts y la cadena programa → página
public/index.html      la herramienta (Aurora, sin dependencias)
arnes.mjs              la suite de verificación
```

## Decisiones que costaron medirlas

- **`enable_thinking: false` no es opcional.** qwen3.6 devuelve su razonamiento en
  `reasoning_content`; si se queda sin tokens, `content` llega a `null` y el usuario
  ve una página en blanco. Medido: 6× menos tokens y salida limpia.
- **La marca va en el CSS después de `tokens.css`.** `[data-nz-marca="x"]` y `:root`
  tienen la misma especificidad: gana la última regla. Con el `<link>` de la marca
  antes, el color elegido no se veía nunca.
- **La IA no escribe CSS.** Pedirle el HTML entero daba páginas que parecían hechas
  por una IA. Pedirle solo el contenido y componer con objetos reales da una página
  que pasa el lint sin discusión.
- **El color de marca no se inventa: se agrupa por familia de matiz.** Un PDF con
  tres verdes y un naranja tiene el verde como marca; ordenar por saturación elegía
  el naranja.

Hecho con ❤️ por David Antizar
