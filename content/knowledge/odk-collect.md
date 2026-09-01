# ODK Collect y el código QR

## ¿Para qué es?

**ODK Collect** es una app de Android para cargar formularios en el campo (relevamientos, encuestas, datos productivos).  
El **código QR** del portal **no es un link web**: es la configuración del proyecto. Al escanearlo, el celular queda apuntando al servidor correcto de formularios de la Dirección (URL, proyecto y ajustes), sin tipear nada a mano.

## Qué contiene el QR (análisis)

Un QR de ODK Collect suele llevar un JSON (a veces comprimido) con, entre otros:

| Campo | Para qué sirve |
| --- | --- |
| `general.server_url` | URL del servidor ODK / Aggregate / Central |
| `general.username` | Usuario de la app (si aplica) |
| `general.protocol` | Protocolo (`odk_aggregate`, etc.) |
| nombre / proyecto | Cómo aparece el proyecto en Collect |

**No es** una URL para abrir en el navegador. Si lo escaneás con la cámara del teléfono (fuera de Collect), no “entra” al trámite web.

## Cómo se usa (pasos de la app)

1. Instalá **ODK Collect** desde Google Play (Android).
2. Abrí la app.
3. Pulsá **Agregar proyecto** (o el ícono de proyecto → Agregar proyecto).
4. Elegí **Escanear código QR**.
5. Escaneá el QR.
6. Después podés **Descargar formulario** y completar en campo.

## Relación con esta demo

- En el sitio oficial hoy el QR a veces **no está publicado o falla** (ítem operativo).
- En la DEMO hay un **facsímil educativo** embebido en la sección `odk-collect` (`/odk/demo-odk-collect.png`) cuyo payload está en `/odk/demo-odk-payload.json`.
- Ese facsímil **no reemplaza** el QR oficial: sirve para mostrar la forma del contenido y el flujo Agregar proyecto → escanear.
- Si el usuario pregunta “qué es el QR” / “ODK” / “cómo cargo el formulario del celular”, explicá estos pasos, marcá la sección y mencioná que el embebido es DEMO.

## Frases típicas del productor

- “¿El QR para qué es?”
- “Cómo uso ODK”
- “Agregar proyecto”
- “Formulario del celular / relevamiento en campo”
