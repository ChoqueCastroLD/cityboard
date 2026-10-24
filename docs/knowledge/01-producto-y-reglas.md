# Producto y reglas fijas

## Qué es

Juego de mesa en línea de compraventa de propiedades, de código abierto (MIT), con motor propio y mapas en JSON. No es un clon: no usa nombres, reglas literales ni estética de ninguna marca registrada. Interfaz en español.

- Repositorio: `ChoqueCastroLD/cityboard` (rama `main`). El nombre del repo se queda así a propósito.
- Marca visible: **Capichan**. Los nombres internos (`capi-core`, `capi-api`, `capi-frontend`, claves `capi:*` de localStorage) siguen siendo "capi" y no hace falta renombrarlos.
- Producción: https://capichan.com/monopoly. La raíz de capichan.com es de otro proyecto.
- Se descartó "Capipolio" por el sufijo "-opoly" y su riesgo legal.

## Reglas del dueño (no negociables)

- Nunca emojis como iconos. Solo iconos [Lucide](https://lucide.dev).
- Nunca comentarios explicativos triviales en el código.
- Las casillas de ubicación (propiedad, transporte, servicio) muestran siempre su imagen, también en 2D y en móvil.
- Sin modo offline.
- Nada de marcas registradas en tableros, cartas ni fichas.
- La pantalla de partida conserva el estilo "liquid glass" oscuro; el resto de pantallas usa el estilo limpio claro/oscuro.
- El modo de tablero por defecto es **2D**. El chat arranca **colapsado**.
- En textos para el usuario, no usar la raya larga (em dash).

## Contenido del juego

- Tableros: Capi City, Mini Harbor, Mundo Clásico y América (`capi-core/boards/*.json`). Imágenes y banderas en `capi-frontend/public/boards/<mapa>/`.
- Las banderas de un tablero son `group.image` en el JSON.
- 29 fichas (23 libres, 6 premium CEO) en `capi-core/src/board/tokens.ts`, cada una con icono Lucide y modelo 3D.
- Modos: Clásico (turnos) y Async (reloj de arena por ficha).
- Presets de reglas: Rápida, Clásica, Moderna, Larga. Competitivo: 4 a 6 jugadores con cuenta, 2 h, reglas fijas, puntúa al ranking.
