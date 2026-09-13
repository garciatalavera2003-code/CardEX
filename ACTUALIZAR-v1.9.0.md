# CardEX / Professional Card Inspection — actualización 1.9.0

## Instalar sin perder las 19.507 referencias inglesas

Este ZIP es una ACTUALIZACIÓN del repositorio CardEX existente. NO borres el repositorio ni la carpeta data. No sirve como paquete completo para un repositorio vacío.

1. Descomprime el ZIP en el ordenador.
2. En GitHub → CardEX → Code, sube `index.html` a la raíz sustituyendo el anterior.
3. Añade a la carpeta `data` los dos archivos nuevos: `visual-index-ja.json` y `visual-index-ja.bin`. Conserva TODOS los archivos ingleses `visual-index.json`, `visual-index.bin`, `local-features.json` y `local-features.bin` que ya tienes.
4. Sustituye `tools/build_visual_index.py` y añade `.github/workflows/build-japanese-index.yml` en sus carpetas exactas. Este workflow es opcional para futuras ampliaciones; no necesitas ejecutarlo para probar esta versión.
5. Guarda los cambios (Commit changes). Espera a que finalice correctamente la publicación de GitHub Pages.
6. Abre https://garciatalavera2003-code.github.io/CardEX/?v=1.9.0 y comprueba que aparece **v1.9.0**.

No subas el ZIP como un único archivo. Conserva las carpetas: los archivos de data no van sueltos en la raíz. Si tu explorador oculta `.github`, puedes crear ese archivo desde GitHub con su ruta completa. Esto no bloquea la actualización principal: el índice japonés ya está generado en el ZIP.

## Qué cambia

### Cartas holográficas / reflejos

Activa **Modo holográfico / reflejos** antes de escanear el frontal. El modo habitual sigue usando el proceso rápido anterior.

- Si falla el contorno inicial, el detector prueba canales de color por separado y mantiene la comprobación de geometría. Un contorno ambiguo no se acepta automáticamente.
- Después de la primera toma, inclina ligeramente la carta para desplazar el reflejo. La app puede guardar hasta tres vistas diferentes; conserva como principal la de mejor puntuación de detalle con penalización orientativa de zonas blancas saturadas.
- Puedes pulsar **Terminar ahora** para continuar con las tomas disponibles. Si no aparece una vista distinta durante 8 segundos y vuelve a haber una captura válida, continúa con las imágenes ya válidas. Nunca guarda automáticamente un fotograma borroso solo porque haya pasado ese tiempo.
- Se compara cada vista por separado y se conserva su mejor coincidencia; no se suman artificialmente los puntos de vistas distintas.
- La búsqueda visual puede excluir una parte limitada de zonas casi blancas y saturadas. Esta comparación sirve para encontrar candidatas; necesita corroboración de detalles locales antes de proponer una referencia solo por imagen.
- En fotografías subidas, activar el modo también aplica la detección alternativa y la comparación tolerante a reflejos. Solo habrá una vista si subes una sola fotografía.
- Las fotografías conservan sus píxeles originales y su recorte corregido. No se inventa información bajo el reflejo ni se fusionan imágenes para simular detalle.

Usa luz indirecta; una luz frontal intensa suele aumentar el reflejo. Conserva las cuatro esquinas visibles. La opción de tomar una foto manual sigue disponible y pide confirmación si no supera el control de detalle.

### Cartas japonesas

- El modo Automático incorpora lectura japonesa, inglesa y española. La primera descarga de los modelos de texto puede tardar; ocurre después de guardar la captura.
- Ya no se omite la comprobación de idioma en automático solo por encontrar una ilustración inglesa parecida.
- Se consulta el catálogo `ja` y un índice visual japonés independiente. Se muestran el nombre japonés, la colección japonesa, la numeración y el ID de esa referencia; el idioma se muestra como **日本語 / Japonés**.
- Si los textos están borrosos, una coincidencia visual suficientemente diferenciada con una referencia japonesa también puede orientar el idioma. Compartir una ilustración con la versión inglesa no basta.
- Puedes elegir **日本語** en el selector para buscar exclusivamente referencias japonesas. Si ese índice no está disponible, la app no sustituye silenciosamente su ficha por una inglesa.
- Se normalizan caracteres de ancho completo y nombres japoneses sin espacios. El código japonés de colección se utiliza cuando el OCR consigue leerlo.

