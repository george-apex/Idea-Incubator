# Idea Incubator

A browser-first Idea Incubator with a calm pastel bubble UI, revisit prompts, and LAN import/export.

## Features

- **Bubble Canvas**: Spatial overview of ideas with drag, pan, and zoom
- **Sidebar List**: Traditional searchable list with filters
- **Inline Editing**: Click-to-edit everywhere with auto-save
- **Revisit System**: Mandatory review prompts when ideas are due
- **Confidence Tracking**: Auto-suggested confidence with manual override
- **Export/Import**: .pideas format for backup and sharing
- **Pastel Aesthetic**: Warm tan/orange palette with asymmetrical bubbles
- **Offline-First**: IndexedDB storage, works without internet

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This will start a local server at http://localhost:8080 and open it in your browser.

### Production

```bash
npm start
```

## Usage

### Creating Ideas

- Click "+ New Idea" in the bottom bar
- Use the quick add input for fast creation
- Double-click empty space on the canvas

### Managing Ideas

- Click any idea to view/edit details
- Drag bubbles on the canvas to reposition
- Use filters in the sidebar to find ideas

### Review System

- Ideas become "due" based on their review cadence (default 14 days)
- Clicking a due idea opens the mandatory review modal
- Answer prompts to update confidence and status
- Snooze options available (1, 3, or 7 days)

### Export/Import

- Export as .pideas (re-importable) or Markdown (readable)
- Import .pideas files to merge ideas
- Choose conflict resolution strategy

## Data Model

### Idea Object

- `id`: UUID
- `title`: string
- `summary`: string
- `problem`: string
- `why_interesting`: string
- `category`: string
- `status`: enum (Incubating, Exploring, Validating, Building, Shipped, Dropped)
- `confidence`: 0-100 integer
- `created_at`, `updated_at`, `last_reviewed_at`, `next_review_at`: timestamps
- `review_cadence_days`: integer
- `assumptions[]`: array of assumption objects
- `open_questions[]`: array of question objects
- `next_steps[]`: array of step objects
- `reviews[]`: array of review objects
- `links[]`: array of linked idea IDs
- `canvas_pos`: {x, y} coordinates
- `color_variant`: primary/secondary/tertiary
- `tags`: string array

## Browser Support

Works on modern desktop browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT
