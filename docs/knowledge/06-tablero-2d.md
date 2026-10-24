# Tablero 2D

Vista por defecto. Componentes React y CSS: **sin Three.js, sin canvas, sin WebGL**. Cada casilla y cada ficha es un elemento del DOM.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `components/game/Board2D.tsx` | Orquesta: suscripción a eventos, colas de animación, encuadre, implementa `IBoardScene` |
| `board2d/layout2d.ts` | Rectángulos en % a partir de `computeRingLayout` (esquinas 1.5, casillas 1.0, igual que el 3D) |
| `board2d/Tile2D.tsx` | Casilla: banda de color, imagen, nombre, bandera, precio, edificios, hipoteca |
| `board2d/Token2D.tsx` | Ficha con icono Lucide del token y salto por casilla |
| `board2d/Dice2D.tsx` | Dados lanzados desde la ficha al centro del tablero |
| `board2d/useViewport2d.ts` | Zoom con rueda, pellizco, arrastre, límites, `centerOn` |

## Casillas

- Las de arriba y abajo son verticales: imagen, nombre y precio apilados.
- Las laterales son apaisadas: imagen y texto en fila, con la imagen del lado de la banda.
- La banda de color va hacia fuera, como en el 3D.
- El tamaño de letra sale del ancho real del tablero (`box.width / 92` en `em`).
- Modo compacto cuando `ancho del tablero × zoom < 520 px`: se oculta precio y bandera, **nunca la imagen**. Al acercar vuelven.

## Animaciones

- Cola por jugador: `ROLLED` espera a los dados, `MOVED` camina casilla a casilla (140 ms por paso con salto `capi-hop`), `CARD_DRAWN` pausa hasta que se cierra la carta.
- `walk` lee posiciones de una ref, no del estado: si dependía del estado, el efecto que escucha al servidor se re-suscribía en cada paso y podía perder eventos.
- Los dados del HUD no aparecen en 2D: Board2D no llama a `onDiceRoll` y dibuja los suyos dentro del tablero, así acompañan al zoom.

## Encuadre

- Rueda: zoom alrededor del cursor (0.7× a 3.5×). Doble clic: recentra.
- Arrastre con botón izquierdo o un dedo; un arrastre suprime el clic de casilla.
- Pellizco con dos dedos. El gesto se captura en una variable local antes de `setViewport`: leer la ref dentro del actualizador tumbaba la pantalla al levantar un dedo.
- Límites: el arrastre manual tiene holgura de 0.75 pantallas (`OVERSCROLL`); el encuadre automático (`centerOn`) no tiene holgura, para no enfocar una esquina con media pantalla vacía.
- "Ver al jugador" y abrir una casilla centran y acercan a 1.5×.
- Modos de cámara (mismo botón que en 3D): mapa sigue el turno, mi ficha sigue la propia, bloqueada no se mueve. Solo siguen si hay zoom > 1.05; sin zoom cabe todo el tablero.
