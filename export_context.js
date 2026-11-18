#!/usr/bin/env node
/**
 * export_context.js
 * ------------------------------------------------------------------
 * Consolida el código del proyecto en un único Markdown listo para
 * usarse como contexto de un asistente de IA.
 *
 * Uso rápido:
 *   node export_context.js                # experiencia animada
 *   node export_context.js --plain        # salida estática (CI / pipes)
 *   node export_context.js --out=contexto.md
 *   node export_context.js --include-env  # incluye .env (¡secretos!)
 *
 * Sin dependencias: solo Node.js.
 */
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

const ROOT_DIR = __dirname;
const PROJECT_NAME = path.basename(ROOT_DIR);
const DEFAULT_OUTPUT = 'contexto_proyecto.md';

// Carpetas generadas, pesadas o sin valor como contexto.
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.expo', '.expo-shared', '.opencode', '.claude',
  '.vscode', '.idea', '.tamagui', '.turbo', '.cache', '.next', 'dist',
  'web-build', 'coverage', 'assets', '__tests__',
]);

// Archivos que nunca aportan (locks, el propio exportador, basura del sistema).
const IGNORE_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb', 'pnpm-lock.yaml',
  'export_context.js', DEFAULT_OUTPUT, '.DS_Store', 'Thumbs.db',
]);

// Nunca se exportan por defecto: pueden contener credenciales.
const SECRET_FILES = new Set([
  '.env', '.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc', '.pgpass',
  '.git-credentials',
]);

const ALLOWED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.md']);
const TEXT_EXTENSIONS = new Set([
  ...ALLOWED_EXTENSIONS, '.mjs', '.cjs', '.mts', '.cts', '.yaml', '.yml',
  '.toml', '.ini', '.txt', '.xml', '.plist', '.properties', '.gradle',
]);

const LANGUAGE_BY_EXT = {
  '.js': 'js', '.jsx': 'jsx', '.ts': 'ts', '.tsx': 'tsx',
  '.json': 'json', '.md': 'md', '.mjs': 'js', '.cjs': 'js',
  '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml', '.ini': 'ini',
};
const LANGUAGE_BY_NAME = {
  '.gitignore': 'gitignore', '.prettierrc': 'json',
  '.prettierrc.json': 'json', '.editorconfig': 'ini',
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/* ------------------------------------------------------------------ */
/* Color y estilos                                                     */
/* ------------------------------------------------------------------ */

const IS_TTY = Boolean(process.stdout.isTTY);
const COLOR_ENABLED = process.env.NO_COLOR
  ? false
  : process.env.FORCE_COLOR
    ? process.env.FORCE_COLOR !== '0'
    : IS_TTY;

const TRUE_COLOR = COLOR_ENABLED && (
  /truecolor|24bit/i.test(process.env.COLORTERM || '')
  || /-truecolor$/i.test(process.env.TERM || '')
  || process.platform === 'win32'
  || Boolean(process.env.WT_SESSION)
  || process.env.TERM_PROGRAM === 'vscode'
  || process.env.TERM_PROGRAM === 'iTerm.app'
);

const RESET = '\x1b[0m';
const CLEAR_LINE = '\x1b[2K';
const ANSI_RE = /\x1b\[[0-9;]*m/g;

const THEME = {
  violet: [139, 92, 246],
  indigo: [99, 102, 241],
  cyan: [34, 211, 238],
  mint: [52, 211, 153],
  red: [248, 113, 113],
  white: [241, 245, 249],
  slate: [148, 163, 184],
  track: [51, 65, 85],
};
const GRADIENT = [THEME.violet, THEME.cyan, THEME.mint];

function colorParams(rgb) {
  if (TRUE_COLOR) {
    const [r, g, b] = rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))));
    return `38;2;${r};${g};${b}`;
  }
  const q = (v) => Math.round((Math.max(0, Math.min(255, v)) / 255) * 5);
  return `38;5;${16 + 36 * q(rgb[0]) + 6 * q(rgb[1]) + q(rgb[2])}`;
}

function paint(text, rgb, options = {}) {
  const value = String(text);
  if (!COLOR_ENABLED) return value;

  const codes = [];
  if (options.bold) codes.push('1');
  if (options.dim) codes.push('2');
  if (options.italic) codes.push('3');
  if (rgb) codes.push(colorParams(rgb));
  if (!codes.length) return value;

  return `\x1b[${codes.join(';')}m${value}${RESET}`;
}

