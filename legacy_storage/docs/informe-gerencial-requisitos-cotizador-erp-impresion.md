# Informe Gerencial de Requisitos Minimos

## Proyecto evaluado

Sistema de cotizacion para flexografia regular con enfoque en productos de impresion, inventarios y futura integracion ERP.

## Objetivo del informe

Definir, con claridad ejecutiva y operativa, la informacion minima que el cliente debe entregar para:

1. Cotizar correctamente cada producto.
2. Calcular el costo total por linea y por producto.
3. Parametrizar el sistema sin ambiguedades.
4. Preparar una implementacion estable con inventarios, catalogos, maquinas, troqueles, materiales y posible integracion con SAP u otro ERP.

## Base de la evaluacion

La evaluacion se realizo sobre la estructura encontrada en `Z:\ERP Impresion\Codexv15`, especialmente:

- especificacion funcional del flujo `flexografia regular`
- mapeo del cotizador original a web
- plan de integracion de catalogos
- motor de calculo del flujo regular
- esquema de base de datos y catalogos de ejemplo
- servicios de inventario y conectores SAP

## Conclusion ejecutiva

El proyecto ya tiene una base funcional clara para cotizacion de flexografia regular, pero depende totalmente de la calidad de los datos maestros del cliente. Sin esos datos, el sistema puede mostrar pantallas y guardar cotizaciones, pero no puede garantizar costos correctos ni trazabilidad suficiente para produccion, proforma, inventario o integracion ERP.

La implementacion solo debe iniciarse formalmente cuando el cliente entregue, como minimo, informacion validada en ocho dominios:

1. clientes y condiciones comerciales
2. catalogo de productos
3. materiales e inventario de materia prima
4. maquinas y capacidades productivas
5. tintas, barnices, laminados y otros consumibles
6. troqueles y herramientas
7. planchas, cyrel y preprensa
8. reglas de costeo, impuestos, comisiones, desperdicios y moneda

Si cualquiera de esos ocho dominios llega incompleto, el sistema puede cotizar, pero cotizara con supuestos, y eso eleva el riesgo comercial y operativo.

## Lo minimo que el cliente debe entregar

### 1. Informacion comercial y de cliente

Datos imprescindibles:

- codigo de cliente
- nombre legal y nombre comercial
- NIT o identificacion fiscal
- moneda habitual de cotizacion
- condicion de pago
- plazo de credito
- lista de precios o segmento comercial
- vendedor asignado
- direccion fiscal y direccion de entrega
- contactos de compras, facturacion y produccion
- correo para envio de cotizaciones
- exoneracion fiscal si aplica
- porcentaje de descuento o condicion comercial especial si aplica

Por que es imprescindible:

- determina impuestos, moneda, descuentos, credito y formato comercial de salida
- permite ligar cotizaciones, ordenes y seguimiento
- habilita integracion con SAP u otro ERP por codigo maestro del socio de negocio

### 2. Catalogo de productos

Datos imprescindibles:

- codigo de producto
- nombre comercial del producto
- tipo de producto
- familia o linea
- descripcion tecnica
- unidad de venta
- unidad de produccion
- si se factura por unidad, millar, rollo, juego, metro o kilogramo
- si el producto es regular, frente-dorso, licitacion o caso especial
- si el producto requiere etiquetado automatico o manual
- si el producto requiere catalogo propio o sera tomado desde otro sistema

Preguntas que deben quedar resueltas:

- el cliente quiere crear catalogo dentro del sistema o consumirlo desde SAP
- el catalogo tendra versionado
- quien autoriza altas, bajas y cambios de productos
- el producto se cotiza por especificacion abierta o por SKU cerrado

Riesgo si no se define:

- se duplican productos
- cambian unidades entre ventas y produccion
- los calculos terminan mezclando criterios distintos para el mismo articulo

### 3. Datos minimos por linea de cotizacion

Este es el minimo obligatorio para que una linea pueda calcularse:

