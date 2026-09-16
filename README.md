# PDF-creations

Generate multiple PDF planner variants from one dataset, then create preview/mockup images.

## Features

- Batch PDF generation for `Daily`, `Weekly`, and `Monthly` layouts.
- Cover/mockup generation using `sharp` by cropping planner previews and compositing them onto a realistic background.

## Usage

Requires Node.js `>=20.9.0`.

```bash
npm install
npm run generate
```

Generated files are written to:

- `output/pdf`
- `output/preview`
- `output/mockup`

## Programmatic API

`generateBatchOutputs(dataset, options)` supports:

- `options.outputDir`: custom output directory (default: `./output`)
- `options.layouts`: custom layouts array (default: `Daily`, `Weekly`, `Monthly`)
