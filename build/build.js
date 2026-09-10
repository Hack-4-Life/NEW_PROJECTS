/* ============================================================================
   Waypoint Budget Studio — build
   Produces the customer deliverable: one self-contained .html file (no external
   requests at all), plus the guide, licence and a ready-to-upload ZIP.

   Usage:  node build/build.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VERSION = '1.0';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => {
  const full = path.join(DIST, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, s);
  return full;
};

/* --------------------------------------------------- 1. single-file bundle */
const files = ['store', 'engine', 'charts', 'app', 'views'];
let html = read('index.html');

const banner = (name) =>
  `<script>\n/*! ${'Waypoint Budget Studio'} v${VERSION} — module: ${name}\n` +
  ` *  Self-contained, offline, no dependencies. Your data never leaves this device. */\n`;

let inline = '';
for (const f of files) {
  const code = read(`src/js/${f}.js`).replace(/^\uFEFF/, '');
  inline += banner(f) + code + '\n</script>\n';
}

const scriptTags = files.map((f) => `<script src="src/js/${f}.js"></script>`).join('\n');
if (!html.includes(scriptTags)) {
  // tolerate whitespace differences between the tags
  const re = new RegExp(files.map((f) => `\\s*<script src="src/js/${f}\\.js"><\\/script>`).join('') + '\\s*');
  if (!re.test(html)) throw new Error('Could not find the module script tags in index.html');
  /* replacement must be a function: the source contains $ patterns ($', $$) */
  html = html.replace(re, () => '\n' + inline);
} else {
  html = html.replace(scriptTags, () => inline);
}

html = html.replace('<title>Waypoint — Interactive Budget Dashboard</title>',
  () => `<title>Waypoint Budget Studio v${VERSION} — Interactive Budget Dashboard</title>`);
html = html.replace('</head>', () => `<!-- Waypoint Budget Studio v${VERSION} · built ${new Date().toISOString().slice(0, 10)} · open this file in any browser, online or off -->\n</head>`);
const bundleName = 'Waypoint-Budget-Studio.html';
write(bundleName, html);
console.log('✓ ' + bundleName + '  (' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB, zero external requests)');

/* --------------------------------------------------------- 2. read me first */
const readme = `WAYPOINT BUDGET STUDIO v${VERSION}
Interactive budget dashboard · offline · no subscription · no account
===========================================================================

THANK YOU. Here is how to be up and running in about a minute.

1.  Put this whole folder somewhere you will find it again.
    A folder called "Budget" on your Desktop, or inside Documents, is perfect.
    (Mac: drag it to Applications or Documents. Windows: Documents.)

2.  Double-click  →  Waypoint-Budget-Studio.html
    It opens in whatever browser you already use: Chrome, Edge, Safari, Firefox,
    Arc, Brave — all of them work. Nothing installs. Nothing asks for a login.

3.  Follow the 3-step welcome. Choose "Load the sample budget" if you want to
    poke around a fully populated dashboard first — you can wipe it later from
    Settings → Your data → Erase everything.

4.  Open the Getting-Started-Guide.html next to it for the full tour: envelopes,
   the payday countdown, the 45-day cash forecast and the debt payoff planner.

WHERE YOUR DATA LIVES
---------------------
Everything you type is stored inside your own browser, on your own device.
There is no account, no sync, no server, no analytics and no internet
connection required — you can put your laptop in aeroplane mode and it still
works perfectly.

The trade-off is that a browser's storage belongs to one browser on one
computer. So:

  •  Keep these files in the same place. Opening the same file in the same
     browser keeps all of your data.
  •  Moving to a new computer, a new browser, or clearing your browsing data?
     Go to Settings → Your data → "Download backup (.json)" first, then
     "Restore from backup" on the other side. Ten seconds, everything moves.

MAKE IT YOURS (all optional, all in Settings)
---------------------------------------------
  •  Five themes — Midnight, Vault, Blush, Daylight, Paper.
  •  Any currency and number format.
  •  Weekly, fortnightly, twice-monthly or monthly pay.
  •  Safety buffer size, and what counts as cash you can spend.
  •  Privacy goggles: blurs every amount for when you are on a train.

QUESTIONS, TROUBLE, IDEAS
-------------------------
Message me through Etsy — I answer quickly, and updates are free forever.

If a file ever looks wrong, delete nothing: take a copy of the folder first,
then message me. Your data is almost always recoverable from the backup file
or from the browser's own copy.

Waypoint is a personal budgeting tool, not financial advice.
`;
write('READ-ME-FIRST.txt', readme);
console.log('✓ READ-ME-FIRST.txt');

/* ------------------------------------------------------------- 3. licence */
const licence = `WAYPOINT BUDGET STUDIO — PERSONAL USE LICENCE v${VERSION}
===========================================================================

You MAY:
  •  Use this dashboard for your own personal or household budgeting.
  •  Copy the files onto your own devices (laptop, desktop, tablet, phone,
     USB stick, cloud folder) for your own use.
  •  Print screenshots of your own dashboard for your own records.
  •  Keep using every future update of this product at no extra cost.

You MAY NOT:
  •  Resell, sublicense, rent or redistribute these files, in whole or in part,
     including as part of another product, template pack or bundle.
  •  Share the files publicly (file-sharing sites, cloud links, chat groups,
     classroom or client distribution) or upload them to a template marketplace.
  •  Claim authorship of the dashboard, its design or its code.
  •  Sell a derivative product built from these files.

One purchase = one household. If a friend wants one, please send them to the
shop listing — small makers live on that.

No warranty is provided, express or implied. This is a personal budgeting tool,
not financial, tax or investment advice. You are responsible for the accuracy
of the numbers you enter.

© ${new Date().getFullYear()} — all rights reserved.
`;
write('LICENSE.txt', licence);
console.log('✓ LICENSE.txt');

/* ------------------------------------------------------------ 4. zip it up */
function zipFiles(outPath, entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const dosTime = (() => {
    const d = new Date();
    return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xffff;
  })();
  const dosDate = (() => {
    const d = new Date();
    return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  })();

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    if (typeof zlib.crc32 !== 'function') throw new Error('Node 20.15+ required for zlib.crc32');
    const crc = zlib.crc32(data);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // UTF-8 flag
    local.writeUInt16LE(8, 8);           // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, deflated);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc >>> 0, 16);
    cd.writeUInt32LE(deflated.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(0, 38);              // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + deflated.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.writeFileSync(outPath, Buffer.concat([...chunks, centralBuf, end]));
}

const guidePath = path.join(ROOT, 'build', 'guide.html');
const guide = fs.existsSync(guidePath) ? fs.readFileSync(guidePath, 'utf8') : '';
if (guide) { write('Getting-Started-Guide.html', guide); console.log('✓ Getting-Started-Guide.html'); }

const zipEntries = [
  { name: 'READ-ME-FIRST.txt', data: readme },
  { name: 'Waypoint-Budget-Studio.html', data: html }
];
if (guide) zipEntries.push({ name: 'Getting-Started-Guide.html', data: guide });
zipEntries.push({ name: 'LICENSE.txt', data: licence });

const zipPath = path.join(DIST, 'Waypoint-Budget-Studio-v' + VERSION + '.zip');
zipFiles(zipPath, zipEntries);
console.log('✓ ' + path.basename(zipPath) + '  (' + (fs.statSync(zipPath).size / 1024).toFixed(0) + ' KB)');
console.log('\nDist folder ready: ' + DIST);