const dim = (text) => paint(text, null, { dim: true });
const bold = (text) => paint(text, null, { bold: true });

function visibleLength(text) {
  return String(text).replace(ANSI_RE, '').length;
}

function truncate(text, max) {
  if (max <= 1) return '';
  const chars = [...String(text)];
  if (chars.length <= max) return String(text);
  return chars.slice(0, max - 1).join('') + '…';
}

function mix(a, b, t) {
  const amount = Math.max(0, Math.min(1, t));
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * amount));
}

function sampleGradient(stops, t) {
  if (stops.length === 1) return stops[0];
  const normalized = ((t % 1) + 1) % 1;
  const scaled = normalized * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const eased = local * local * (3 - 2 * local);
  return mix(stops[index], stops[index + 1], eased);
}

function gradientRule(width) {
  const chars = [...'─'.repeat(Math.max(4, width - 2))];
  return '  ' + chars
    .map((char, i) => paint(char, mix([40, 46, 66], [71, 85, 105], i / chars.length)))
    .join('');
}

/* ------------------------------------------------------------------ */
/* Formato                                                             */
/* ------------------------------------------------------------------ */

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1).replace('.', ',')} ${units[unit]}`;
}

function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(date) {
  return `${String(date.getDate()).padStart(2, '0')} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

