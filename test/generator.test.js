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
  assert.equal(path.basename(outputs[0].previewPath), 'daily-plan.png');
  assert.equal(path.basename(outputs[1].previewPath), 'daily-plan-2.png');
  assert.equal(path.basename(outputs[0].mockupPath), 'daily-plan-mockup.png');
  assert.equal(path.basename(outputs[1].mockupPath), 'daily-plan-2-mockup.png');
});

test('generateBatchOutputs paginates pdf content for large datasets', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-creations-pages-'));
  const dataset = {};
  for (let index = 1; index <= 55; index += 1) {
    dataset[`Item${index}`] = `Value ${index}`;
  }

  const [dailyOutput] = await generateBatchOutputs(dataset, { outputDir, layouts: ['Daily'] });
  const pdfBytes = await fs.readFile(dailyOutput.pdfPath);
  const pdf = await PDFDocument.load(pdfBytes);

  assert.ok(pdf.getPageCount() > 1);
});

test('generateBatchOutputs wraps long values instead of overflowing width', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-creations-wrap-'));
  const longWord = 'ABCDEFGHIJKLMNOPQRSTUVWX'.repeat(220);

  const [dailyOutput] = await generateBatchOutputs(
    { Description: longWord },
    { outputDir, layouts: ['Daily'] }
  );

  const pdfBytes = await fs.readFile(dailyOutput.pdfPath);
  const pdf = await PDFDocument.load(pdfBytes);
  assert.ok(pdf.getPageCount() > 1);
});