- cliente
- nombre del trabajo
- proceso productivo: convencional, digital o hibrido
- tipo de orden: nuevo, repeticion, repeticion con cambio, pruebas, muestras o regalias
- orden de referencia si es repeticion
- tipo de producto
- cantidad de productos
- dimensiones del producto
- ancho de rollo o ancho de material
- material seleccionado
- tipo de etiquetado
- tipo de salida del rollo si el etiquetado es automatico
- configuracion de tintas
- acabados y adicionales

Adicionales recomendados desde el inicio:

- cantidad de cambios
- cantidad de tipos
- version del trabajo
- codigo de arte
- version de costos
- facturar en juegos si aplica
- etiquetas por rollo
- ancho de core
- diametro del core

## Datos necesarios para formular los calculos

## 4. Formula general que necesita datos maestros

Para que el sistema pueda llegar a un total por producto, necesita alimentar estos bloques:

1. material
2. preprensa
3. montaje
4. tintas
5. tiraje o impresion
6. laminado
7. barniz
8. troquel
9. arte
10. cyrel o planchas
11. maquila
12. flete
13. empaque
14. imprevistos
15. financieros
16. rendimiento bruto o margen
17. comisiones
18. IVA

Si falta el dato fuente de alguno de esos bloques, el total final queda incompleto o adulterado por estimaciones.

### 5. Datos tecnicos del producto

Datos imprescindibles por especificacion:

- ancho de etiqueta
- largo de etiqueta
- ancho de rollo
- separacion horizontal
- separacion vertical
- cantidad total a fabricar
- cantidad por presentacion si hay escalas
- cantidad de etiquetas por rollo
- cantidad de rollos
- orientacion de salida
- tipo de core
- diametro final del rollo
- tolerancias permitidas
- si lleva impresion o va sin impresion

Estos datos permiten calcular:

- pasos por linea
- filas
- largo total a producir
- pies lineales
- pies lineales con merma
- MSI base
- MSI con merma
- area
- peso teorico
- tiempo de tiraje

### 6. Datos del material y sustrato

Datos imprescindibles:

- codigo interno del material
- descripcion comercial
- nombre tecnico
- familia
- proveedor
- marca
- modelo o referencia
- bodega
- adhesivo
- calibre
- gramaje
- ancho disponible
- largo o presentacion si aplica
- unidad de consumo
- costo por MSI
- costo por KG
- costo por metro lineal
- costo unitario
- compatibilidad con flexografia convencional
- compatibilidad con digital
- estado activo o inactivo
- identificador SAP si existe

Datos de inventario altamente recomendados:

- stock actual por bodega
- stock comprometido
- stock disponible
- lote
- FIFO o fecha de ingreso
- punto de reorden
- unidad de compra
- unidad de salida
- conversiones entre unidades

Sin estos datos no se puede definir con precision:

- si el costo del material se calcula por MSI o por KG
- si el material es valido para el proceso
- si el material existe fisicamente y en que bodega
- si el costo mostrado es comercial, de reposicion o promedio

### 7. Datos tecnicos de tintas

Datos imprescindibles:

- tipo de tinta
- codigo de tinta
- descripcion
- familia de tinta
- color
- Pantone o formula
- si usa CMYK
- si usa blanco
- si requiere doble pasada de blanco
- rendimiento o consumo por MSI, m2, kg o litro
- costo por unidad de consumo
- unidad de consumo
- compatibilidad por proceso o maquina
- proveedor
- bodega
- merma o desperdicio normal

El proyecto actual calcula tintas efectivas a partir de:

- CMYK
- cantidad de pantones
- tinta blanca
- doble pasada de blanco

Por lo tanto, si el cliente no define esos cuatro elementos con reglas de negocio claras, el costo de tinta no sera consistente.

### 8. Datos tecnicos de barnices

Datos imprescindibles:

- tipo de barniz
- nombre comercial y nombre tecnico
- proceso compatible
- acabado generado: brillante, mate, tacto, protector, UV, agua, etc.
- costo por MSI, m2, pie lineal o unidad
- rendimiento real
- tiempo adicional de preparacion
- maquina o estacion donde se aplica
- proveedor
- bodega
- unidad de consumo

