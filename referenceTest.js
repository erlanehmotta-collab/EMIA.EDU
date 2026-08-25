import fs from "fs";

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}
fs.writeFileSync('public/_redirects', '/* /index.html 200\n');

const wranglerConfig = {
  name: 'emia-edutech',
  compatibility_date: '2026-08-25',
  pages_build_output_dir: 'dist',
  compatibility_flags: [
    'nodejs_compat'
  ]
};
fs.writeFileSync('wrangler.jsonc', JSON.stringify(wranglerConfig, null, 2));
console.log('CF Pages setup complete!');
