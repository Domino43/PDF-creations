const { generateBatchOutputs } = require('./generator');

const dataset = {
  Title: 'Focus Planner',
  Owner: 'PDF Creations',
  Theme: 'Productivity',
  Priority1: 'Deep work',
  Priority2: 'Review goals',
  Priority3: 'Wellness break'
};

async function main() {
  const generated = await generateBatchOutputs(dataset);
  console.log('Generated files:');
  for (const entry of generated) {
    console.log(`- ${entry.layout}:`);
    console.log(`  PDF: ${entry.pdfPath}`);
    console.log(`  Preview: ${entry.previewPath}`);
    console.log(`  Mockup: ${entry.mockupPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