function formatTime(date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tick = () => new Promise((resolve) => setImmediate(resolve));

/* ------------------------------------------------------------------ */
/* Animaciones                                                         */
/* ------------------------------------------------------------------ */

function progressBar(width, ratio, frame) {
  const filled = Math.round(width * ratio);
  const sweep = ((frame * 0.05) % 1.5) - 0.25;
  let result = '';

  for (let i = 0; i < width; i += 1) {
    if (i < filled) {
      const position = width === 1 ? 0 : i / (width - 1);
      const glow = Math.max(0, 1 - Math.abs(position - sweep) / 0.2);
      const color = mix(sampleGradient(GRADIENT, position), THEME.white, glow * 0.6);
      result += paint('▰', color, { bold: true });
    } else {
      result += paint('▱', THEME.track);
    }
  }

  return result;
}

function cometBar(width, frame) {
  const head = ((frame * 0.045) % 1.35) - 0.18;
  let result = '';

  for (let i = 0; i < width; i += 1) {
    const position = width === 1 ? 0 : i / (width - 1);
    const glow = Math.max(0, 1 - Math.abs(position - head) / 0.17);
    result += glow > 0.02
      ? paint('━', mix(THEME.cyan, THEME.white, glow * 0.85), { bold: glow > 0.5 })
      : paint('─', THEME.track);
  }

  return result;
}

class Hud {
  constructor({ animate = false, out = process.stdout } = {}) {
    this.animate = animate;
    this.out = out;
    this.frame = 0;
    this.phase = '';
    this.hint = '';
    this.task = null;
    this.scan = { files: 0, dirs: 0 };
    this.liveLines = 0;
    this.timer = null;
    this.startedAt = Date.now();
  }

  get width() {
    return Math.max(48, Math.min(this.out.columns || 80, 96));
  }

  start() {
    if (!this.animate) return;
    this.timer = setInterval(() => {
      this.frame += 1;
      this.draw();
    }, 70);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.clearLive();
  }

  elapsed() {
    return (Date.now() - this.startedAt) / 1000;
  }

  banner() {
    const width = this.width;
    const compact = width < 72;
    const left = '  '
      + paint('◆', THEME.violet, { bold: true })
      + '  '
      + paint('contexto', THEME.white, { bold: true })
      + (compact ? '' : '  ' + dim('·') + '  ' + dim('exportador de contexto para IA'));
    const project = dim(truncate(PROJECT_NAME, Math.max(8, Math.floor(width / 3))));
    const gap = Math.max(2, width - visibleLength(left) - visibleLength(project) - 2);

    this.write([
      left + ' '.repeat(gap) + project,
      gradientRule(width),
      '',
    ]);
  }

  setPhase(label, hint = '') {
    this.phase = label;
    this.hint = hint;
    if (this.animate) this.draw();
  }

  setTask(task) {
    this.task = task;
  }

  write(lines) {
    this.clearLive();
    this.out.write(lines.join('\n') + '\n');
  }

  clearLive() {
    if (!this.liveLines) return;
    this.out.write(`\x1b[${this.liveLines}A`);
    for (let i = 0; i < this.liveLines; i += 1) this.out.write(CLEAR_LINE + '\n');
    this.out.write(`\x1b[${this.liveLines}A`);
    this.liveLines = 0;
  }

  draw() {
    if (!this.animate) return;
    const lines = [this.statusLine(), this.barLine()];

    if (this.liveLines > 0) this.out.write(`\x1b[${this.liveLines}A`);
    for (const line of lines) this.out.write(CLEAR_LINE + line + '\n');
    this.liveLines = lines.length;
  }

  statusLine() {
    const spinner = SPINNER[this.frame % SPINNER.length];
    const spinnerColor = sampleGradient(GRADIENT, (this.frame * 0.06) % 1);
    const left = '  '
      + paint(`${spinner}  `, spinnerColor, { bold: true })
      + paint(this.phase, THEME.white, { bold: true });

    let detail;
    if (this.task) {
      detail = `${formatNumber(this.task.done)}/${formatNumber(this.task.total)} archivos`
        + `  ·  ${formatBytes(this.task.bytes)}`;
    } else {
      detail = `${formatNumber(this.scan.files)} archivos`
        + `  ·  ${formatNumber(this.scan.dirs)} carpetas`;
    }

    const room = this.width - visibleLength(left) - 7;
    if (room < 10) return left;
    return `${left}  ${dim('·')}  ${dim(truncate(detail, room))}`;
  }

  barLine() {
    const width = this.width;
    const barWidth = Math.max(14, Math.min(52, width - 32));

    if (!this.task) {
      const hint = truncate(this.hint || 'procesando…', Math.max(6, width - barWidth - 6));
      return `  ${cometBar(barWidth, this.frame)}  ${dim(hint)}`;
    }

    const ratio = this.task.total > 0 ? this.task.done / this.task.total : 0;
    const bar = progressBar(barWidth, ratio, this.frame);
    const percent = `${String(Math.round(ratio * 100)).padStart(3)}%`;
    const percentColor = sampleGradient(GRADIENT, Math.max(0.35, ratio));
    const room = Math.max(0, width - barWidth - 12);
    const file = room > 6 ? truncate(this.task.current, room) : '';

    return `  ${bar}  ${paint(percent, percentColor, { bold: true })}${file ? '  ' + dim(file) : ''}`;
  }
}

let activeHud = null;

/* ------------------------------------------------------------------ */
/* Recolección de archivos                                             */
/* ------------------------------------------------------------------ */

function isSecretFile(name) {
  if (SECRET_FILES.has(name)) return true;
  if (/^\.env(\..+)?$/i.test(name) && !/\.(example|sample|template)$/i.test(name)) {
    return true;
  }
  return false;
}

function classifyFile(name) {
  if (IGNORE_FILES.has(name)) return 'ignored';
  if (isSecretFile(name)) return 'secret';

  const ext = path.extname(name).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return 'include';

  const isDotfile = name.startsWith('.') && name !== '.' && name !== '..';
  if (isDotfile && (ext === '' || TEXT_EXTENSIONS.has(ext))) return 'include';

  return 'other';
}

function isBinary(buffer) {
  const limit = Math.min(buffer.length, 8000);
  for (let i = 0; i < limit; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

async function scanDirectory(dir, ctx, hud) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    ctx.errors.push({ path: dir, message: error.message });
    return;
  }

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? 1 : -1;
    return a.name.localeCompare(b.name, 'es');
  });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      ctx.scannedDirs += 1;
      await scanDirectory(absolute, ctx, hud);
    } else if (entry.isFile()) {
      if (path.resolve(absolute) === ctx.outputPath) continue;

      const kind = classifyFile(entry.name);
      if (kind === 'secret') {
        ctx.skipped.secret += 1;
        continue;
      }
      if (kind !== 'include') continue;

      try {
        const stat = await fsp.stat(absolute);
        if (stat.size > MAX_FILE_BYTES) {
          ctx.skipped.large += 1;
          continue;
        }
        ctx.candidates.push({
          abs: absolute,
          rel: path.relative(ROOT_DIR, absolute).split(path.sep).join('/'),
          name: entry.name,
          bytes: stat.size,
        });
      } catch (error) {
        ctx.errors.push({ path: absolute, message: error.message });
        ctx.skipped.error += 1;
      }
    }

    ctx.visited += 1;
    hud.scan = { files: ctx.candidates.length, dirs: ctx.scannedDirs };

    if (ctx.visited % 25 === 0) await tick();
  }
}

function countLines(text) {
  if (!text) return 0;
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  return body === '' ? 0 : body.split('\n').length;
}