Tambien debe definirse:

- si el barniz se calcula como costo variable por area
- si tiene costo fijo de setup
- si comparte linea con impresion o va como proceso adicional

### 9. Datos tecnicos de laminados

Datos imprescindibles:

- tipo de laminado o film
- estructura del film
- espesor o calibre
- ancho disponible
- proveedor
- costo por MSI, m2, pie lineal o rollo
- rendimiento
- setup del proceso
- compatibilidad por maquina
- bodega e inventario
- unidad de consumo

Sin esto no se puede determinar correctamente:

- costo variable del laminado
- costo de preparacion
- restriccion por ancho o proceso

### 10. Datos tecnicos de troqueles

Datos imprescindibles:

- codigo de troquel
- descripcion
- clasificacion
- dimensiones
- ancho y largo de troquel
- ancho y largo de etiqueta
- area de etiqueta
- area con excesos
- ancho de material asociado
- filas
- dientes
- repeticiones
- gap
- proveedor
- tipo de troquel
- estructura o montaje
- desarrollo
- tension
- elongacion
- uso para convencional y/o digital
- estado

Datos de inventario recomendados:

- bodega
- cantidad disponible
- vida util total
- vida util usada
- vida util restante
- relacion de reemplazo
- imagen o evidencia visual
- cliente asociado
- codigo proveedor
- codigo preprensa

Esto es imprescindible porque el troquel influye en:

- viabilidad tecnica
- configuracion del desarrollo
- repeticiones y dientes
- costo del troquelado
- reutilizacion o necesidad de fabricar uno nuevo

### 11. Datos de planchas y cyrel

Este frente debe pedirse explicitamente al cliente, aunque el proyecto aun lo maneje de forma simple.

Datos minimos:

- si el proceso usa plancha o cyrel
- tipo de plancha
- espesor
- proveedor
- costo por cm2, m2, pieza o set
- cantidad minima cobrable
- rendimiento
- vida util o reutilizacion esperada
- tiempo de preprensa
- tiempo de grabado o confeccion
- codigo de plancha
- inventario disponible si el cliente las administra
- politica de reposicion o refabricacion

Preguntas clave:

- manejan inventario de planchas o solo costo por evento
- una plancha puede reutilizarse en repeticiones
- el costo va completo a la primera cotizacion o se prorratea

### 12. Datos de arte y preprensa

Datos imprescindibles:

- si el arte lo entrega el cliente o se crea internamente
- costo de arte interno
- costo de correcciones
- versionado del arte
- tiempo de preprensa por trabajo
- tiempo adicional por cambio
- cantidad de cambios
- aprobaciones requeridas
- prueba de color si aplica
- responsable del proceso

Sin esto, el sistema no puede separar:

- costo de diseno
- costo de ajustes
- costo de preprensa
- impacto de repeticion con cambio

### 13. Datos de maquinas y capacidades

Datos imprescindibles por maquina:

- codigo o id de maquina
- nombre
- marca
- modelo
- proceso productivo
- clasificacion
- proceso y subproceso
- activa o inactiva
- unidad de trabajo
- velocidad de produccion
- tiempo de preparacion general
- tiempo por estacion
- tiempo adicional de preparacion
- costo hora maquina
- costo hora operario
- cantidad de personas requeridas
- formulas o reglas de tiempo
- formulas o reglas de costo
- si comparte tiempo de linea
- si comparte operario
- tipo de consumo asociado

Preguntas criticas:

- una misma maquina maneja impresion y acabados inline
- existen capacidades separadas por proceso
- la velocidad cambia por sustrato, barniz o laminado

Si el cliente no entrega catalogo maestro de maquinas, el sistema terminara derivando informacion desde calculos historicos, lo cual no es confiable como base operativa.

### 14. Datos de procesos adicionales y externos

Datos imprescindibles:

