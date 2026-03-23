## ADDED Requirements

### Requirement: Open layout settings entry button
The popup SHALL display a prominent "📐 開啟版面設定" button that triggers the inline layout panel on the YouTube video page.

#### Scenario: Click opens layout panel on active YouTube tab
- **WHEN** the user clicks the "📐 開啟版面設定" button in the popup while a YouTube watch page is the active tab
- **THEN** the popup SHALL send a `showLayoutPanel` message to the active YouTube tab's content script

#### Scenario: Button disabled when no YouTube tab
- **WHEN** the user opens the popup without an active YouTube watch page tab
- **THEN** the "📐 開啟版面設定" button SHALL be disabled with a tooltip or subtitle indicating that a YouTube video page is required

### Requirement: Layout settings section removed from popup
The popup SHALL no longer contain the layout sliders, edit mode toggle, or reset button directly within its own UI.

#### Scenario: Popup does not display layout sliders
- **WHEN** the user opens the popup
- **THEN** no layout slider controls (containerTop, containerHeight, etc.) SHALL be visible in the popup

#### Scenario: Popup does not display edit mode toggle
- **WHEN** the user opens the popup
- **THEN** no "開啟編輯模式" button SHALL be visible in the popup

## MODIFIED Requirements

### Requirement: Popup visual hierarchy improvement
The popup SHALL have improved visual spacing and section separation after removing the layout settings block, resulting in a more focused and readable interface.

#### Scenario: Popup renders without layout section gap
- **WHEN** the user opens the popup
- **THEN** the remaining sections (status toggle, channel settings, segment settings) SHALL be displayed with consistent spacing and no visual gap where the layout section was removed

#### Scenario: Entry button is visually prominent
- **WHEN** the user views the popup
- **THEN** the "📐 開啟版面設定" entry button SHALL be styled with the primary gradient and stand out as an actionable element between channel settings and segment settings sections