async function readSources(ctx, hud) {
  const files = [];
  const total = ctx.candidates.length;
  const pace = hud.animate && total > 0 ? Math.min(16, 800 / total) : 0;

  hud.setTask({ done: 0, total, bytes: 0, current: '' });

  for (let i = 0; i < total; i += 1) {
    const candidate = ctx.candidates[i];
    try {
      const buffer = await fsp.readFile(candidate.abs);
      if (isBinary(buffer)) {
        ctx.skipped.binary += 1;
      } else {
        let content = buffer.toString('utf8').replace(/\r\n/g, '\n');
        if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
        ctx.readBytes += buffer.length;
        files.push({
          ...candidate,
          content,
          lines: countLines(content),
          bytes: buffer.length,
        });
      }
    } catch (error) {
      ctx.errors.push({ path: candidate.abs, message: error.message });
      ctx.skipped.error += 1;
    }

    hud.setTask({ done: i + 1, total, bytes: ctx.readBytes, current: candidate.rel });
    if (pace > 0) await sleep(pace);
  }

  hud.setTask(null);
  files.sort((a, b) => a.rel.localeCompare(b.rel, 'es'));
  return files;
}

/* ------------------------------------------------------------------ */
/* Documento Markdown                                                  */
/* ------------------------------------------------------------------ */

function countDirectories(files) {
  const dirs = new Set();
  for (const file of files) {
    const parts = file.rel.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }
  return dirs.size;
}

function buildTreeLines(files) {
  const root = { dirs: new Map(), files: [] };

  for (const file of files) {
    const parts = file.rel.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { dirs: new Map(), files: [] });
      node = node.dirs.get(parts[i]);
    }
    node.files.push(parts[parts.length - 1]);
  }

  const lines = [`${PROJECT_NAME}/`];

  const walk = (node, prefix) => {
    const dirs = [...node.dirs.keys()].sort((a, b) => a.localeCompare(b, 'es'));
    const entries = dirs
      .map((name) => ({ type: 'dir', name }))
      .concat([...node.files].sort((a, b) => a.localeCompare(b, 'es')).map((name) => ({ type: 'file', name })));

    entries.forEach((entry, index) => {
      const last = index === entries.length - 1;
      lines.push(prefix + (last ? '└─ ' : '├─ ') + entry.name + (entry.type === 'dir' ? '/' : ''));
      if (entry.type === 'dir') {
        walk(node.dirs.get(entry.name), prefix + (last ? '   ' : '│  '));
      }
    });
  };

  walk(root, '');
  return lines;
}

function longestBacktickRun(text) {
  let max = 0;
  let run = 0;
  for (const char of text) {
    if (char === '`') {
      run += 1;
      if (run > max) max = run;
    } else {
      run = 0;
    }
  }
  return max;
}

function languageFor(file) {
  if (LANGUAGE_BY_NAME[file.name]) return LANGUAGE_BY_NAME[file.name];
  const ext = path.extname(file.name).toLowerCase();
  if (ext === '' && file.name.startsWith('.env')) return 'bash';
  return LANGUAGE_BY_EXT[ext] || '';
}

function renderFileSection(file) {
  const language = languageFor(file);
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(file.content) + 1));
  const body = file.content === '' || file.content.endsWith('\n')
    ? file.content
    : `${file.content}\n`;

  return [
    '---',
    '',
    `### 📄 ARCHIVO: \`${file.rel}\``,
    '',
    `_${formatNumber(file.lines)} ${plural(file.lines, 'línea', 'líneas')} · ${formatBytes(file.bytes)}_`,
    '',
    fence + language,
    body + fence,
    '',
  ].join('\n');
}

