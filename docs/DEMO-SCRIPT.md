# Guion de demo (10–12 min)

## Preparación (2 min antes)

1. Abrir la DEMO en Chrome/Edge (HTTPS o `localhost`).
2. Permitir micrófono.
3. Verificar chip **Sesión DEMO** abajo a la izquierda.
4. Tener Dograh configurado o, de respaldo, otra ventana con los `curl` del README.

## Guion

### 1. Contexto (1 min)
> “Esta es una réplica DEMO de la landing de la Dirección de Agricultura. No tocamos sus sistemas ni bases de datos. Agregamos una capa de asistente por voz que navega la página y guía el RUT.”

Mostrar el banner DEMO y el sitio oficial en otra pestaña.

### 2. Navegación por cultivo (2 min)
Decir al asistente:
> “Quiero ver información de ciruela.”

Esperado: scroll + highlight en **Ciruela**. El agente explica que ahí están informes / tableros del cultivo.

### 3. Herramientas (1–2 min)
> “¿Dónde están los mapas agrícolas?”

Esperado: navega a **Mapas Agrícolas** / bloque Herramientas.

Opcional:
> “Mostrame el radar meteorológico.”

### 4. RUT guiado (5 min)
> “Necesito inscribirme en el RUT.”

Esperado:
1. Abre `/rut`
2. Explica: crear cuenta SIA → confirmar mail → Declaraciones Juradas → Nueva
3. Recorre pasos 1–3 con datos de ejemplo
4. En paso 4 muestra checklist según condición (probar “soy locatario”)
5. Paso 5: estados Esperando / Corregir / Aceptada + renovación anual

Cierre del bloque:
> “En producción esto se conectaría al SIA. Hoy es solo simulación local.”

### 5. Capacitaciones (1 min, opcional)
> “¿Cómo me anoto en Buenas Prácticas Agrícolas?”

Esperado: sección BPA + mail `direcciondeagricultura@mendoza.gov.ar`.

### 6. Cierre (1 min)
Puntos a dejar claros:
- Capa de navegación sin pisar BI / Synapsis / EMSA existentes
- RUT más amigable (voz + wizard); fase 2 posible: WhatsApp / teléfono
- QR roto y migración de servidores son ítems aparte (informe)

## Plan B si falla el micrófono / Dograh

Usar el `sessionId` del chip y ejecutar:

```bash
# Ciruela
curl -X POST http://localhost:3000/api/agent/action \
  -H "Content-Type: application/json" \
  -H "x-demo-secret: demo-secret-change-me" \
  -d '{"sessionId":"SESSION","action":"navigate","target":"ciruela"}'

# Abrir RUT paso 4 checklist
curl -X POST http://localhost:3000/api/agent/action \
  -H "Content-Type: application/json" \
  -H "x-demo-secret: demo-secret-change-me" \
  -d '{"sessionId":"SESSION","action":"show_checklist","payload":{"condicion_tierra":"Locatario/Arrendatario"}}'
```

Mientras, narrar vos lo que haría el agente.
