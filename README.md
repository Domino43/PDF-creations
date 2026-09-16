# PDF-creations

Generate multiple PDF planner variants from one dataset, then create preview/mockup images.

## Features

- Batch PDF generation for `Daily`, `Weekly`, and `Monthly` layouts.
- Cover/mockup generation using `sharp` by cropping planner previews and compositing them onto a realistic background.

## Usage

```bash
npm install
npm run generate
```

Generated files are written to:

- `output/pdf`
- `output/preview`
- `output/mockup`
