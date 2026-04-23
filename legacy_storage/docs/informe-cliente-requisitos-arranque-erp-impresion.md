# Informe Gerencial para Inicio del Proyecto

## Implementación de cotización para flexografía digital y convencional con integración a SAP

## Propósito de este documento

Este documento resume la información mínima que necesitamos para iniciar el proyecto de forma ordenada, reducir incertidumbre y evitar atrasos causados por datos incompletos, clasificaciones ambiguas o definiciones pendientes entre cotización, producción y SAP.

El alcance actual del proyecto es el siguiente:

- cotizar productos de flexografía digital y convencional
- calcular costos técnicos y comerciales
- aprobar la cotización en el sistema
- enviar la cotización aprobada a SAP como orden de producción con su estructura de materiales
- continuar la ejecución operativa dentro de SAP

Por el momento, este alcance no incluye facturación.

## Mensaje principal

Para arrancar el proyecto no necesitamos pedir información innecesaria, pero sí necesitamos que ciertos datos existan, estén claros y puedan obtenerse de forma consistente.

Hoy el punto más delicado no es la conexión con SAP en sí misma, sino la calidad de la información y, sobre todo, la forma en que está clasificada. Si los materiales, tintas, barnices, laminados, troqueles o planchas existen en SAP, pero no están clasificados de una manera útil para cotización y producción, la integración podrá conectarse, pero el cálculo no será confiable.

Por esa razón, antes de iniciar desarrollo formal, necesitamos cerrar con ustedes qué información existe, cómo está organizada, qué campo se utiliza para clasificarla y cuál será la fuente oficial para cada dato.

## Lo indispensable para arrancar

### 1. Confirmación del alcance operativo

Necesitamos confirmar formalmente:

- que el sistema se utilizará para cotización técnica y comercial
- que SAP seguirá siendo el sistema que administra la producción
- que la cotización aprobada se enviará a SAP como orden de producción
- que esa orden deberá viajar con su estructura de materiales
- que la facturación no forma parte del alcance actual

Si esta definición cambia posteriormente, cambiarán también los datos requeridos y el alcance técnico de la implementación.

### 2. Datos comerciales mínimos

Para comenzar a cotizar, como mínimo necesitamos:

- código de cliente
- nombre del cliente
- condición de pago
- moneda de trabajo
- vendedor o responsable comercial
- contacto principal
- correo para envío de cotización

Esta información idealmente debe venir desde SAP.

### 3. Tipos de producto que la empresa fabrica

No estamos partiendo de un catálogo terminado de productos para flexografía, porque entendemos que ese catálogo probablemente se construirá dentro del proyecto. Sin embargo, sí necesitamos que la empresa defina, como mínimo, qué tipos de producto fabrica o cotiza.

Necesitamos conocer:

- tipo de producto
- nombre general o familia
- si se fabrica en digital, convencional o ambos
- si requiere troquel
- si requiere plancha
- si requiere salida en rollo
- unidad principal en la que normalmente se cotiza
- unidad principal en la que normalmente se produce

Esto es importante porque el comportamiento de cálculo cambia según el tipo de producto y su forma de fabricación.

## Información indispensable para calcular correctamente

### 4. Información mínima por trabajo o línea de cotización

Cada cotización o línea de cotización debe poder definir, como mínimo:

- cliente
- nombre del trabajo
- nombre de la máquina de impresión
- tipo de orden
- tipo de producto
- cantidad
- ancho del producto
- largo del producto
- ancho del material
- ancho del rollo final, cuando aplique
- tipo de etiquetado, cuando aplique
- tipo de salida del rollo, cuando aplique
- material principal
- configuración de tintas
- acabados aplicables
- orden en que se aplican los acabados
- troquel, cuando aplique
- plancha o cyrel, cuando aplique

### Definiciones que deben quedar claras en este punto

- La máquina de impresión es la que define el proceso productivo real de la línea.
- El tipo de orden no debe limitarse solo a nuevo, repetición o repetición con cambio. También necesitamos saber si la empresa maneja muestras, relanzamientos, reimpresiones por calidad u otros escenarios equivalentes.
- El ancho del material no debe asumirse igual al ancho del rollo final.
- Debe definirse con claridad en qué unidades trabaja cada área y qué conversiones deberán existir entre ellas.

