# Libro de Recolección

Registro semanal de Finca El Diviso: recolección de café, jornales y contratos por lote, insumos y facturas, pago del mayordomo, salidas de pergamino y resumen de costos con costo de producción por carga.

Página publicada: https://pipe210588.github.io/eldivisorecoleccion/

## Quién ve qué

Cada finca tiene un usuario con dos contraseñas: la del dueño y la del mayordomo.

| Sección | Dueño | Mayordomo |
|---|---|---|
| Recolección | Todo | Solo los kilos de hoy |
| Jornales y contratos | Todo, incluido marcar pagos | Labores de hoy y contratos de la semana actual; no marca pagos |
| Insumos y facturas, Mayordomo, Pergamino, Resumen | Todo | No las ve |
| Informe del dueño (PDF) | Sí | No |

- Un **contrato** cubre toda la semana; por eso no tiene día.
- Los **lotes** se administran en Jornales → "Lotes de la finca". La primera vez se pueden cargar los 6 lotes de El Diviso con un botón.

## Datos (Firebase)

- `fincas/{finca}/semanas/{lunes}`: recolección.
- `fincas/{finca}/jornales/{lunes}`: registro diario de labores y pagos por trabajador.
- `fincas/{finca}/compartido/config`: lotes, trabajadores y valor del jornal.
- `fincas/{finca}/privado/{lunes}`: insumos, pago del mayordomo y pergamino. Solo el dueño.
- `fincas/{finca}/privado/config`: sueldo base del mayordomo. Solo el dueño.

Las reglas de seguridad están en `firestore.rules`, como copia de referencia. Las reglas que valen son las publicadas en la consola de Firebase.

## Límite conocido

Que el mayordomo solo escriba "el día de hoy" lo controla la página. Firebase controla que no vea las secciones privadas ni marque pagos.
