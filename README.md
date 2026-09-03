# Calificador Docente

Web app (HTML/CSS/JS puro, sin frameworks) para gestionar cursos, materias, estudiantes y notas desde el celular. Funciona como PWA instalable y guarda todo en `localStorage`, sin servidor ni conexión.

## Estructura

```
index.html          shell de la app
manifest.json        metadata PWA (íconos, colores, modo standalone)
sw.js                 service worker (cache offline)
css/styles.css        estilos mobile-first
js/app.js              lógica de datos y navegación
icons/                 íconos 192x192 y 512x512
```

## Publicar en GitHub Pages

1. Crear un repositorio nuevo y vacío en GitHub (sin README).
2. En esta carpeta, conectar el repo remoto y subir:
   ```
   git remote add origin https://github.com/<usuario>/<repo>.git
   git branch -M main
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`** → Save.
4. Esperar 1-2 minutos. El sitio queda en `https://<usuario>.github.io/<repo>/`.
5. Abrir esa URL desde el celular y usar "Agregar a pantalla de inicio" / "Instalar app" del navegador.

Los paths del proyecto son relativos, así que funciona tanto en la raíz de un dominio como en un subpath tipo `/repo/`.