### Unidades y conversiones que deben definirse

Necesitamos saber con precisión:

- en qué unidad trabajan diseño y especificación técnica
- en qué unidad trabajan materiales
- en qué unidad trabajan impresión y acabados
- en qué unidad se calcula el consumo
- en qué unidad se cotiza al cliente

Las unidades pueden incluir, según corresponda:

- pulgadas
- pies
- metros
- milímetros
- metros cuadrados
- pies lineales
- kilogramos
- unidades
- rollos

Además, necesitamos conocer las conversiones oficiales que utilizará la empresa para que el sistema no mezcle criterios distintos en materiales, procesos y precios.

### 5. Materiales e insumos

Este es uno de los temas más urgentes del proyecto.

Necesitamos confirmar si en SAP los insumos están clasificados de manera que permitan distinguir, como mínimo:

- sustratos
- tintas
- barnices
- laminados
- foil o estampado
- cores
- materiales de empaque
- planchas o cyrel

Y además necesitamos saber cuál es el campo que utiliza SAP para realizar esa clasificación. Si hoy esa clasificación no existe o no es confiable, entonces deberá acordarse si se ajustará en SAP o si se mantendrá una clasificación complementaria para el cotizador.

### Lo mínimo que debe tener cada insumo o material

- código
- nombre o descripción
- clasificación
- campo o criterio con el que SAP identifica esa clasificación
- unidad de inventario
- unidad de consumo
- costo vigente por la unidad real de consumo
- moneda del costo
- bodega o almacén
- estado activo
- compatibilidad con digital, convencional o ambos, cuando corresponda

### Lo mínimo adicional según el tipo de insumo

Para sustratos:

- ancho
- gramaje o calibre
- adhesivo, cuando aplique

Para tintas:

- tipo de tinta
- color o grupo de color

Para barnices:

- tipo de barniz que la empresa aplica

Para laminados:

- tipo de laminado que la empresa aplica
- ancho

### Punto crítico que debe resolverse al inicio

Hoy existe una duda válida: no sabemos si SAP ya clasifica los insumos de una forma útil para cotización.

Esa definición debe resolverse desde el inicio, porque de ella dependen:

- los materiales que podrá seleccionar el usuario
- la lógica de cálculo
- los insumos que viajarán al BOM de producción
- el esfuerzo de depuración previa que habrá que realizar

### 6. Tintas

En tintas necesitamos conocer cómo registran hoy el consumo y el costo.

Para flexografía convencional necesitamos, como mínimo:

- tipos de tinta que manejan
- forma en que registran el consumo
- costo por unidad de consumo
- criterio de consumo por estación
- forma en que controlan reposiciones, desperdicios o ajustes

Para impresión digital necesitamos conocer, como mínimo:

- cómo calculan hoy el costo de tinta o consumible digital
- si ese costo depende del equipo o tecnología utilizada
- si el cálculo se determina por cobertura, por clic, por consumo estimado, por fórmula interna o por otra lógica
- si existe una diferencia entre tecnologías digitales distintas

No es necesario definir aquí cómo el usuario seleccionará CMYK, pantones o blanco en la cotización, porque eso forma parte del uso operativo del sistema. Lo importante en esta etapa es conocer cómo controlan y costean el consumo real, tanto en convencional como en digital.

### 7. Barnices

En barnices necesitamos saber:

- qué tipos de barniz aplican actualmente
- cómo los clasifican
- cómo registran su costo
- en qué unidad controlan el consumo
- si ese inventario existe hoy en SAP y bajo qué clasificación

### 8. Laminados

En laminados necesitamos saber:

- qué tipos de laminado aplican actualmente
- cómo los clasifican
- cómo registran su costo
- qué ancho manejan
- en qué unidad controlan el consumo

### Observación importante sobre barnices y laminados

Ya existe un criterio técnico claro de consumo para estos procesos. Lo que necesitamos de parte de ustedes no es que redefinan la lógica técnica general, sino confirmar cómo controlan hoy esos insumos, cómo los costean y cómo están clasificados en SAP.

### 9. Máquinas de impresión y procesos asociados

