# Informe — Asistente virtual de navegación y simplificación RUT

**Para:** Diego Ramos / equipo  
**De:** Gabi Benitez  
**Fecha:** 31 ago 2026  
**Contexto:** Reunión 30 ago 2026 — Dirección de Agricultura Mendoza

## Resumen ejecutivo

Proponemos una **capa de asistente virtual por voz** sobre el portal de la Dirección de Agricultura, sin modificar la estructura de datos ni los sistemas analíticos existentes (Data Studio, Synapsis, EMSA, notebooks). El foco inmediato es:

1. Ayudar al productor a **encontrar información** en un portal denso.
2. **Simplificar la experiencia del RUT** (hoy ~65% de adopción) con guía paso a paso.
3. Demostrarlo con una **landing DEMO** + integración Dograh.

## Hallazgos del portal

- La landing concentra trámites (RUT/SIA), publicaciones, cultivos, monitoreo, herramientas digitales, precios y capacitaciones.
- La información es valiosa pero dispersa: requiere explorar muchas cards y links externos.
- El RUT se gestiona en SIA con un instructivo de 5 pasos + documentación según condición frente a la tierra; hoy el acceso es mail/clave (sin teléfono como identificador).

## Propuesta técnica (capa, no reemplazo)

```
Usuario ↔ Asistente voz (Dograh)
              ↓ HTTP tools
         Demo / futuro bridge
              ↓
     UI del portal (scroll, highlight, wizard)
```

- **No** rehacer BI ni conectar analítica profunda.
- **Sí** knowledge base del mapa del sitio + instructivo RUT.
- Tools que navegan la UI y abren un wizard RUT guiado.

Entregable DEMO en este repo: `demo-agricultura/`.

## Simplificación RUT (fases)

| Fase | Qué | Estado |
|------|-----|--------|
| DEMO | Wizard 5 pasos + voz + checklist docs | Implementado en demo |
| 1 | Embebido / piloto en entorno controlado del gobierno | Pendiente acuerdo |
| 2 | Canal WhatsApp / teléfono como identificador (N8N) | Explorar |
| 3 | Integración real con SIA (APIs / SSO) | Requiere acceso gobierno |

## Otros puntos de la reunión

- **QR que no funciona:** queda como ítem de corrección aparte; no bloquea la demo de navegación/RUT.
- **Migración de servidor / estabilidad N8N:** operación interna de esta semana; independiente de la demo de IA.

## Próximos pasos sugeridos

1. Ensayar la DEMO con el guion (`docs/DEMO-SCRIPT.md`).
2. Configurar el agente Dograh (`docs/DOGRAH-SETUP.md`) y presentar al gobierno.
3. Acordar si el piloto se hospeda en infraestructura propia o del ministerio.
4. Pedir accesos / APIs solo cuando se apruebe fase de integración SIA.

## Riesgos

- Percepción de “sitio oficial”: mitigado con banner DEMO.
- Serverless + SSE en multi-instancia: para piloto usar instancia única o relay.
- Cumplimiento: no capturar CUIT reales en la demo.
