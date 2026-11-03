import fs from 'node:fs/promises';
import path from 'node:path';

async function prerender() {
  console.log('Pre-rendering Lovable interface HTML from SSR build...');
  try {
    const serverPath = path.resolve('dist/server/server.js');
    const server = await import(`file://${serverPath}`);
    
    const routes = ['/', '/login', '/signup'];
    for (const r of routes) {
      try {
        const res = await server.default.fetch(new Request('http://localhost:3000' + r));
        const html = await res.text();
        if (res.status === 200 && html.trim().startsWith('<!DOCTYPE') || html.trim().startsWith('<html')) {
          const dest = r === '/' ? 'dist/client/index.html' : `dist/client${r}.html`;
          await fs.writeFile(dest, html, 'utf8');
          console.log(`✓ Generated ${dest} (${html.length} bytes)`);
        } else {
          console.warn(`⚠️ Route ${r} returned non-HTML or error (status ${res.status}), keeping client SPA bundle`);
        }
      } catch (routeErr) {
        console.warn(`⚠️ Could not prerender route ${r}:`, routeErr.message);
      }
    }
  } catch (err) {
    console.warn('⚠️ Prerender failed, falling back to pure client SPA bundle:', err.message);
  }
}

prerender();