Para cotización necesitamos que la empresa defina cuáles son las máquinas de impresión que participarán en el sistema y qué procesos puede ejecutar cada una o con cuáles procesos se relaciona.

De cada máquina de impresión necesitamos, como mínimo:

- código o identificador
- nombre de máquina
- si pertenece a digital o convencional
- velocidad base
- tiempo base de preparación
- costo resumido de máquina
- costo resumido de operador, si aplica
- procesos que puede realizar o con los que se relaciona

Esto es importante porque la máquina de impresión es la base para determinar el comportamiento productivo de la cotización.

### 10. Troqueles

Para los productos que requieren troquel, necesitamos confirmar si existe un catálogo o inventario utilizable y qué información contiene.

Lo mínimo requerido es:

- código de troquel
- descripción
- ancho
- largo
- repeticiones
- dientes o configuración equivalente
- gap, cuando aplique
- estado
- cliente asociado, cuando aplique

Si el troquel existe pero no está identificado de forma única o no puede reutilizarse correctamente, habrá problemas tanto para cotizar como para preparar la producción.

### 11. Planchas o cyrel

En este punto necesitamos partir del criterio de que debe existir control e inventario de planchas o cyrel, especialmente por reimpresiones, reposiciones, desgaste, daño o reutilización en trabajos repetidos.

Lo que necesitamos confirmar con ustedes es:

- cómo las clasifican hoy
- cómo las identifican
- si el inventario actual es utilizable
- si una repetición puede utilizar planchas existentes
- si el costo se prorratea en algún escenario

## Reglas comerciales mínimas

### 12. Parámetros base de costeo y precio

Necesitamos definir por escrito:

- porcentaje de merma por proceso
- criterio de desperdicio por proceso
- costo mínimo por proceso, si existe
- porcentaje de imprevistos, si se utiliza
- porcentaje financiero u otro cargo adicional, si aplica
- margen o rendimiento bruto esperado, si existe
- margen o rendimiento del vendedor, si existe
- comisión de agencia, si aplica
- impuesto de ventas aplicable
- reglas de moneda
- criterio de tipo de cambio para la fecha de cotización

### A qué nos referimos con reglas de moneda

Nos referimos a definir:

- en qué moneda se costea
- en qué moneda se cotiza
- si una cotización puede mostrarse en más de una moneda
- de dónde saldrá el tipo de cambio
- qué fecha se utilizará para tomar ese tipo de cambio

No necesitamos una política comercial compleja para arrancar, pero sí una base única, aprobada y aplicable a todas las cotizaciones.

## Qué debe venir desde SAP y qué puede resolverse por carga inicial

### 13. Información recomendada para traer desde SAP

Si está disponible y correctamente estructurada, recomendamos traer desde SAP:

- clientes
- materiales e insumos
- bodegas
- existencias
- unidades de medida
- costos vigentes
- clasificaciones o grupos de artículos
- referencias que SAP exija para generar correctamente la orden de producción

### A qué nos referimos con referencias que SAP exija para la orden de producción

Nos referimos a los códigos, identificadores o campos que SAP necesita para aceptar correctamente la orden de producción y su estructura de materiales. Por ejemplo:

- códigos de artículos
- códigos de bodega
- unidades válidas
- referencias internas del trabajo
- cualquier identificador obligatorio del encabezado o del detalle

La idea no es pedir conceptos abstractos, sino conocer exactamente qué campos espera SAP para recibir la información sin errores.

### 14. Información que podría requerir carga inicial o complemento

Es posible que parte de la información no exista en SAP de una manera utilizable para el cotizador. En ese caso, podría cargarse inicialmente por plantilla:

- tipos de producto
- clasificación funcional de materiales
- catálogo de máquinas de impresión
- costos resumidos por máquina o proceso
- catálogo de troqueles
- catálogo o control de planchas

## Campos mínimos que necesitamos obtener desde SAP

### 15. Clientes

- código de cliente
- nombre
- condición de pago
- moneda
- vendedor asignado, cuando exista
- teléfono
- correo
- estado activo

### 16. Materiales e insumos

- código de artículo
- descripción
- grupo, clasificación o campo equivalente
- unidad de inventario
- unidad de compra
- unidad de consumo, si existe
- costo vigente
- moneda
- bodega
- stock disponible
- estado activo

