import fs from 'node:fs/promises';
import path from 'node:path';

async function prerender() {
  console.log('Pre-rendering Lovable interface HTML from SSR build...');
  const serverPath = path.resolve('dist/server/server.js');
  const server = await import(`file://${serverPath}`);
  
  const routes = ['/', '/login', '/signup'];
  for (const r of routes) {
    const res = await server.default.fetch(new Request('http://localhost:3000' + r));
    const html = await res.text();
    const dest = r === '/' ? 'dist/client/index.html' : `dist/client${r}.html`;
    await fs.writeFile(dest, html, 'utf8');
    console.log(`✓ Generated ${dest} (${html.length} bytes)`);
  }
}

prerender().catch((err) => {
  console.error('Prerender error:', err);
  process.exit(1);
});
