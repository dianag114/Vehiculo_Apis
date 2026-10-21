
# VEHICLE.IO - Frontend 3D

## Requisitos
- Visual Studio Code
- Navegador actualizado
- Conexión a Internet para cargar Three.js
- Extensión Live Server de VS Code
- APIs REST disponibles y accesibles desde el navegador

## Estructura
- index.html: estructura de la interfaz.
- styles.css: diseño visual.
- app.js: modelo 3D, selección de piezas y consultas a las APIs.

## Cómo ejecutar
1. Abre la carpeta del proyecto en VS Code.
2. Instala la extensión Live Server.
3. Abre index.html.
4. Haz clic derecho en el editor.
5. Selecciona Open with Live Server.
6. Espera a que aparezca el vehículo.

## Interacción
- Arrastrar el mouse: girar el vehículo.
- Rueda del mouse: acercar o alejar.
- Pasar el cursor: iluminar una pieza.
- Hacer clic: consultar una categoría.
- Tarjetas laterales: seleccionar sensores.
- Actualizar: volver a consultar las APIs.

## Importante
El frontend consume las APIs REST. La conexión a MySQL
se realiza en el backend, no directamente desde el navegador.

Si una API no responde, revisar la consola del navegador,
CORS, la conectividad y los permisos del servidor.