### 17. Bodegas

- código de bodega
- nombre de bodega
- estado

### 18. Datos mínimos para preparar la orden de producción en SAP

Debemos acordar desde el inicio:

- estructura del encabezado
- estructura del detalle
- materiales que deben viajar al BOM
- unidad de producción
- referencia del cliente o del trabajo
- observaciones técnicas

## Qué necesitamos validar en las primeras sesiones

### 19. Decisiones críticas de arranque

Estas definiciones deben quedar cerradas al inicio:

- confirmación de SAP como fuente oficial de clientes
- confirmación de SAP como fuente oficial de materiales
- validación de que la clasificación actual de materiales e insumos sea suficiente
- definición de cómo están identificados los insumos especiales
- confirmación de existencia de catálogo de troqueles
- confirmación de la forma en que se controlan planchas o cyrel
- entrega de costos resumidos por máquina o proceso
- definición exacta de cómo debe viajar la cotización aprobada a SAP

### A qué nos referimos con insumos especiales

Nos referimos a insumos que no se comportan como un material genérico, pero que sí afectan el costo o la estructura productiva, por ejemplo:

- barnices
- laminados
- foil
- cores
- planchas
- materiales de empaque

## Riesgos que conviene evitar desde el principio

### 20. Riesgos principales

1. Arrancar desarrollo sin confirmar si SAP clasifica correctamente los insumos.
2. Asumir que todos los materiales de SAP sirven para cotización.
3. Aplicar la misma lógica de costeo a digital y convencional cuando el consumo y el cálculo no se comportan igual.
4. No definir cómo se controlan los insumos especiales dentro de SAP.
5. No definir con precisión qué campos necesita SAP para recibir la orden de producción.
6. Postergar la definición de la estructura del BOM.

### A qué nos referimos con distinguir digital y convencional en reglas de costeo

Nos referimos a que no puede asumirse que ambos procesos calculan sus consumos y costos de la misma manera. En convencional, por ejemplo, el consumo de tinta se relaciona con estaciones y lógica de impresión flexográfica. En digital, el costo puede depender del tipo de equipo, la tecnología utilizada o una lógica distinta de consumo. Esa diferencia debe quedar definida desde el inicio.

## Recomendación de arranque

### 21. Condición de inicio propuesta

Para iniciar el proyecto de forma ordenada y sin trasladar el riesgo del dato al desarrollo, proponemos cerrar primero estos entregables mínimos:

- confirmación del alcance actual
- acceso o extracción de prueba desde SAP por DI API
- muestra real de clientes
- muestra real de materiales e insumos
- validación de clasificación de insumos
- definición base de máquinas de impresión y costos resumidos
- definición base de troqueles
- definición base de planchas o cyrel
- definición de la estructura que se enviará a SAP como orden de producción

### 22. Entregables mínimos requeridos

El proyecto puede arrancar cuando tengamos, por una de estas dos vías:

- conexión a SAP con acceso a la información requerida
- plantillas de carga completas con datos validados

Como mínimo, necesitamos:

- clientes
- materiales e insumos clasificados
- bodegas
- parámetros básicos de costeo
- máquinas de impresión principales
- troqueles, cuando apliquen
- definición de planchas o cyrel
- definición del formato de envío a SAP

## Cierre ejecutivo

### 23. Prioridades reales de arranque

La necesidad más urgente no es pedir más información de la cuenta, sino asegurar la información correcta para iniciar sin ambigüedades.

En concreto, lo más importante que debemos resolver juntos al inicio es esto:

- cómo están clasificados hoy los materiales e insumos en SAP
- qué campo de SAP se utiliza para esa clasificación
- qué unidades utiliza cada área y cuáles serán sus conversiones oficiales
- qué tipos de producto fabrica la empresa
- qué máquinas de impresión definirán el comportamiento productivo
- qué datos serán obligatorios para digital
- qué datos serán obligatorios para convencional
- qué debe enviarse exactamente a SAP cuando una cotización sea aprobada

Si esas definiciones quedan cerradas al principio, el proyecto puede arrancar con una base clara, medible y defendible para ambas partes.
