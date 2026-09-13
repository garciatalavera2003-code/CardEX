# Professional Card Inspection — v1.8.0

Esta versión separa captura y reconocimiento, e incorpora búsqueda visual independiente del OCR.

## Actualizar ahora

1. Descomprime el ZIP.
2. Sustituye `index.html` y sube también la carpeta `data` completa. Sus cuatro archivos son necesarios para la búsqueda por imagen.
3. Sube `tools` y `.github` si vas a ampliar el índice con la tarea incluida; conserva su estructura.
4. Guarda los cambios en la rama/carpeta que publica tu GitHub Pages y espera al despliegue.
5. Abre la aplicación en Safari y comprueba **v1.8.0**. No uses la vista de código en github.com. Si aparece la versión antigua, recarga o prueba una pestaña privada.

No necesitas vaciar el repositorio. El HTML ya no basta por sí solo para todas las funciones: necesita sus datos visuales. La cámara requiere HTTPS.

## Qué cambia

- El OCR deja de bloquear la cámara. La captura espera enfoque inicial y un contorno estable con detalle suficiente, sin exigir leer el número.
- Se mantiene la fotografía de mayor resolución y el recorte de v1.6. La captura tolera breves pérdidas del contorno, evitando reiniciar la estabilidad por cada fallo aislado.
- Búsqueda global dentro del índice disponible por distribución espacial de color, luminosidad y bordes, en orientación normal y girada 180 grados.
- Segunda comprobación de las 12 mejores candidatas mediante esquinas FAST y descriptores binarios orientados. Se buscan detalles locales que coincidan y mantengan posiciones coherentes; no basta compartir el color o el tipo de carta.
- Si la coincidencia local es fuerte y destaca frente a alternativas, puede proponerse una referencia sin OCR. La identificación sigue pendiente de confirmación.
- Si no hay suficiente evidencia visual, se intenta leer el texto durante un máximo de 25 segundos. La lectura aporta evidencias; su fallo no elimina las candidatas visuales.
- El catálogo y sus fichas se siguen utilizando para obtener nombre, colección, número y otras propiedades.
- El reverso se conserva para inspección, pero su OCR genérico ya no retrasa el reconocimiento automático del frontal. No se verifica automáticamente que ambas imágenes pertenezcan al mismo ejemplar.
- Mantiene subida de imágenes, corrección de identificación, herramientas avanzadas y guardado de capturas.

## Cobertura inicial: limitación pendiente

El paquete contiene **206 referencias visuales EN** de **19508 registros EN con imagen elegibles** en la consulta realizada. La descarga masiva no pudo completarse en este entorno. NO es un índice completo de todas las cartas. El contador visible permite comprobar qué cobertura está instalada.

La búsqueda por imagen solo puede recuperar cartas presentes en ese índice. El catálogo OCR puede consultar muchas más referencias. Las referencias inglesas pueden ayudar a encontrar ilustraciones compartidas por otros idiomas, pero una imagen parecida no confirma idioma, edición ni acabado.

También se incluyen puntos visuales precalculados para las 206 referencias iniciales. Para otras referencias añadidas posteriormente, la aplicación intentará obtener sus imágenes y calcular los detalles localmente; depende de disponibilidad y CORS del proveedor.

## Ampliar el índice desde GitHub

La tarea incluida prepara los datos; NO cambia ni publica tu repositorio automáticamente.

1. Sube también `.github/workflows/build-visual-index.yml` y `tools/build_visual_index.py` a la rama principal.
2. Abre **Actions → Ampliar indice visual PCI → Run workflow**.
3. Espera a que termine. La primera descarga de miles de referencias puede tardar bastante; el progreso y los fallos aparecen en el registro. Se conservan descargas en caché para posteriores ejecuciones cuando GitHub la mantiene.
4. En la ejecución terminada, descarga el artefacto **PCI-indice-visual-actualizado**.
5. Descomprímelo y sustituye los archivos correspondientes dentro de `data` en tu repositorio. El artefacto contiene los archivos de datos en su raíz: colócalos dentro de `data`, no en la raíz de la aplicación.
6. Guarda el cambio y espera a que Pages lo publique. Comprueba el nuevo contador de referencias.

La tarea no se ha ejecutado en tu cuenta. Puede devolver cobertura parcial si hay referencias inaccesibles; revisa siempre el contador. No contiene claves API ni credenciales. Alternativamente, el generador se puede ejecutar con Python, Pillow y NumPy desde un ordenador.

Guía oficial de ejecución manual: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow

## Prueba realizada con tu captura

Se rectificó un recorte de la carta de la captura de pantalla usando esquinas marcadas para la prueba, no una sesión real de cámara. La búsqueda general encontró la referencia correcta entre sus primeras candidatas; por sí sola confundía ilustraciones parecidas. La comprobación local la colocó en primer lugar: **Impidimp, sv09-071, 071/159**, con **101 correspondencias coherentes**, frente a 2 de la siguiente candidata entre las 12 revisadas. No se utilizó OCR en esta prueba.

Esto valida ese ejemplo y la comparación local; NO demuestra una tasa de acierto general ni que el escáner vaya a funcionar perfectamente en el iPhone. No se ha probado aquí una cámara física.

Otras comprobaciones: recuperación de referencias conocidas, rechazo de imagen vacía, integridad de los datos, guardado sin OCR, flujo frontal/reverso, propuesta por imagen con datos controlados y conservación de reglas anteriores de identificación.

## Qué probar en tu iPhone 17 Pro Max

- Escanea la misma carta y comprueba que se guarda sin exigir leer el número.
- Escanea reverso y observa las candidatas/resultados de identificación.
- Prueba otras cartas. Si no están en el índice, amplíalo o utiliza la evidencia OCR disponible.
- Envía tiempo de captura, mensaje del resultado, contador de cobertura y fotografía original/recorte descargados desde las herramientas avanzadas.

## Límites

No se puede garantizar identificar todas las cartas ni todos los acabados a partir de cualquier foto. Reflejos, desenfoque, recortes incorrectos, reimpresiones con la misma ilustración y referencias ausentes pueden producir ambigüedad o errores. Las puntuaciones visuales no son probabilidades calibradas. Una propuesta requiere revisión; no se verifican autenticidad ni variante física. Grading y defectos avanzados siguen simulados.

Las fotos se procesan en el navegador y no se envían a TCGdex. Las fichas e imágenes de referencia se descargan del proveedor cuando hacen falta. Los datos visuales se cargan desde tu propia página de GitHub Pages.