- maquila
- flete
- estampado o foil
- rebobinado
- empaque
- inspeccion o calidad
- otros servicios externos

Para cada uno debe existir:

- nombre del proceso
- categoria
- costo fijo
- costo variable
- unidad de calculo
- proveedor si es externo
- tiempo requerido
- si es obligatorio u opcional

## Reglas comerciales y financieras que el cliente debe definir

### 15. Parametros generales obligatorios

- porcentaje de merma
- costo hora de preprensa
- minutos de preprensa por cambio
- costo minuto maquina
- factor de montaje por estacion
- velocidad base en pies por minuto
- costo de tinta por MSI u otra unidad
- costo de laminado por MSI u otra unidad
- costo de barniz por MSI u otra unidad
- costo fijo o base de troquel
- costo de arte
- costo de cyrel
- costo de maquila
- costo de flete
- costo de empaque
- porcentaje de imprevistos
- porcentaje de financieros
- porcentaje de rendimiento bruto
- porcentaje de comision vendedor
- porcentaje de comision departamento
- porcentaje de comision agencia
- porcentaje de IVA
- moneda base
- reglas de tipo de cambio

### 16. Politicas que deben quedar por escrito

- como se calcula la merma por proceso y por maquina
- cuando aplica costo minimo
- cuando una repeticion reutiliza troquel, arte o plancha
- como se maneja la comision de agencia
- como se maneja la exoneracion
- como se calcula el precio por unidad, por millar y total
- como se manejan multiples escalas de cantidad
- si la aprobacion comercial puede alterar costos o solo precios de venta

## Inventarios que deben existir como minimo

### 17. Inventarios imprescindibles para la implementacion

1. materia prima
2. tintas
3. barnices
4. laminados o films
5. troqueles
6. planchas o cyrel, si el cliente las administra
7. cores y materiales de empaque, si impactan costo
8. catalogo de maquinas y capacidades

Para cada inventario se debe entregar:

- codigo unico
- descripcion
- unidad principal
- unidad de compra
- unidad de consumo
- factor de conversion
- costo vigente
- proveedor
- bodega
- estado activo
- existencia disponible

## Informacion necesaria para mostrar en el sistema

### 18. Datos visibles que el usuario necesita ver

En cotizacion:

- cliente
- vendedor
- producto
- descripcion del trabajo
- proceso productivo
- material
- dimensiones
- tintas
- acabados
- troquel
- escalas de cantidad
- desglose de costos
- subtotal
- IVA
- total
- precio unitario
- precio por millar si aplica
- observaciones comerciales
- vigencia
- entrega

En inventarios:

- codigo
- descripcion
- stock
- unidad
- costo
- proveedor
- bodega
- compatibilidad de proceso
- estado

En catalogos tecnicos:

- materiales compatibles
- troqueles disponibles
- maquinas disponibles
- salidas de rollo
- tipos de etiquetado
- acabados permitidos

## Integracion con SAP u otra aplicacion externa

### 19. Decisiones que el cliente debe tomar antes de desarrollar

Debe quedar definido si:

- los clientes se administraran localmente o vendran de SAP
- los productos se administraran localmente o vendran de SAP
- los materiales e inventarios se sincronizaran desde SAP
- los precios base se calcularan en este sistema o se recibiran desde otra fuente
- las cotizaciones aprobadas generaran pedidos en SAP
- las salidas de inventario se registraran en SAP

### 20. Datos tecnicos minimos para integracion

Si existira integracion, el cliente debe entregar:

- sistema origen
- version del ERP
- metodo de integracion: API, Service Layer, DI API, archivos o interfaz manual
- ambiente de pruebas
- credenciales de prueba
- compania o base de datos de prueba
- entidades maestras a sincronizar
- frecuencia de sincronizacion
- mapeo de codigos
- reglas de errores y reintentos
- responsable tecnico del lado del cliente

Para SAP especificamente:

- catalogo de socios de negocio
- catalogo de items
- bodegas
- unidades de compra y venta
- precios
- existencias
- codigos SAP de materiales, clientes y productos

