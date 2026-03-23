## ADDED Requirements

### Requirement: Inline layout panel injection
The system SHALL inject a floating layout settings panel into the YouTube video page when the blocker is active. The panel SHALL be created as DOM elements within the content script context, attached relative to the `#movie_player` element.

#### Scenario: Panel is available when blocker is enabled
- **WHEN** the blocker is enabled on a YouTube watch page
- **THEN** a small gear icon button (⚙️) SHALL appear at the top-right corner of the video player area

#### Scenario: Panel is not shown on non-watch pages
- **WHEN** the user is on a YouTube page that is not a watch page (e.g., homepage, search)
- **THEN** no gear icon or layout panel SHALL be injected

### Requirement: Panel open and close
The panel SHALL support opening and closing via two entry points: the gear icon on the video page and a message from the popup.

#### Scenario: Open panel via gear icon
- **WHEN** the user clicks the gear icon (⚙️) on the video player
- **THEN** the floating layout panel SHALL appear in expanded state, positioned at the top-right area of the video player

#### Scenario: Open panel via popup button
- **WHEN** the user clicks the "📐 開啟版面設定" button in the popup
- **THEN** the content script SHALL receive a `showLayoutPanel` message and display the panel in expanded state

#### Scenario: Close panel
- **WHEN** the user clicks the close button (✕) on the panel header
- **THEN** the panel SHALL be hidden and only the gear icon remains visible

### Requirement: Panel contains all layout sliders
The panel SHALL contain the same 9 layout configuration sliders that currently exist in the popup: `containerTop`, `containerHeight`, `containerWidth`, `containerLeftOffset`, `containerRightOffset`, `voteButtonTop`, `identityWidthRatio`, `messageFlexRatio`, `voteFlexRatio`.

#### Scenario: Sliders reflect current saved config
- **WHEN** the panel is opened
- **THEN** all slider values SHALL reflect the current `layoutConfig` values loaded from `chrome.storage.sync`

#### Scenario: Slider adjustment applies immediately
- **WHEN** the user drags any layout slider in the panel
- **THEN** the blocker panels on the video SHALL update in real-time (on `input` event) without requiring the user to release the slider

#### Scenario: Slider value is persisted on release
- **WHEN** the user releases a slider after dragging
- **THEN** the new value SHALL be saved to `chrome.storage.sync` under `werewolfLayoutConfig`

### Requirement: Edit mode toggle in panel
The panel SHALL include an edit mode toggle button that controls the visual debug overlay on blocker panels.

#### Scenario: Enable edit mode from panel
- **WHEN** the user clicks "🔧 開啟編輯模式" in the floating panel
- **THEN** the blocker panels SHALL display color-coded semi-transparent overlays (red=identity, green=message, blue=vote, yellow dashed=panel boundaries)

#### Scenario: Disable edit mode from panel
- **WHEN** the user clicks "🔧 關閉編輯模式" in the floating panel while edit mode is active
- **THEN** the color-coded overlays SHALL be removed and blocker panels return to normal display

### Requirement: Reset to defaults
The panel SHALL include a reset button that restores all layout values to defaults.

#### Scenario: Reset layout config
- **WHEN** the user clicks "🔄 恢復預設值" in the floating panel
- **THEN** all 9 layout values SHALL revert to their defaults, sliders SHALL update to reflect default values, blocker panels SHALL immediately redraw with default positioning, and the defaults SHALL be saved to `chrome.storage.sync`

### Requirement: Panel draggable positioning
The panel SHALL be draggable by its header/title bar so users can reposition it to avoid obscuring important video content.

#### Scenario: Drag panel to new position
- **WHEN** the user clicks and drags the panel header
- **THEN** the panel SHALL follow the cursor and reposition accordingly within the viewport

#### Scenario: Panel stays within viewport
- **WHEN** the user drags the panel toward the edge of the viewport
- **THEN** the panel SHALL be constrained to remain fully visible within the viewport bounds

### Requirement: Panel collapse and expand
The panel SHALL support a minimized (collapsed) state showing only the title bar.

#### Scenario: Collapse panel
- **WHEN** the user clicks the minimize button (▼) on the panel header
- **THEN** the panel body (sliders, buttons) SHALL be hidden, leaving only the title bar visible

#### Scenario: Expand collapsed panel
- **WHEN** the user clicks the expand button (▲) on a collapsed panel
- **THEN** the panel body SHALL be revealed with all sliders and controls

### Requirement: Fullscreen compatibility
The panel SHALL remain functional when the video enters fullscreen mode.

#### Scenario: Enter fullscreen with panel open
- **WHEN** the video enters fullscreen mode while the layout panel is open
- **THEN** the panel SHALL remain visible and functional within the fullscreen view

#### Scenario: Exit fullscreen with panel open
- **WHEN** the video exits fullscreen mode while the layout panel is open
- **THEN** the panel SHALL remain visible and functional in the normal view

### Requirement: Style isolation
The panel's CSS SHALL NOT be affected by YouTube's page styles, and SHALL NOT affect YouTube's existing elements.

#### Scenario: Panel renders correctly despite YouTube CSS
- **WHEN** the panel is injected into a YouTube page
- **THEN** all panel elements SHALL render with the intended styling using `wlp-` prefixed CSS classes and an `all: initial` reset on the root container