La referencia se propone para revisión. El acabado físico exacto (holo, reverse, otras variantes), la autenticidad y el grading profesional no se certifican con esta actualización.

## Cobertura incluida

**3.882 / 3.882 referencias japonesas con imagen, generadas el 13 de septiembre de 2026.** El catálogo consultado contiene 12.781 fichas japonesas en total; 8.899 no tienen imagen. Se recuperaron las 20 descargas que fallaron en el primer intento.

El contador inglés debe conservar la cantidad que ya tenías publicada. El índice japonés se muestra por separado. No son todas las cartas japonesas existentes: el catálogo tiene fichas sin imagen de referencia. Esas fichas pueden aparecer por texto, pero su correspondencia visual queda pendiente de revisión.

## Actions: cuándo usarlo

**No tienes que ejecutar Run workflow para instalar ni probar esta actualización.** Sus datos japoneses ya están incluidos. Cambiar HTML o interfaz tampoco exige reconstruir índices.

Para incorporar nuevas imágenes japonesas en el futuro:

1. Actions → **Actualizar indice japones PCI** → Run workflow.
2. Espera a que termine y descarga el artefacto **PCI-indice-japones-actualizado** de esa ejecución.
3. Descomprímelo y sustituye únicamente los dos archivos `visual-index-ja.*` en `data`.
4. Guarda los cambios y espera a la publicación de Pages.

El workflow genera un artefacto; NO modifica ni publica por sí solo el repositorio. El workflow inglés **Ampliar indice visual PCI** sigue siendo independiente. El script ahora acepta `--language ja` o `--language en`; por defecto conserva la salida inglesa habitual.

## Comprobaciones realizadas y límites

- Pruebas de regresión de captura: enfoque insuficiente, captura manual, estabilidad, cancelación durante el recorte y cierre de cámara.
- Pruebas del flujo de identificación con respuestas controladas: catálogo japonés, ausencia de OCR, índice japonés no disponible, idioma ambiguo, nombre e ID japoneses y reconocimiento inglés previo.
- Pruebas de tres tomas: descarte de duplicados automáticos, finalización con las disponibles y limpieza al cerrar la cámara.
- Comparación sobre el índice inglés publicado de 19.507 referencias: tres pruebas con áreas blancas añadidas artificialmente. La referencia correcta quedó primera con el modo de reflejos; esto es una prueba sintética, no una tasa de acierto con cartas físicas.
- Detección de un contorno sintético con brillo y rechazo de una imagen totalmente blanca.
- Lectura del nombre ベロバー y de 064/102 en una imagen japonesa de referencia usando Tesseract nativo; no equivale a una prueba de cámara en Safari.
- Integridad de los índices y pruebas de recuperación de referencias japonesas: se verificaron las 3.882 entradas y sus tamaños binarios. La imagen japonesa ベロバー, SV7-064, quedó primera. Frente a la referencia inglesa de la misma ilustración, sv07-094, la comparación de título y pie obtuvo 157 detalles coherentes para la japonesa y 69 para la inglesa; la decisión de idioma fue japonesa sin OCR. Son datos de esta imagen de referencia, no una estimación de acierto general.

No se ha probado esta versión en un iPhone 17 Pro Max físico ni con tus dos cartas holográficas concretas. El comportamiento real depende del reflejo, enfoque y cobertura del catálogo. No se garantiza identificar una carta cuyo diseño y numeración estén ocultos.

## Feedback más útil

Prueba primero una inglesa normal, después las dos holográficas con el modo activado y después una japonesa en Automático. Si una japonesa queda incierta, repite el reconocimiento eligiendo 日本語, sin necesidad de volver a fotografiarla.

Si falla, envía:
- Foto original del frontal que ha guardado la app, idealmente también otra con un ángulo distinto.
- Captura del resultado o del punto donde se detiene.
- El diagnóstico descargable en «Qué se ha leído y comparado».
- Si el problema es que no termina de capturar o que captura pero no identifica.

Fuentes técnicas: [fichas de TCGdex](https://tcgdex.dev/rest/card) y [idiomas de Tesseract](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html). Las imágenes de referencia y las marcas Pokémon pertenecen a sus respectivos titulares.
