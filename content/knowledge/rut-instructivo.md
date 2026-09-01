# Instructivo RUT Digital — Sistema de Información Agrícola (SIA)

Fuente: Instructivo SIA RUT Digital — Ministerio de Economía y Energía, Subsecretaría de Agricultura y Ganadería, Dirección de Agricultura (Mendoza).
Portal SIA: https://sia.mendoza.gov.ar/account/login

## Antes de la declaración jurada
1. Crear cuenta en el SIA (botón "Creala!").
2. Confirmar el correo electrónico. El CUIT debe ser el de quien hace uso de la tierra (sociedad ? CUIT de la sociedad; sucesión ? CUIT de la sucesión). Cada CUIT se asocia a un correo único. Se pueden registrar varios RUT bajo el mismo CUIT.
3. Ingresar a "Declaraciones Juradas".
4. Clic en "Nueva!".
5. Completar 5 pasos. Al final de cada paso: guardar cambios y clic en "Siguiente".

## Paso 1 — Titular / Productor
Datos de quien hace uso de la tierra:
- CUIT
- Tipo de persona: Persona humana; Sucesiones; Sociedades Sección IV (de hecho); Sociedades Comerciales (S.A., S.R.L., S.A.S.); Cooperativas; Asociaciones Civiles; Fideicomisos
- Razón Social (como en AFIP)
- Tipo y Número de Documento (NP si no posee; 0 en sociedades comerciales)
- Condición frente al IVA
- CBU y/o CVU (para potenciales beneficios)
- Dirección del productor
- Condición frente a la tierra: Titular; Usufructuario; Locatario/Arrendatario; Mediero; Fideicomiso; Comodatario; Aparcero; Apoderado
- RENSPA (SENASA) si tiene
- RUT anterior si tiene
- Contacto: teléfono y correo

## Paso 2 — Establecimiento
Datos de la propiedad y titulares registrales:
- ¿El titular del Paso 1 es propietario? Si sí, se reutilizan datos; si no, cargar CUIT/tipo/razón social del/los titulares.
- Nombre del establecimiento (opcional)
- Catastro (mínimo uno; de boleta Impuesto Inmobiliario ATM)
- Irrigación (mínimo uno; riego superficial y/o pozo)
- Ubicación: Provincia fija Mendoza; Departamento, Localidad, Distrito; Dirección y CP
- Superficie utilizada (cultivada, callejones, construidas)
- Ubicación geográfica: dibujar polígono en el mapa

## Paso 3 — Agrícolas
Datos generales SI/NO: alambrado, cortina forestal, galpón de maquinaria, depósito de agroquímicos, sitio de proceso (empaque), proceso postcosecha, semilla de uso propio, malezas resistentes.

Cada Lote de Cultivo se define por: Especie*, Variedad*, Superficie* (ha, 3 decimales), Sistema de Riego*, Sistema de Conducción*, Año de Implantación* (4 dígitos). Si cambia alguno, crear lote nuevo. Presionar "Agregar".

Por lote adicional: en producción SI/NO; producción estimada (kg/qq); superficie malla antigranizo*; invernadero; tipo de siembra; densidad; trincheras; plantas aisladas; defensa contra heladas; orgánico; consociado; destinos.

## Paso 4 — Archivos (documentación)
Obligatorios (*):
1. Constancia de CUIT
2. Documentación legal según condición frente a la tierra:
   - Titular: Escritura pública / boleto de compra-venta (sellado Rentas, firmas certificadas; propiedad identificada)
   - Usufructuario: Escritura pública
   - Locatario/Arrendatario: Contrato de locación/arrendamiento
   - Mediero: Contrato de mediería
   - Fideicomiso: Escritura / contrato de fideicomiso
   - Comodatario: Contrato de comodato
   - Aparcero: Contrato de aparcería
   - Apoderado: Poder con inscripción
3. Documentación adicional si corresponde (condóminos, sucesión, modificaciones de catastro)
4. Boleta Impuesto Inmobiliario
5. Boleta de Riego o Pozo
6. Censo/DJ INV (solo si tiene vid)
7. Constancia RENSPA si se declaró número RENSPA

Se puede cargar un archivo general o por ítem. Instructivo de carga de archivos disponible en el SIA.

## Paso 5 — Terminar
Verificar datos y documentación. Presionar "Enviar".
Un administrador revisa. Estados:
- Esperando: en revisión
- Corregir: hay que modificar (aviso por correo)
- Aceptada: se puede descargar la Constancia del RUT

La Constancia del RUT debe renovarse anualmente.

## Notas para el asistente de voz (DEMO)
- Esta DEMO no envía datos al SIA. Solo simula el recorrido.
- No pedir contraseñas ni CUIT reales por voz; usar ejemplos ficticios.
- Guiar paso a paso y usar las tools `open_rut_wizard`, `set_rut_step`, `show_doc_checklist`.
- Recordar: primero crear/confirmar cuenta en SIA real; luego Declaraciones Juradas ? Nueva.
