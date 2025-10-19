# Signal Plan Checker

**Version 2.6.1**

A web-based timing diagram tool for validating and visualizing traffic signal coordination plans. Design, test, and analyze multi-junction signal timing with interactive plots and UTC plan validation.

---

## Features

- **Multi-Junction Planning** - Support for 2-5 junctions with configurable stages and intergreens
- **UTC Plan Validation** - Automatic validation of signal change timing
- **Interactive Timing Diagrams** - Visual representation of signal phases across cycles
- **Time-Based Overlays** - Highlight specific time ranges or stages
- **Offset Adjustments** - Fine-tune junction timing with boundary adjustments
- **Export/Import** - Save and load complete signal plans
- **Copy to Clipboard** - Export diagrams as PNG images
- **HiDPI Support** - Crisp rendering on retina displays

---

## Quick Start

1. Open `index.html` in a modern web browser
2. Configure your junctions in the **Data** tab
3. Click **Validate and Plot** to generate the timing diagram
4. Switch to the **Plot** tab to view results

No installation, build process, or dependencies required - just open and use!

---

## File Structure

```
timingdiagrams/
├── index.html              # Main application entry point
├── styles.css              # Application styles
├── init.config.json        # Default configuration
├── VERSION.json            # Version information
├── js/                     # JavaScript modules
│   ├── boot.js            # Application initialization
│   ├── canvas-renderer.js # Drawing and rendering
│   ├── config.js          # Configuration loading
│   ├── core.js            # Core state management
│   ├── file-io.js         # Save/load functionality
│   ├── interactions.js    # Mouse/touch interactions
│   ├── plan-computation.js # UTC plan calculations
│   ├── tab-manager.js     # Tab switching logic
│   ├── ui-handlers.js     # UI event handlers
│   └── validation.js      # Plan validation logic
└── docs/
    └── TD2_User_Manual.pdf # Detailed user guide
```

---

## Configuration

The application uses `init.config.json` for default settings. Key configuration options:

- **mainCycleTime** - Default cycle length (60s)
- **junctionCount** - Default number of junctions (2-5)
- **stage settings** - Min green time, intergreen defaults
- **plot settings** - Canvas size, grid spacing, colors
- **overlays** - Default opacity and behavior

---

## Usage

### Creating a Signal Plan

1. **Set Main Cycle** - Configure the main cycle time in seconds
2. **Add Junctions** - Specify number of junctions (2-5)
3. **Configure Stages** - For each junction:
   - Set stage labels (e.g., S1, S2)
   - Define minimum green times
   - Set intergreen matrix values
4. **Add UTC Plan** - Define stage changes and timing
5. **Validate** - Check for timing conflicts and errors
6. **Plot** - Generate the visual timing diagram

### Adjusting Timing

- **Overlays** - Highlight specific time ranges or stages across junctions
- **Adjust Modal** - Fine-tune boundary offsets between stage changes
- **View Cycles** - Display 1-3 cycles for detailed analysis

### Exporting

- **Save** - Export complete plan as .TD2 file
- **Load** - Import previously saved plans
- **Copy** - Copy diagram to clipboard as PNG image

---

## Browser Compatibility

- **Chrome/Edge** - Full support (recommended)
- **Firefox** - Full support
- **Safari** - Full support (clipboard API limited on file:// protocol)

Requires a modern browser with:
- ES6+ JavaScript support
- Canvas 2D API
- CSS Grid/Flexbox

---

## Development

### Modular Architecture

The codebase is organized into focused modules:

- **boot.js** - Initializes the application, loads config, wires events
- **core.js** - Global state management (`App` object), logging, redraw scheduling
- **canvas-renderer.js** - All canvas drawing logic with HiDPI support
- **validation.js** - UTC plan validation rules and error checking
- **plan-computation.js** - Calculate adjusted plans and timing
- **ui-handlers.js** - Modal dialogs, tab panels, form inputs
- **file-io.js** - Save/load file operations
- **interactions.js** - Pan, zoom, drag interactions
- **tab-manager.js** - Master tab switching

### Debug Mode

Enable debug mode to see detailed logging:

1. Check the **Debug** checkbox in the toolbar
2. Switch to the **Debug** tab to view logs
3. Logs include timing, rendering, and validation events

---

## Known Issues

- Clipboard API requires HTTPS or localhost (file:// protocol falls back to download)
- Safari shows accessibility warnings for modal focus (cosmetic, non-breaking)

See `BUGS.md` for detailed issue tracking.

---

## Changelog

See `CHANGELOG.md` for version history and updates.

---

## License

MIT - See LICENSE file for details.

---

## Support

For detailed usage instructions, see the user manual in `docs/TD2_User_Manual.pdf`.
