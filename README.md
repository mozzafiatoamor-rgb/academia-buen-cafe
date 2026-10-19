# Academia del Buen Café · Mozzafiato

App de capacitación en video para el equipo de Mozzafiato y Casa Regina.

- **Videos:** Bunny Stream (links firmados que caducan en 6 h)
- **Datos y login:** Supabase (usuario + PIN de 6 dígitos para empleados; correo para el admin)
- **App:** PWA instalable, funciona con señal débil y guarda el avance sin conexión

## Archivos

| Archivo | Para qué |
|---|---|
| `config.js` | Modo (`nube` / `demo`) y datos públicos de Supabase |
| `style.css` | Colores y estilos (paleta en las primeras líneas) |
| `js/app.js` | App del empleado |
| `js/admin.js` | Panel de administración |
| `js/datos.js` | Capa de datos (misma interfaz en nube y demo) |
| `js/demo.js` | Datos de ejemplo para probar sin tocar los reales |
| `sw.js` | Caché offline. **Sube `VERSION` cada vez que publiques cambios** |
| `supabase/` | Respaldo del SQL y de las funciones (no se publican, solo referencia) |

## Probar sin tocar datos reales
Agrega `?modo=demo` al link. Empleada: `ana.barra` / `482913`. Admin: `admin@demo` / `demo1234`.

## Pendiente (siguiente versión)
Editor de quiz, PDFs/materiales, certificado con logo, importar empleados desde el Gestor de Descansos.
