# Analyze UI Design

You will analyze a picture with a grid overlay. The grid overlay has 8px spacing between each line with each line 1px wide. this setup serves as a measurement reference for precisely determining element sizes, padding, and margins.

This structured process helps accurately analyze UI designs to produce detailed specifications. The output serves as a comprehensive reference for implementing the design using HTML/CSS/JS.

**IMPORTANT: every element of the design must go through the each sections and collect their information**

## Step 2: Extract Measurements from the Screenshot

* **Spacing & Sizes**

* **Accurately measure** each element's width, height, margins, paddings, and gaps between elements.
* **Grid-Based Measurement System**:
  * **Base Grid**: Each grid line is spaced exactly 8px apart
  * **Precise Measurements**: Report exact pixel values (e.g., "37px" not "~40px")
  * **Off-Grid Elements**: For elements not aligned to grid (like 13px or 27px), report exact measurements
  * **Fine Details**: Pay special attention to 1px elements (borders, dividers, hairlines)
  * **Measurement Method**: Use region_*.png files or image analysis tools (ImageMagick) for pixel-perfect accuracy
* For exact pixel colors and distances, use ImageMagick commands:
  ```bash
  convert input.png -crop WIDTHxHEIGHT+X+Y output.png
  identify -verbose input.png | grep -i color
  ```
* **Always specify units** (px, rem, %) for all measurements.
* **Organize measurements hierarchically** in the JSON output, grouping related elements together.

* **Borders & Shadows**

  * Measure border thickness, color, radius.
  * Extract shadow properties (offset X, offset Y, blur radius, spread, color).

* **Icons & Images**

  * Measure size (px × px).
  * Note if scaling, cropping, or aspect-ratio preservation is needed.

Provide all extracted values in a **structured format (JSON or table)** for the LLM to reference.

## Step 3: Analyze UI Design

Please analyze and generate a **detailed and structured description** suitable for AI code generation.

**IMPORTANT: The project uses Ant Design v5 as the UI framework**

### 📐 Layout

* Describe the **global container layout** (header, sidebar, content, footer, modal, ets.).
* Break down **local layouts for every component** (inside cards, forms, buttons, etc.).
* Use **flex layouts** for component arrangements and simple UI patterns
* Use **grid layouts** for complex page structures and responsive designs
* Specify **alignment** (horizontal/vertical, left/center/right, top/bottom, justify/space-between).
* Include **spacing** (margin, padding, gap) for **every element**, even tiny ones (icons, tooltips).
* Describe **relative positioning** (e.g., icon before label, badge top-right corner of avatar).
* If layout is unclear, give an **approximate but explicit guess**.
* Require px/% units for all sizes, spacing, and line heights.

### Container

* Describe all containers, including global and nested ones.
* Include container types: main layout container, modals, cards, forms, panels, sections, wrappers, etc.
* Specify size, spacing, margin, padding, alignment (horizontal/vertical, top/bottom, left/right, justify, space-between).
* Include borders, shadows, radius, background colors, gradients, opacity.
* Note relative positioning: nested containers, sticky/fixed behavior, overlays.
* Explicitly state framework matching vs override/custom for each container.
* Treat containers as the top-level hierarchy; all children should be nested under their container.

### 🧩 Components

* List **all UI elements**, using framework terminology (e.g.,Button, Table, Form.Item, Card).
* Must include **micro-elements** (Critical Rule):

  * Icons (standalone or inside inputs/buttons). if the target icon is not include in the ui framework, then leave a placeholder
  * Badges (with exact placement).
  * Dividers, separators, progress indicators.
  * Helper text (error, success, description lines).
  * Close buttons, dropdown arrows, toggle switches.
  * Tooltips, popovers, small labels.

* **Small Parts Display Rule (Critical Rule):**

  * Always describe how small parts are **displayed** (placement, alignment, size, color, spacing).
  * Never skip them, even if subtle.
  * If visibility is uncertain, state approximation instead of omitting.

* **Small Parts Display Rule (Critical Rule):**

  * Always describe how small parts are **displayed** (placement, alignment, size, color, spacing).
  * Never skip them, even if subtle.
  * If visibility is uncertain, state approximation instead of omitting.

* **Framework Matching Rule (Critical Rule):** Compare the design's style with the framework's default style(Ant Design v5). Decide whether to:
  * if component similarity to Ant Design is 100% , Use the framework component as-is.
  * if component similarity to Ant Design is ≥70%, Use the framework component with style overrides (list which styles differ and how).
  * if component similarity to Ant Design is <70%. Use a custom component if the framework doesn't provide a close match.

### 📝 Text & Labels

* Record **all visible text**: titles, subtitles, labels, placeholders, tooltips, button text, helper/error messages.
* Always include **typography details**:

  * Font family (if identifiable), size, weight, line height, letter spacing.
  * **Font color in HEX or RGBA** (Critical Rule).
  * Background color in HEX or RGBA
  * Styling (italic, underline, uppercase).
* Describe **alignment & placement** relative to parent/children.

### 🎨 Colors & Styles

* **Text Colors:** Always specify exact HEX/RGBA values.
* **Backgrounds:** Flat or gradient with full details.
* **Gradients (Critical Rule):**

  * Always check for gradients.
  * Do not use pure color to replace complex gradients!
  * Provide **exact code** (including angle, stops, colors).
* Borders: thickness, color, style, radius.
* Shadows: blur, offset, spread, color.
* Opacity/transparency.
* ⚠ **Framework Matching vs Override:**

  * Explicitly call out when the design's style differs from framework defaults.
  * Suggest whether to override the framework style or build a custom version.

### Image & Icon Handling

* **Icon Identification:** List every single icon you see, describing its purpose and appearance.
* **AntD Icon Match:** For each icon, state the closest matching Ant Design Icon component name (e.g., `SearchOutlined`, `DownOutlined`). If no match exists, provide a simple colored `<div>` as a placeholder.
* If an icon **does not exist** in the Ant Design set, you must provide a **placeholder**.
  * **Option 1 (Best):** Take a screenshot of *just the icon* from the design and provide the image file (e.g., `.png`, `.svg`) to the developer.
  * **Option 2 (Fallback):** Describe the icon in extreme detail so the LLM can create a placeholder.
* **Specify Properties:** Note the icon's size (e.g., `fontSize: 16px`) and color (HEX) as it appears in the design.

### ⚡ Interactions & States

* Document hover, active, focus, disabled, and loading states.
* Small visual changes (e.g., icon color shift, underline on hover, button shadow).
* Transitions: type, duration, easing (fade, slide, ripple).
* Validation/error messages: colors, icons, placement.

### 📊 Hierarchy & Positioning

* Explicitly note **parent → child nesting**.
* Include **micro-layouts** like:

  * Icon placement in inputs/buttons.
  * Badge overlay positions.
  * Divider spacing inside cards.
* Clarify sticky/fixed positioning if applicable.

### 🚨 Exhaustiveness Rule

* Do **not skip small elements** (icons, labels, helper texts, dividers, badges, tooltips).
* Do **not skip text color** — always capture it.
* Do **not skip container borders or shadows**.
* If details are uncertain, provide **best approximation with a note**.
* Treat **global + micro details** as equally mandatory.
* Always identify if the UI **matches framework defaults** or **requires style overrides/custom implementation**.
* For each complex style, provide:
  1. A brief description of what the code accomplishes
  2. The actual style code snippet
