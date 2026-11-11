const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'Paytrack-Teste.html');
const mime = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'};
const cache = new Map();
function localFile(ref, base) {
  const file = path.resolve(base, ref);
  if (!file.startsWith(root + path.sep)) throw new Error('Arquivo fora do projeto: ' + ref);
  return file;
}
function embedMedia(text, base) {
  return text.replace(/(["'])((?:\.\/|\.\.\/)[^"'\s()]+\.(?:png|jpe?g|svg|webp|ttf|woff2?))\1/gi, (_, quote, ref) => {
    const file = localFile(ref, base);
    if (!cache.has(file)) cache.set(file, 'data:' + mime[path.extname(file).toLowerCase()] + ';base64,' + fs.readFileSync(file).toString('base64'));
    return quote + cache.get(file) + quote;
  });
}
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('</head>', '<meta name="paytrack-standalone" content="true" />\n</head>');
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*\/?\s*>/g, (_, ref) => {
  const file = localFile(ref, root);
  const css = embedMedia(fs.readFileSync(file, 'utf8'), path.dirname(file));
  return '<style>\n' + css.replace(/<\/style/gi, '<\\/style') + '\n</style>';
});
html = html.replace(/<script\b[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g, (_, ref) => {
  const file = localFile(ref, root);
  const js = embedMedia(fs.readFileSync(file, 'utf8'), root);
  return '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';
});
html = embedMedia(html, root);
// Retain bundled third-party license notices in the distributed document.
const licenseFiles = ['react-LICENSE.txt','react-dom-LICENSE.txt','lucide-LICENSE.txt'];
const licenses = licenseFiles.map(file => fs.readFileSync(path.join(root,'assets/runtime',file),'utf8'));
for (const dir of ['fonts/font1/Source_Serif_4','fonts/font2/Libre_Franklin']) licenses.push(fs.readFileSync(path.join(root,dir,'OFL.txt'),'utf8'));
html = html.replace('</head>', '<!--\nLicenças das bibliotecas e fontes incluídas:\n' + licenses.join('\n\n').replace(/--/g,'—') + '\n-->\n</head>');
fs.writeFileSync(output, html);
console.log(path.basename(output) + ': ' + (Buffer.byteLength(html)/1024/1024).toFixed(1) + ' MB; ' + cache.size + ' recursos incorporados.');
