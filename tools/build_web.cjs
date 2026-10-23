const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Building Godot 4 Web Distribution ---');

const webDir = path.join(__dirname, '..', 'build', 'web');
if (!fs.existsSync(webDir)) {
  fs.mkdirSync(webDir, { recursive: true });
}

// 1. Locate Godot executable
let godotCmd = 'godot';
let hasGodot = false;
try {
  execSync('godot --version', { stdio: 'ignore' });
  hasGodot = true;
} catch (e) {
  if (process.platform === 'win32') {
    if (fs.existsSync('C:\\Godot\\godot.cmd')) {
      godotCmd = '"C:\\Godot\\godot.cmd"';
      hasGodot = true;
    } else if (fs.existsSync('C:\\Godot\\Godot_v4.3-stable_win64_console.exe')) {
      godotCmd = '"C:\\Godot\\Godot_v4.3-stable_win64_console.exe"';
      hasGodot = true;
    }
  }
}

const hasPrebuilt = fs.existsSync(path.join(webDir, 'index.html')) &&
                    fs.existsSync(path.join(webDir, 'index.wasm')) &&
                    fs.existsSync(path.join(webDir, 'index.pck'));

if (!hasGodot) {
  if (hasPrebuilt) {
    console.log('ℹ️ Godot CLI not detected in this environment (e.g. Vercel Cloud Runner).');
    console.log('✅ Found pre-built Web distribution in build/web. Proceeding with deployment!');
    process.exit(0);
  } else {
    console.error('❌ Error: Godot CLI not found and no pre-built package exists.');
    process.exit(1);
  }
}

// 2. Export PCK with Godot CLI
console.log(`1. Exporting Godot Web PCK package using ${godotCmd}...`);
const pckPath = path.join(webDir, 'index.pck');
execSync(`${godotCmd} --headless --export-pack "Web" "${pckPath}"`, { stdio: 'inherit' });

// 3. Find template zip
let templateZip = '';
const candidateZips = [
  path.join(process.env.APPDATA || '', 'Godot/export_templates/4.3.stable/web_nothreads_release.zip'),
  path.join(process.env.APPDATA || '', 'Godot/templates/4.3.stable/web_nothreads_release.zip'),
  path.join(process.env.HOME || '', '.local/share/godot/export_templates/4.3.stable/web_nothreads_release.zip'),
  path.join(process.env.HOME || '', '.local/share/godot/templates/4.3.stable/web_nothreads_release.zip'),
  path.join(process.env.HOME || '', '.godot/export_templates/4.3.stable/web_nothreads_release.zip'),
  'C:/Godot/templates/4.3.stable/web_nothreads_release.zip',
];

for (const cz of candidateZips) {
  if (cz && fs.existsSync(cz)) {
    templateZip = cz;
    break;
  }
}

if (!templateZip) {
  console.warn('Warning: web_nothreads_release.zip not found in standard paths.');
} else {
  console.log(`2. Assembling WebAssembly and JavaScript runner from: ${templateZip}`);
  execSync(`tar -xf "${templateZip}" -C "${webDir}" godot.js godot.wasm godot.audio.worklet.js godot.html`);

  if (fs.existsSync(path.join(webDir, 'godot.wasm'))) {
    fs.renameSync(path.join(webDir, 'godot.wasm'), path.join(webDir, 'index.wasm'));
  }
  if (fs.existsSync(path.join(webDir, 'godot.js'))) {
    fs.renameSync(path.join(webDir, 'godot.js'), path.join(webDir, 'index.js'));
  }
  if (fs.existsSync(path.join(webDir, 'godot.audio.worklet.js'))) {
    fs.renameSync(path.join(webDir, 'godot.audio.worklet.js'), path.join(webDir, 'index.audio.worklet.js'));
  }

  console.log('3. Populating index.html with project configuration...');
  let html = fs.readFileSync(path.join(webDir, 'godot.html'), 'utf8');
  fs.unlinkSync(path.join(webDir, 'godot.html'));

  const config = {
    args: [],
    canvasResizePolicy: 2,
    ensureCrossOriginIsolationHeaders: false,
    executable: 'index',
    experimentalVK: false,
    fileSizes: {
      'index.pck': fs.statSync(pckPath).size,
      'index.wasm': fs.statSync(path.join(webDir, 'index.wasm')).size
    },
    focusCanvasOnStart: true,
    gdextensionLibs: []
  };

  html = html.replace(/\$GODOT_PROJECT_NAME/g, 'Chronicles of Morimar');
  html = html.replace(/\$GODOT_HEAD_INCLUDE/g, '');
  html = html.replace(/\$GODOT_SPLASH/g, '');
  html = html.replace(/\$GODOT_URL/g, 'index.js');
  html = html.replace(/\$GODOT_CONFIG/g, JSON.stringify(config));
  html = html.replace(/\$GODOT_THREADS_ENABLED/g, 'false');

  fs.writeFileSync(path.join(webDir, 'index.html'), html);
}

console.log('✅ Web build generated successfully in build/web:');
const files = fs.readdirSync(webDir);
for (const f of files) {
  const sz = (fs.statSync(path.join(webDir, f)).size / 1024).toFixed(1);
  console.log(`   - ${f} (${sz} KB)`);
}