function buildDocument(files) {
  const now = new Date();
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const totalLines = files.reduce((sum, file) => sum + file.lines, 0);
  const totalDirs = countDirectories(files);
  const tree = buildTreeLines(files);

  const intro = [
    `# 🧩 Contexto del proyecto · ${PROJECT_NAME}`,
    '',
    `> Exportación generada el ${formatDate(now)} a las ${formatTime(now)}`,
    `> ${formatNumber(files.length)} ${plural(files.length, 'archivo', 'archivos')} · `
      + `${formatNumber(totalDirs)} ${plural(totalDirs, 'carpeta', 'carpetas')} · `
      + `${formatNumber(totalLines)} líneas · ${formatBytes(totalBytes)}`,
    '',
    'Este documento reúne el código fuente, la configuración y la documentación',
    'del proyecto en un único archivo para usarlo como contexto en un asistente de IA.',
    '',
    '## 🗂️ Estructura',
    '',
    '```text',
    ...tree,
    '```',
    '',
    '## 📚 Índice de archivos',
    '',
    '| # | Archivo | Líneas | Peso |',
    '| ---: | :--- | ---: | ---: |',
    ...files.map((file, index) => (
      `| ${index + 1} | \`${file.rel.replace(/\|/g, '\\|')}\` | `
      + `${formatNumber(file.lines)} | ${formatBytes(file.bytes)} |`
    )),
    '',
    '## 📦 Código fuente',
    '',
    'Cada archivo comienza con su ruta, su número de líneas y un bloque de código',
    'con el contenido completo.',
    '',
  ].join('\n');

  const sections = files.map(renderFileSection).join('\n');
  const footer = `\n---\n\n_Fin del contexto · ${formatNumber(files.length)} `
    + `${plural(files.length, 'archivo exportado', 'archivos exportados')}._\n`;

  return intro + '\n' + sections + footer;
}

/* ------------------------------------------------------------------ */
/* Resumen en terminal                                                 */
/* ------------------------------------------------------------------ */

function groupTopLevel(files) {
  const groups = new Map();

  for (const file of files) {
    const parts = file.rel.split('/');
    const isDir = parts.length > 1;
    const key = parts[0];
    if (!groups.has(key)) {
      groups.set(key, { name: key + (isDir ? '/' : ''), isDir, files: 0, bytes: 0 });
    }
    const group = groups.get(key);
    group.files += 1;
    group.bytes += file.bytes;
  }

  return [...groups.values()].sort((a, b) => (
    Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name, 'es')
  ));
}

async function revealTree(hud, files) {
  if (files.length === 0) return;

  const groups = groupTopLevel(files);
  const shown = groups.slice(0, 8);
  const nameWidth = Math.max(14, Math.min(30, hud.width - 33));

  hud.write(['  ' + dim('CONTENIDO')]);

  for (let i = 0; i < shown.length; i += 1) {
    const group = shown[i];
    const color = sampleGradient(GRADIENT, i / Math.max(1, shown.length - 1));
    const label = `${formatNumber(group.files)} ${plural(group.files, 'archivo', 'archivos')}`;
    const size = formatBytes(group.bytes);

    hud.write([
      '  ' + paint('▸', color, { bold: true }) + '  '
      + paint(truncate(group.name, nameWidth).padEnd(nameWidth), THEME.white, { bold: true }) + '  '
      + dim(label.padStart(12)) + '  '
      + dim(size.padStart(9)),
    ]);

    if (hud.animate) await sleep(30);
  }

  if (groups.length > shown.length) {
    hud.write(['  ' + dim(`  + ${groups.length - shown.length} más`)]);
  }
}

function describeSkips(skipped) {
  const details = [];
  if (skipped.secret) details.push(`${skipped.secret} .env`);
  if (skipped.binary) details.push(`${skipped.binary} ${plural(skipped.binary, 'binario', 'binarios')}`);
  if (skipped.large) details.push(`${skipped.large} ${plural(skipped.large, 'grande', 'grandes')}`);
  if (skipped.error) details.push(`${skipped.error} con ${plural(skipped.error, 'error', 'errores')}`);
  return details;
}

