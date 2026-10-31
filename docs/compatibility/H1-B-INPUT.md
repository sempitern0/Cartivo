# H1-B — primer incremento de entrada

Fecha: 2026-10-31. Estado: **laboratorio de entrada implementado; H1 jugable pendiente**.

## Base integrada y decisión NES

Merge `acf158f102e238c6d5bc64623eba548724fb7993` incorpora `main` (`d5cb3ee852999e3651c7580ac4c37398624ac990`) en `feat/h1-session-foundation`, conservando sus dos commits de implementación. Los únicos cambios entrantes eran seis documentos nuevos en `docs/research/`; no hubo conflictos de contenido.

Se consultaron los seis informes. [H0_NES_CORE_CANDIDATES](../research/H0_NES_CORE_CANDIDATES.md) propone evaluar TetaNES primero y JSNES como comparador; **no acepta ninguno**. Se sustituye la prioridad provisional de binjnes del registro H1-A por ese orden. No se incorpora el binario upstream explorado localmente: todavía no existe expediente completo ni build reproducida. No se repite la matriz preliminar ni se presenta el shell como prueba del núcleo.

Próximo paso de núcleo: completar únicamente los huecos NES-RESEARCH-01/02 para un commit concreto de TetaNES (dependencias/toolchain/build, fixture propio y pruebas de input/audio/SRAM), utilizando JSNES como comparador si aporta evidencia. La selección queda pendiente de esos resultados. No se añade otro sistema.

## Implementado

- `packages/input/src/nes-input.ts`: estado NES P1 independiente de la ABI, teclado, layout standard y bindings manuales de botones/ejes; zona muerta configurable en la prueba. Direcciones opuestas se neutralizan.
- Laboratorio separado del flujo de juego. Sondeo Gamepad API con fallback de teclado; no depende exclusivamente de eventos de conexión.
- Asignación de ocho controles para mandos standard o no estándar: esperar liberación, rechazar colisiones, cancelar con Escape y restablecer. Inputs simultáneos no completan una asignación.
- Perfiles locales validados, sin envío de identificadores. Recuperación explícita: no se aplican automáticamente al reconectar. Un perfil corrupto o un fallo de almacenamiento produce un mensaje, sin bloquear el teclado.
- Entrada limitada a una zona con foco; Tab permite salir. Blur, pestaña oculta, desconexión y cambio observado de dispositivo neutralizan el estado y detienen la prueba. Al reactivar hay que soltar todos los controles.
- Los índices no identifican dispositivos. Una sustitución indistinguible entre sondeos y sin evento del navegador no es detectable; no se promete identidad estable.

## Evidencia de esta iteración

Entorno Linux de desarrollo, Node 24.22.1, pnpm 11.25.0. `pnpm check`: 0 errores y 0 advertencias. `pnpm lint`, 13 tests unitarios y `pnpm build`: aprobados.

5 E2E aprobados con Playwright 1.64.1 y Chromium headless 153.0.8010.0: ciclo del Worker, teclado/foco/Tab, mando standard/desconexión/reutilización de índice, asignación manual/persistencia/aplicación explícita y teclado cuando Gamepad API se deniega. Los mandos de E2E son **sintéticos**. Revisión visual de captura móvil a 360 px y comprobación automatizada de ausencia de desbordamiento.

El navegador local se obtuvo temporalmente mediante `@sparticuz/chromium`, fuera del proyecto, tras fallos de descarga de Playwright en la iteración anterior. `CARTIVO_CHROMIUM_PATH` permite señalar un ejecutable local; CI mantiene el Chromium distribuido por Playwright. El resultado local no acredita que el workflow remoto haya pasado.

## Probar en Windows

Con Node y pnpm ya instalados, desde el repositorio:

```powershell
git fetch origin
git switch feat/h1-session-foundation
git pull --ff-only
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

Abrir http://127.0.0.1:5173 → Laboratorio → Prueba de controles.

1. Teclado: Activar prueba; flechas, X=A, Z=B, Mayús derecha=Select, Enter=Start. Cada pulsación debe aparecer y liberarse. Tab o Escape detienen la entrada; volver a Activar prueba para continuar.
2. Conectar mando USB/Bluetooth y pulsar un botón. Elegirlo en Mando. Activar prueba; verificar cruceta/stick izquierdo, botón inferior=A, derecho=B, Select y Start si el navegador declara layout standard.
3. Si necesita asignación o el layout no resulta cómodo, Asignar controles y seguir los ocho pasos, soltando cada control. Reutilizar un botón debe rechazarse. Probar la zona muerta contra el drift.
4. Mantener una dirección y desconectar el mando o cambiar de ventana: todo debe quedar Libre. Reconectar requiere activar la prueba. Un botón mantenido no se acepta hasta soltarlo.
5. Asignar, recargar, seleccionar el mando y Aplicar perfil guardado. Verificar los ocho controles. Restablecer mando elimina el perfil local.
6. Registrar modelo (sin serial), USB/Bluetooth, Windows, versión de navegador y resultado en la plantilla [GAMEPAD_BROWSER_QA](../research/GAMEPAD_BROWSER_QA.md). No marcar un PASS de hardware por los E2E.

Validación automatizada opcional:

```powershell
pnpm.cmd check
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e
```

## Gates abiertos

No hay emulación, audio, save data, instalación/offline ni pruebas de mando físico. No se afirma H0-NES ni H1 completos. Falta integrar este estado de entrada con el núcleo aceptado, navegación de la aplicación con mando, QA de lectores de pantalla, Firefox/Safari y hardware real. La zona muerta se ajusta en la sesión de prueba; no se persiste con el perfil. Solo un jugador, sin rumble.

## Corrección de detección y teclado (31-10-2026)

El selector permanecía en «Solo teclado» incluso con mandos disponibles. Ahora se selecciona el primer mando visible al abrir el laboratorio o al conectarse, combinando sondeo y evento `gamepadconnected`. Si se elige explícitamente Solo teclado, se respeta esa elección mientras el laboratorio permanezca abierto. Conectar/reconectar no activa entradas ni recupera un perfil manual sin confirmación.

Se muestran estados distintos para API ausente, acceso bloqueado, contexto no seguro y ningún mando expuesto. La conexión física USB no garantiza exposición inmediata: [Firefox exige interacción con el mando mientras la página está visible](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API). No se solicita acceso WebUSB ni se afirma poder eludir esta restricción.

Teclado: botones visibles `A = X`, `B = Z` y las otras seis asignaciones. Pulsar la asignación y después la nueva tecla; Escape cancela, Tab sale. Se rechazan colisiones y atajos reservados. Perfil validado, persistente localmente y restablecible. Las etiquetas usan posiciones físicas `KeyboardEvent.code`; layouts no QWERTY pueden tener otros caracteres impresos.

Validación: 14 tests unitarios y 8 E2E en el Chromium/Linux ya indicado; tipos sin errores/advertencias, lint y build aprobados. Las pruebas nuevas cubren autodetección, exposición tardía/evento, preferencia explícita de teclado y remapeo/persistencia. Mando físico del usuario aún pendiente.

Validación manual: actualizar la rama, abrir el laboratorio, conectar USB y pulsar un botón con la página activa. Debe aparecer el nombre del mando y seleccionarse. Activar prueba y soltar controles; comprobar pulsaciones. Cambiar `A = X` por C, probar C, recargar y confirmar persistencia. Si no aparece ningún mando, comprobar Windows con `Win+R` → `joy.cpl` y registrar modelo, navegador y el mensaje de conexión que muestra Cartivo.
