# Métodos revisados y selección

| Método | Uso en esta versión | Límite principal |
|---|---|---|
| OCR de nombre, número y otros textos | Evidencia complementaria y búsqueda en catálogo | Reflejos, caracteres pequeños e idiomas; ya no bloquea capturar |
| Huellas visuales espaciales de imagen | Recuperar candidatas del índice sin texto, con dos orientaciones | Necesita referencias; puede confundir ilustraciones de aspecto parecido |
| Detalles locales FAST + parches binarios orientados | Reordenar candidatas comprobando puntos y consistencia espacial | Puede fallar con pocos detalles, mucho desenfoque o cambios grandes de escala |
| Metadatos: colección, numeración, PS/HP, ilustrador | Corroborar lecturas con fichas de referencia | Datos de catálogo no demuestran la variante física |
| ORB/SIFT con estimación geométrica avanzada | Revisado; no se incorpora OpenCV en este paquete | Más dependencia y validación; el comparador incluido es propio, no una implementación completa de ORB |
| Embeddings visuales, por ejemplo DINOv2 | Vía futura para recuperar candidatas con variaciones mayores | Requiere modelo y un índice precalculado compatible; no se ha conectado un modelo neuronal en esta entrega |
| Clasificación del Pokémon o logotipo de set | Señales complementarias posibles | El Pokémon o símbolo por sí solo no determina una carta exacta |
| LLM multimodal / servicio externo | No conectado | Requeriría backend, credenciales y evaluación; no debe inventar una referencia |

La decisión es combinar recuperación visual, detalles locales y OCR. No se instala una red neuronal ni se presenta el algoritmo local como IA avanzada entrenada.

Fuentes primarias consultadas:

- TCGdex, fichas de carta: https://tcgdex.dev/rest/card
- TCGdex, formatos y calidades de imágenes: https://tcgdex.dev/assets
- OpenCV, fundamentos de ORB (FAST y BRIEF): https://docs.opencv.org/4.13.0/d1/d89/tutorial_py_orb.html
- DINOv2, código y modelos del proyecto: https://github.com/facebookresearch/dinov2
- GitHub, ejecución manual de tareas: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- GitHub, artefactos descargables: https://github.com/actions/upload-artifact

No se redistribuyen fotografías del usuario en este paquete. Las huellas iniciales se han calculado a partir de referencias públicas de TCGdex.
