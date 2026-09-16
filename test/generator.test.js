const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { generateBatchOutputs } = require('../src/generator');

test('generateBatchOutputs creates Daily/Weekly/Monthly pdf, preview and mockup files', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-creations-'));

  const dataset = {
    Task: 'Plan content',
    Goal: 'Ship layouts',
    Notes: 'Use one dataset'
  };

  const outputs = await generateBatchOutputs(dataset, { outputDir });

  assert.equal(outputs.length, 3);

  for (const output of outputs) {
    await fs.access(output.pdfPath);
    await fs.access(output.previewPath);
    await fs.access(output.mockupPath);

    const pdfBytes = await fs.readFile(output.pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    assert.equal(pdf.getPageCount(), 1);

    const previewMeta = await sharp(output.previewPath).metadata();
    const mockupMeta = await sharp(output.mockupPath).metadata();

    assert.equal(previewMeta.width, 1240);
    assert.equal(previewMeta.height, 1754);
    assert.equal(mockupMeta.width, 1800);
    assert.equal(mockupMeta.height, 1200);
  }
});

test('generateBatchOutputs supports custom layouts and safe output slugs', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-creations-custom-'));
  const layouts = ['Two Page', 'Quarterly/2026'];

  const outputs = await generateBatchOutputs(
    {
      Notes: 'Line one\nLine two'
    },
    { outputDir, layouts }
  );

  assert.deepEqual(
    outputs.map((output) => output.layout),
    layouts
  );

  assert.equal(path.basename(outputs[0].pdfPath), 'two-page.pdf');
  assert.equal(path.basename(outputs[1].pdfPath), 'quarterly-2026.pdf');
});

test('generateBatchOutputs resolves colliding layout slugs to unique files', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-creations-collision-'));
  const layouts = ['Daily Plan', 'Daily/Plan'];

  const outputs = await generateBatchOutputs({ Task: 'Collision check' }, { outputDir, layouts });

  assert.equal(path.basename(outputs[0].pdfPath), 'daily-plan.pdf');
  assert.equal(path.basename(outputs[1].pdfPath), 'daily-plan-2.pdf');
});