## Requisitos funcionales minimos para arrancar implementacion

### 21. Talleres o sesiones obligatorias con el cliente

Se recomienda no iniciar desarrollo formal sin cerrar estos talleres:

1. taller comercial
2. taller de costeo
3. taller de produccion
4. taller de inventarios
5. taller de troqueles y preprensa
6. taller de integracion ERP
7. taller de validacion de unidades y conversiones

Cada taller debe terminar con:

- catalogos fuente entregados
- campos obligatorios aprobados
- reglas de calculo confirmadas
- responsables asignados
- fecha de validacion

### 22. Matriz minima de entregables del cliente

Antes de construccion:

- catalogo de clientes
- catalogo de productos
- catalogo de materiales
- catalogo de maquinas
- catalogo de troqueles
- catalogo de tintas
- catalogo de barnices
- catalogo de laminados
- catalogo de planchas o politica de cyrel
- parametros comerciales y financieros
- politicas de impuestos y moneda
- definicion de unidades
- definicion de integracion externa

Antes de pruebas integrales:

- casos reales de cotizacion
- costos vigentes validados
- usuarios clave por area
- criterios de aceptacion
- formatos de salida esperados

## Riesgos principales detectados

### 23. Riesgos de implementacion

1. El cliente entregue inventarios sin unidades normalizadas.
2. Los costos de materiales no distingan entre MSI, KG, metro lineal o unidad.
3. No exista catalogo maestro de maquinas y se intente inferirlo desde historicos.
4. Los troqueles no tengan llave unica confiable.
5. No se defina si las planchas son inventario o gasto directo.
6. Los productos vengan de SAP pero sin relacion clara con las especificaciones tecnicas de impresion.
7. No exista una politica unica para merma, rendimiento bruto, comisiones y precios minimos.
8. Las cotizaciones historicas tengan datos incompletos y se usen como verdad operativa.

## Recomendacion gerencial

### 24. Condicion de arranque

La implementacion debe condicionarse a la entrega y aprobacion de un paquete minimo de datos maestros. Ese paquete debe validarse antes de programar reglas definitivas de calculo.

### 25. Paquete minimo exigible al cliente

Se recomienda pedir formalmente, como prerequisito contractual:

- maestro de clientes
- maestro de productos
- maestro de materiales con costos y unidades
- maestro de maquinas con capacidades y costos
- maestro de troqueles
- maestro de tintas, barnices y laminados
- politica de planchas y cyrel
- parametros de merma, costos indirectos, comisiones, margen e IVA
- decision oficial sobre integracion con SAP
- 10 a 20 casos reales de cotizacion para validar formulas

### 26. Criterio de aceptacion del relevamiento

El relevamiento solo debe darse por cerrado cuando cada dato obligatorio tenga:

- nombre del campo
- descripcion
- fuente de origen
- unidad
- responsable del dato
- frecuencia de actualizacion
- regla de validacion
- uso dentro del calculo o del proceso

## Checklist ejecutivo final

El cliente esta listo para implementar solo si puede responder con evidencia:

- que productos cotiza
- en que unidad los vende
- en que unidad los fabrica
- con que materiales trabaja
- cuanto cuesta cada material en la unidad correcta
- que maquinas usa y cuanto cuesta cada una por tiempo o capacidad
- como calcula tintas, barnices y laminados
- que troqueles existen y cuales se reutilizan
- si maneja planchas o cyrel con inventario o costo por evento
- que porcentajes comerciales aplica
- como calcula IVA, moneda y tipo de cambio
- si el catalogo vendra del sistema actual o de SAP
- que datos deben sincronizarse con el ERP

## Cierre

La pieza critica de este proyecto no es la pantalla de cotizacion, sino la disciplina del dato maestro. Si el cliente entrega la informacion anterior de forma completa y validada, la implementacion puede hacerse con bajo nivel de incertidumbre. Si no la entrega, cualquier total cotizado sera tecnicamente vulnerable, aunque el sistema funcione.
