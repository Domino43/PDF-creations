const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const sharp = require('sharp');

const LAYOUTS = ['Daily', 'Weekly', 'Monthly'];

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function toSlug(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'layout';
}

function getDatasetLines(dataset = {}) {
  return Object.entries(dataset).flatMap(([key, value]) => {
    const entries = String(value).split(/\r?\n/);
    return entries.map((entry, index) => (index === 0 ? `${key}: ${entry}` : `  ${entry}`));
  });
}

async function createLayoutPdf(layout, dataset, outputPath) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([595, 842]);

  const drawHeader = (targetPage, continuation = false) => {
    targetPage.drawText(`${layout} Planner${continuation ? ' (cont.)' : ''}`, {
      x: 50,
      y: 790,
      size: 26,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1)
    });

    targetPage.drawText('Generated from one shared dataset', {
      x: 50,
      y: 760,
      size: 12,
      font,
      color: rgb(0.35, 0.35, 0.35)
    });
  };

  drawHeader(page);
  const textSize = 12;
  const maxTextWidth = 495;

  const lines = getDatasetLines(dataset);
  let y = 720;
  for (const line of lines) {
    const wrappedLines = wrapLineToWidth(line, font, textSize, maxTextWidth);
    for (const wrappedLine of wrappedLines) {
      if (y < 80) {
        page = pdfDoc.addPage([595, 842]);
        drawHeader(page, true);
        y = 720;
      }

      page.drawText(wrappedLine, {
        x: 50,
        y,
        size: textSize,
        font,
        color: rgb(0.15, 0.15, 0.15)
      });
      y -= 20;
    }
  }

  const bytes = await pdfDoc.save();
  await fs.writeFile(outputPath, bytes);
}

function wrapLineToWidth(line, font, size, maxWidth) {
  const words = String(line).split(' ');
  const wrapped = [];
  let currentLine = '';

  const flushCurrentLine = () => {
    if (currentLine) {
      wrapped.push(currentLine);
      currentLine = '';
    }
  };

  for (const word of words) {
    const trial = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      currentLine = trial;
      continue;
    }

    if (currentLine) {
      flushCurrentLine();
    }

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      currentLine = word;
      continue;
    }

    let chunk = '';
    for (const char of word) {
      const chunkTrial = `${chunk}${char}`;
      if (font.widthOfTextAtSize(chunkTrial, size) <= maxWidth) {
        chunk = chunkTrial;
      } else {
        wrapped.push(chunk);
        chunk = char;
      }
    }
    if (chunk) {
      currentLine = chunk;
    }
  }

  flushCurrentLine();
  return wrapped.length ? wrapped : [''];
}

function createPreviewSvg(layout, dataset) {
  const lines = getDatasetLines(dataset).slice(0, 8);
  const lineText = lines
    .map((line, index) => `<text x="90" y="${260 + index * 70}" font-size="42" fill="#202020">${escapeHtml(line)}</text>`)
    .join('');

  return `
<svg width="1240" height="1754" xmlns="http://www.w3.org/2000/svg">
  <rect width="1240" height="1754" fill="#fefefe"/>
  <rect x="45" y="45" width="1150" height="1664" fill="none" stroke="#d9d9d9" stroke-width="6"/>
  <text x="90" y="170" font-size="66" font-family="Arial" font-weight="700" fill="#111111">${escapeHtml(layout)} Planner</text>
  ${lineText}
</svg>`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function createPreview(layout, dataset, outputPath) {
  const svg = createPreviewSvg(layout, dataset);
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

async function createMockup(previewPath, outputPath) {
  const backgroundSvg = `
<svg width="1800" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d9d0c2"/>
      <stop offset="100%" stop-color="#c8b89e"/>
    </linearGradient>
  </defs>
  <rect width="1800" height="1200" fill="url(#bg)"/>
  <rect x="90" y="80" width="1620" height="1040" rx="38" fill="#ede3d5" opacity="0.35"/>
</svg>`;

  const previewImage = sharp(previewPath);
  const metadata = await previewImage.metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new Error(`Unable to read preview dimensions for ${previewPath}`);
  }

  const left = Math.floor(width * 0.056);
  const top = Math.floor(height * 0.051);
  const extractWidth = Math.max(1, width - left * 2);
  const extractHeight = Math.max(1, height - top * 2);

  const croppedPreview = await previewImage
    .extract({ left, top, width: extractWidth, height: extractHeight })
    .resize({ width: 700, height: 950, fit: 'cover' })
    .png()
    .toBuffer();

  const shadow = await sharp({
    create: {
      width: 720,
      height: 970,
      channels: 4,
      background: '#00000066'
    }
  })
    .blur(12)
    .png()
    .toBuffer();

  await sharp(Buffer.from(backgroundSvg))
    .composite([
      { input: shadow, left: 545, top: 130 },
      { input: croppedPreview, left: 535, top: 120 }
    ])
    .png()
    .toFile(outputPath);
}

async function generateBatchOutputs(dataset, options = {}) {
  const outputDir = options.outputDir || path.resolve(process.cwd(), 'output');
  const layouts = options.layouts || LAYOUTS;
  const usedSlugs = new Set();

  const pdfDir = path.join(outputDir, 'pdf');
  const previewDir = path.join(outputDir, 'preview');
  const mockupDir = path.join(outputDir, 'mockup');

  await Promise.all([ensureDir(pdfDir), ensureDir(previewDir), ensureDir(mockupDir)]);

  const results = [];

  for (const layout of layouts) {
    const baseSlug = toSlug(layout);
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
    usedSlugs.add(slug);
    const pdfPath = path.join(pdfDir, `${slug}.pdf`);
    const previewPath = path.join(previewDir, `${slug}.png`);
    const mockupPath = path.join(mockupDir, `${slug}-mockup.png`);

    await createLayoutPdf(layout, dataset, pdfPath);
    await createPreview(layout, dataset, previewPath);
    await createMockup(previewPath, mockupPath);

    results.push({ layout, pdfPath, previewPath, mockupPath });
  }

  return results;
}

module.exports = {
  LAYOUTS,
  generateBatchOutputs
};
