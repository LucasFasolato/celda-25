# Checklist de prueba antes del cumpleaños

Recorré todo en modo demo unos días antes. Tiempo estimado: 30–40 minutos.

## Configuración previa

- [ ] Migraciones ejecutadas y app desplegada (ver `DEPLOY.md`).
- [ ] Login en `/admin` funciona; cerrar sesión y volver a entrar.
- [ ] Nombres reales de los dos equipos cargados.
- [ ] 6 jugadores por equipo con nombre y teléfono `+54 9 ...`.
- [ ] Códigos reales de las 4 etapas configurados (reemplazan los `DEMO-*`).
- [ ] Códigos de credencial individuales configurados (12).
- [ ] Mensajes individuales revisados/editados para los 12 jugadores.
- [ ] Video Etapa 2 subido y reproducible en un celular.
- [ ] Audio Etapa 2 subido y reproducible.
- [ ] Audio final subido.
- [ ] QR de cada equipo descargado e impreso (+ recortado el de la Etapa 1).
- [ ] QR señuelo impreso apuntando a `/intervenido`.

## Recorrido de juego (hacerlo con un equipo de prueba)

- [ ] Escanear QR verdadero → carga la terminal del equipo correcto.
- [ ] Escanear QR señuelo → pantalla "CANAL INTERVENIDO", sin pistas.
- [ ] Token inválido (`/celda/cualquiercosa`) → "ACCESO DENEGADO".
- [ ] Abrir la misma URL en 2 dispositivos → ambos ven el mismo estado.
- [ ] "Iniciar equipo" desde el panel → cronómetro corre en ambos dispositivos.
- [ ] Etapa 1: código incorrecto descuenta intentos; el 5º error bloquea 5 minutos con cuenta regresiva.
- [ ] "Quitar bloqueo" desde el panel lo levanta al instante.
- [ ] Código correcto de Etapa 1 → animación y pase a Etapa 2.
- [ ] Video y audio se reproducen, pausan y repiten.
- [ ] Código correcto de Etapa 2 → se crean 6 mensajes (simulados o reales) y se ve "canal clandestino activado".
- [ ] En el panel: los 6 mensajes aparecen con estado; copiar y "WhatsApp manual" funcionan.
- [ ] Etapa 3: cargar una credencial → jugador pasa a "LOCALIZADO"; reusarla avisa que ya fue usada.
- [ ] Con 6/6 aparece el campo del código de Etapa 3.
- [ ] Código final correcto → pantalla FUGA COMPLETADA con rejas, confeti y tiempo.
- [ ] "ACTIVAR SONIDO DE FUGA" reproduce el audio final.
- [ ] El primer equipo queda como GANADOR; el segundo puede seguir y termina como "FUGA COMPLETADA".
- [ ] Pausar/reanudar congela y retoma el cronómetro (recargar la página no lo pierde).
- [ ] "Solicitar pista" → alerta en el panel → responder → aparece en la pantalla del equipo.
- [ ] Historial muestra todos los eventos del recorrido.

## Reset final

- [ ] "REINICIAR PARTIDA" (borra progreso, mensajes y pistas; mantiene configuración).
- [ ] Verificar que ambos equipos quedaron en "Preparado" con cronómetro en 0.
- [ ] Guardar los QR impresos y esconder los materiales físicos. 🔒
