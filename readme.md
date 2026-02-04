# Light Groups Manager

Light Groups Manager is a Foundry VTT v12 module that lets GMs organize Ambient Lights into named groups and edit each group in one place.

## Features

- Add a **Light Group** field directly in Ambient Light configuration.
- Open a **Manage Light Groups** button from the Lighting controls toolbar.
- Apply group-wide settings to all lights in a group:
  - Enabled / disabled
  - Light color
  - Color intensity (`alpha`)
  - Animation type
  - Animation speed
  - Reverse animation direction
  - Animation intensity
  - Is Darkness Source
  - Provides visibility
- Animation type options update immediately when toggling **Is Darkness Source** (no window reopen required).

## Installation

1. Copy the module folder to:
   `FoundryVTT/Data/modules/light-groups-manager/`
2. Restart Foundry VTT.
3. Enable **Light Groups Manager** in your world module settings.

Expected structure:

```
light-groups-manager/
├── module.json
├── scripts/
│   └── main.js
├── templates/
│   └── group-manager.html
├── styles/
│   ├── style.css
│   └── styles.css
└── lang/
    └── en.json
```

## Usage

### 1) Assign lights to groups

1. Select an Ambient Light on the scene.
2. Open its configuration.
3. Enter a group name in **Light Group** (for example: `torches`, `streetlights`, `windows`).
4. Save.

### 2) Manage group settings

1. Select the **Lighting** controls on the left toolbar.
2. Click **Manage Light Groups** (layer-group icon).
3. Edit a group and click **Save Changes**.

## Notes

- Designed for Foundry VTT v12.
- GM-only workflow (button appears for GMs).

## License

Free to use for personal projects.
