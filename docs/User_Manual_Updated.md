# Signal Plan Checker 2.6.1 User Manual

**Build Year:** 2025
**Credits:** David Key / OpenAI

---

## Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Data Tab — Junctions, Stages & Intergreens](#data-tab)
4. [UTC Plans](#utc-plans)
5. [Scale Plans](#scale-plans) ⭐ NEW
6. [Plot Tab — Diagram, Ticks & Guides](#plot-tab)
7. [Overlays — Windows & Travel](#overlays)
8. [Adjustments — Offsets & Boundaries](#adjustments)
9. [Saving & Loading TD2 Files](#saving-loading)
10. [Status Bar & Filename](#status-bar)
11. [Debug Toggle](#debug-toggle)
12. [Help Button](#help-button) ⭐ NEW
13. [Technical Details](#technical-details) ⭐ NEW
14. [Credits](#credits)

---

## Overview

Signal Plan Checker helps you validate junction plans, visualise stage timings, and assess travel windows between junctions. This manual highlights the main screens and how to use them effectively.

**Key Features:**
- Multi-junction timing diagram visualization
- UTC/CLF plan validation
- Interactive overlays for travel time analysis
- Temporary adjustments with commit capability
- Plan scaling for different cycle times ⭐ NEW
- Save/load complete configurations
- HiDPI/Retina display support
- In-app help viewer

---

## Getting Started

### Initial Setup

1. **Open the Application**
   Open `index.html` in a modern web browser (Chrome, Firefox, Safari, or Edge)

2. **Configure Basic Parameters**
   - Set the **Main cycle** (1-240 seconds, default: 60s)
   - Set number of **Junctions** (2-5, default: 3)
   - Set **View cycles** (1, 2, or 3 cycles to display)

3. **Load Sample Data**
   On first load, the junction data auto-populates with sample data to get you started

4. **Access Help**
   Click the **Help** button in the top toolbar to view this manual in-app ⭐ NEW

### Workflow

1. Enter or adjust junction data on the **Data** tab
2. Click **Validate** to check constraints
3. Click **Plot** to render the timing diagram
4. Switch to **Plot** tab to view results
5. Use **Overlays** and **Adjust** for fine-tuning
6. **Save** your work for later use

### Supported File Formats

The application can load files with the following extensions:
- `.TD2` (primary format)
- `.td2` (lowercase variant)
- `.txt` (text-based export)
- `.json` (JSON format)
- `.plan` (plan export)

---

## Data Tab — Junctions, Stages & Intergreens

Each individual junction tab allows you to:

### Junction Configuration

- **Edit Junction Name** (14 character maximum)
- **Double Cycle** - Enable double-cycling for this junction
- **Travel Times** - Set upstream (↑) and downstream (↓) travel times

### Stage Configuration

- **Change Number of Stages** (2-8 stages per junction)
- **Stage Labels** - Typically S1, S2, etc.
- **Min Green** - Minimum green time in seconds
- **Direction Arrows** - Add visual indicators to plotted stages
  - Options: —, →, ←, ↑, ↓, ↔, ↕, Ped

### Intergreen Matrix

The intergreen matrix (right side) defines transition times between stages:
- Enter intergreen time in seconds for each stage-to-stage transition
- Use **-1** to indicate a non-permitted move
- Diagonal cells are locked (same stage to same stage)

### Validation

After editing junction data:
1. Click **Validate** to check for constraint violations
2. Review any error messages in the status bar
3. Click **Plot** to activate the plot area and draw the diagram

---

## UTC Plans

### UTC/CLF Fixed Plans

The UTC Plan section at the bottom of each junction tab allows you to define the force stage sequence:

**How It Works:**
- Similar to UTC force stage commands
- Enter the **target stage** and **time** (cycle-relative seconds) when the force bit is sent
- The diagram accounts for intergreens and min-green times to compute realized changes

**Editing:**
- **Add change** - Add a new stage change row
- **Delete** - Remove a stage change row
- Times are relative to the start of the cycle

**Validation:**
- The application checks for timing conflicts
- Blue markers indicate queued changes
- Warnings appear for delayed or missed changes

---

## Scale Plans

⭐ **NEW FEATURE** - Scale UTC plans to different cycle times while maintaining feasibility.

### Accessing Scale Plans

1. Configure and validate your junctions on the Data tab
2. Click the **Scale Plans** button (enabled after validation)
3. The Scale Plans modal will open

### Using Scale Plans

**Current Cycle**
Displays the current main cycle time (read-only)

**Target Cycle**
Enter the desired new cycle time (1-240 seconds)

**Suggest Min Button**
Click to automatically calculate the minimum feasible cycle time based on:
- Stage min-green times
- Intergreen constraints
- UTC plan requirements

**Remove Double Cycle Option**
Check this box to remove double cycling from any junctions during scaling

### Workflow

1. **Enter Target Cycle** - Type desired cycle time
2. **Preview** - Click Preview to see scaled UTC plans
   - Preview shows how stage changes will be adjusted
   - Diagnostic messages indicate any issues
3. **Review** - Check the preview results
4. **Apply or Export**
   - **Apply** - Update the current plan with scaled values
   - **Export JSON** - Download scaled plans as JSON file
   - **Cancel** - Close without changes

### Notes

- Scaling maintains proportional timing relationships
- Min-green and intergreen constraints are preserved
- If scaling is not feasible, diagnostic messages explain why
- Use "Suggest min" as a starting point for manual adjustments

---

## Plot Tab — Diagram, Ticks & Guides

The Plot tab displays the interactive timing diagram with multiple visualization and control options.

### Plot Toolbar

**Zoom Control**
- Slider adjusts pixels per second (1-12)
- Higher values = more zoomed in

**Fit Button**
- Auto-sets visible area to 0-120 seconds
- Quick reset to default view

**Overlays Button**
Opens the Overlays modal for adding travel time windows

**Adjust Button**
Opens the Adjustments modal for temporary offset changes

**Guides Checkbox**
Toggles grid lines and internal timing ticks on/off

**Enable Debug Checkbox**
Shows/hides the Debug tab for diagnostic logging

**Info Badge**
Displays current viewport information including:
- View range in seconds
- Current zoom level (pixels per second)
- Canvas dimensions

**Copy Button**
Copies the timing diagram to clipboard as PNG image
- On HTTPS/localhost: Direct clipboard copy
- On file:// protocol: Downloads PNG file (Safari limitation)

### Navigation

- **Mouse/Scroll Wheel** - Zoom in/out
- **Click and Drag** - Pan the timeline
- **Pinch Gesture** (touch devices) - Zoom
- **Fit Button** - Reset to default view

### Diagram Features

- **Green Bars** - Show active stage periods for each junction
- **Mirrored Tick Bars** - Top row ticks prevent overlap
- **Blue Triangles** - Mark start/end of stage changes
- **Grid Lines** - Subtle 10-second interval guides (when Guides enabled)
- **Stage Labels** - Show current stage name on bars

---

## Overlays — Windows & Travel

Overlays visualize journey times and arrival windows between junctions.

### Opening Overlays

Click the **Overlays…** button in the Plot toolbar

### Overlay Types

**Mode: Stage-Based**
- Select a specific stage at origin junction
- Shows when vehicles in that stage arrive at destination
- Shaded polygon shows arrival window

**Mode: Time-Based**
- Define custom start/end times at origin
- Shows corresponding arrival times at destination
- Useful for analyzing specific time windows

### Creating an Overlay

1. **From Junction** - Select origin junction (dropdown)
2. **To Junction** - Select destination junction (dropdown)
3. **Mode** - Choose "Stage" or "Time"
4. **Stage/Time Range**
   - Stage mode: Select stage from dropdown
   - Time mode: Enter start and end times in seconds
5. **Color** - Choose overlay color
   - Quick presets available for common colors
   - Custom color picker for precise selection
6. **Alpha** - Set transparency (0.0-1.0, default 0.3)
7. Click **Save overlay**

### Managing Overlays

- **Edit** - Click Edit button on existing overlay to modify
- **Delete** - Remove individual overlay
- **Clear All** - Remove all overlays at once

### Overlay Visualization

- **Dashed Lines** - Show window boundaries
- **Shaded Polygon** - Filled area shows arrival window
- **Color Coding** - Different colors for different routes
- **Transparency** - Overlapping windows remain visible

### Persistence

Overlays are saved with .TD2 files and restored when loading

---

## Adjustments — Offsets & Boundaries

Temporarily adjust UTC plans using junction offsets and boundary nudges without permanently modifying the plan.

### Opening Adjustments

Click the **Adjust…** button in the Plot toolbar

### Adjustment Types

**Junction Offset**
- Shifts the entire UTC plan forward/backward in time
- Select junction from dropdown
- Enter offset in seconds (positive = delay, negative = advance)
- Click **Apply** to apply offset

**Boundary Adjustments (Vary)**
- Fine-tune individual stage change boundaries
- Each stage-to-stage boundary can be adjusted independently
- Enter delta in seconds for each boundary
- Positive values delay the change, negative values advance it

### Workflow

1. **Select Junction** - Choose which junction to adjust
2. **Enter Offset** - Type offset value in seconds (or leave at 0)
3. **Adjust Boundaries** - Fine-tune individual boundaries if needed
4. **Apply** - Temporary changes shown in diagram
5. **Review** - Check the visual result in the diagram
6. **Commit or Reset**
   - **Update UTC plans** - Permanently apply adjustments to UTC plan
   - **Clear** - Remove all adjustments for selected junction
   - **Clear all** - Remove all adjustments for all junctions

### Important Notes

- Adjustments are **temporary** until committed
- Closing the modal preserves uncommitted adjustments
- **Update UTC plans** makes changes permanent
- Adjustments are saved with .TD2 files
- Status bar confirms all actions

---

## Saving & Loading TD2 Files

### Saving

1. Click **Save…** button in top toolbar
2. Enter filename in dialog (extension auto-added if omitted)
3. File is saved as human-readable JSON with comments

**What's Saved:**
- Main cycle time and view cycles
- Number of junctions
- All junction configurations (stages, intergreens, UTC plans)
- Overlays
- Uncommitted adjustments
- Timestamp and metadata

**File Format:**
`.TD2` files are commented JSON format for easy reading and manual editing if needed

### Loading

1. Click **Load…** button in top toolbar
2. Select a .TD2 file from the file dialog
3. All settings are restored

**Supported Extensions:**
`.TD2`, `.td2`, `.txt`, `.json`, `.plan`

### Filename Display

- Current filename shown in top-right corner
- Shows "file unsaved" for new/modified plans
- Displays last-saved timestamp after save

---

## Status Bar & Filename

### Status Message (Left Side)

Displays real-time feedback:
- **Validation results** - "VALIDATION OK" or error descriptions
- **Plot status** - "Plot clicked — drawing"
- **Copy status** - "TD Diagram copied to clipboard"
- **Commit confirmations** - "Offsets committed to UTC plans"
- **Save/Load status** - "Data saved to filename.TD2"

### Filename (Right Side)

Shows:
- Current filename: `Filename: myplan.TD2`
- Last saved time: `Last saved: HH:MM`
- Unsaved indicator: `Filename: file unsaved`

---

## Debug Toggle

Enable detailed diagnostic logging for troubleshooting and development.

### Enabling Debug Mode

1. Go to the **Plot** tab
2. Check **Enable Debug** checkbox in toolbar
3. A new **Debug** tab appears

### Debug Tab Features

**Clear Button**
Clears all log entries

**Log Display**
Shows chronological list of events with timestamps:
- `[HH:MM:SS]` timestamp
- Event description
- Event type (info, warning, error)

### What's Logged

- **Validation events** - "Validate clicked", "VALIDATION OK"
- **Rendering events** - "Hidden canvas redrawn", "scheduleRedraw"
- **User actions** - Button clicks, modal opens
- **Canvas operations** - Copy operations, dimension calculations
- **Errors and warnings** - Validation errors, timing conflicts

### Use Cases

- **Troubleshooting** - Identify why plots aren't updating
- **Performance** - See redraw frequency
- **Development** - Understand application flow
- **Bug reports** - Capture detailed event sequence

---

## Help Button

⭐ **NEW FEATURE** - Access this manual directly within the application.

### Opening Help

Click the **Help** button in the top toolbar (next to Save/Load buttons)

### Help Modal Features

**PDF Viewer**
- Embedded PDF viewer displays the full user manual
- Scroll, zoom, and navigate the PDF within the modal
- Close button (×) returns to application

**Fallback Link**
If your browser cannot display embedded PDFs:
- "Open the manual in a new tab" link appears
- Clicks open PDF in separate browser tab

### Browser Compatibility

- **Chrome/Edge** - Embedded viewer works well
- **Firefox** - Embedded viewer supported
- **Safari** - May show fallback link depending on version

---

## Technical Details

### Architecture

**Modular Design**
The application uses 10 separate JavaScript modules for maintainability:

- `boot.js` - Application initialization and configuration loading
- `core.js` - Global state management, logging, redraw scheduling
- `canvas-renderer.js` - All canvas drawing and rendering logic
- `validation.js` - UTC plan validation rules and error checking
- `plan-computation.js` - Adjusted plan calculations and timing
- `ui-handlers.js` - Modal dialogs, tab panels, form inputs
- `file-io.js` - Save/load file operations
- `interactions.js` - Pan, zoom, drag gesture handling
- `tab-manager.js` - Master tab switching logic
- `config.js` - Configuration file loading

**No Dependencies**
Pure JavaScript application - no frameworks or libraries required

### Display Technology

**HiDPI/Retina Support**
- Canvas automatically renders at 2× resolution on retina displays
- Ensures crisp, sharp diagrams on modern screens
- Device pixel ratio detection maintains quality

**Canvas Rendering**
- HTML5 Canvas 2D API for diagram rendering
- Separate label and timeline canvases for performance
- Viewport-based rendering for large timelines

### Browser Requirements

**Minimum Requirements:**
- ES6+ JavaScript support
- Canvas 2D API
- CSS Grid and Flexbox
- Local file system access (for file://)

**Recommended Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Known Limitations:**
- **Clipboard API** - Requires HTTPS or localhost for direct clipboard access
  - On `file://` protocol, Copy button downloads PNG instead
  - This is a browser security restriction, not an app limitation

### File Format Details

**TD2 File Structure**
Human-readable JSON format with:
- Comments for readability
- Structured sections (main, junctions, overlays, adjustments)
- Version metadata for compatibility
- Timestamp for tracking

**Configuration File**
`init.config.json` contains default settings:
- Main cycle time defaults
- Junction count defaults
- Stage and intergreen defaults
- Plot appearance settings
- Overlay behavior defaults

---

## Credits

Built by **David Key** with assistance from **OpenAI**.
October 2025 final release version **2.6.1**

### Technology Stack

- Pure JavaScript (ES6+)
- HTML5 Canvas API
- CSS3 Grid/Flexbox
- No external dependencies

### License

MIT License - See project repository for details

---

## Additional Notes

### Keyboard Shortcuts

- **Escape** - Close open modal dialogs

### Touch Support

- **Pinch** - Zoom in/out on diagram
- **Drag** - Pan timeline
- All buttons and controls work with touch

### Performance

- Viewport-based rendering for smooth performance
- Debounced redraw scheduling
- Efficient canvas compositing

### Troubleshooting

**Diagram not updating after Validate:**
- Check Debug log for errors
- Ensure all required fields are filled
- Verify intergreen matrix has no conflicts

**Copy button downloads file instead of copying:**
- This is normal on `file://` protocol
- Use HTTPS/localhost for direct clipboard access
- Downloaded PNG has same quality

**Modal won't open:**
- Check browser console for JavaScript errors
- Refresh page and try again
- Ensure browser is up to date

**PDF manual won't display:**
- Click "Open in new tab" fallback link
- Check browser PDF plugin settings
- Try different browser

---

*End of User Manual*