function printSummary(hud, ctx, files, outputPath, elapsed) {
  const relative = path.relative(ROOT_DIR, outputPath);
  const display = relative.startsWith('..') ? outputPath : relative;
  const size = fs.statSync(outputPath).size;
  const dirs = countDirectories(files);
  const lines = files.reduce((sum, file) => sum + file.lines, 0);
  const value = (text) => paint(text, THEME.white, { bold: true });
  const separator = dim('  ·  ');

  const stats = [
    value(formatNumber(files.length)) + ' ' + dim(plural(files.length, 'archivo', 'archivos')),
    value(formatNumber(dirs)) + ' ' + dim(plural(dirs, 'carpeta', 'carpetas')),
    value(formatNumber(lines)) + ' ' + dim('líneas'),
    value(`${elapsed.toFixed(2).replace('.', ',')} s`),
  ];
  const statLines = visibleLength(stats.join(separator)) + 4 <= hud.width
    ? [stats.join(separator)]
    : [stats.slice(0, 2).join(separator), stats.slice(2).join(separator)];

  const skippedTotal = ctx.skipped.secret + ctx.skipped.binary
    + ctx.skipped.large + ctx.skipped.error;
  const details = describeSkips(ctx.skipped);

  const output = [
    '',
    '  ' + paint('✔', THEME.mint, { bold: true }) + '  '
    + paint(display, THEME.white, { bold: true }) + '  ' + dim('·') + '  '
    + paint(formatBytes(size), THEME.cyan, { bold: true }),
    '',
    '    ' + stats,
  ];

  if (skippedTotal > 0 && details.length > 0) {
    output.push('    ' + dim(
      `${skippedTotal} ${plural(skippedTotal, 'archivo omitido', 'archivos omitidos')} (${details.join(', ')})`,
    ));
  }

  output.push(
    '',
    '    ' + dim('Listo para pegar como contexto en tu asistente de IA.'),
    '',
  );

  hud.write(output);

  if (ctx.errors.length > 0) {
    for (const error of ctx.errors.slice(0, 3)) {
      hud.write(['  ' + paint('!', THEME.red, { bold: true }) + ' ' + dim(`${error.path}: ${error.message}`)]);
    }
  }
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = { plain: false, includeEnv: false, help: false, out: null, error: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--plain' || arg === '--no-anim' || arg === '--static') {
      opts.plain = true;
    } else if (arg === '--include-env') {
      opts.includeEnv = true;
    } else if (arg === '--out' || arg === '-o') {
      if (!argv[i + 1]) {
        opts.error = `La opción ${arg} necesita una ruta.`;
        break;
      }
      i += 1;
      opts.out = argv[i];
    } else if (arg.startsWith('--out=')) {
      opts.out = arg.slice('--out='.length) || null;
    } else {
      opts.error = `Opción desconocida: ${arg}`;
      break;
    }
  }

  return opts;
}

function printHelp() {
  const hud = new Hud({ animate: false });
  hud.banner();

  const rows = [
    ['node export_context.js', 'exporta el proyecto con animaciones'],
    ['--plain', 'sin animaciones (ideal para CI o pipes)'],
    ['--out=<ruta>, -o <ruta>', 'ruta del Markdown de salida'],
    ['--include-env', 'incluye archivos .env (¡contienen secretos!)'],
    ['-h, --help', 'muestra esta ayuda'],
  ];

  const lines = ['  ' + bold('Uso')];
  for (const [command, description] of rows) {
    lines.push('    ' + paint(command.padEnd(30), THEME.cyan) + dim(description));
  }
  lines.push(
    '',
    '  ' + bold('Salida por defecto'),
    '    ' + dim(path.join(ROOT_DIR, DEFAULT_OUTPUT)),
    '',
  );

  hud.write(lines);
}

async function run(opts) {
  const outputPath = opts.out
    ? path.resolve(process.cwd(), opts.out)
    : path.join(ROOT_DIR, DEFAULT_OUTPUT);

  const hud = new Hud({ animate: !opts.plain && IS_TTY && COLOR_ENABLED });
  activeHud = hud;

  hud.banner();
  hud.start();
  hud.setPhase('Escaneando archivos', `recorriendo ${PROJECT_NAME}`);

  const ctx = {
    candidates: [],
    scannedDirs: 0,
    visited: 0,
    readBytes: 0,
    skipped: { secret: 0, binary: 0, large: 0, error: 0 },
    errors: [],
    outputPath: path.resolve(outputPath),
  };

  await scanDirectory(ROOT_DIR, ctx, hud);

  hud.setPhase('Leyendo fuentes', 'preparando archivos');
  const files = await readSources(ctx, hud);

  hud.setPhase('Generando documento', `escribiendo ${path.basename(outputPath)}`);
  if (hud.animate) await sleep(220);

  const document = buildDocument(files);
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.writeFile(outputPath, document, 'utf8');

  const elapsed = hud.elapsed();
  hud.stop();
  activeHud = null;

  await revealTree(hud, files);
  printSummary(hud, ctx, files, outputPath, elapsed);

  return files.length;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.error) {
    process.stdout.write('\n  ' + paint('✖', THEME.red, { bold: true }) + '  ' + opts.error + '\n\n');
    process.exitCode = 1;
    return;
  }

  if (opts.help) {
    printHelp();
    return;
  }

  return run(opts);
}

process.on('SIGINT', () => {
  if (activeHud) activeHud.stop();
  process.stdout.write('\n  ' + dim('cancelado') + '\n');
  process.exit(130);
});

main().catch((error) => {
  if (activeHud) activeHud.stop();
  process.stdout.write('\n  ' + paint('✖', THEME.red, { bold: true }) + '  ' + error.message + '\n\n');
  process.exitCode = 1;
});
