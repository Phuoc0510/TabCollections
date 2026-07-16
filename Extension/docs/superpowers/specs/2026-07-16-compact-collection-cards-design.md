# Compact Collection Cards Design

## Goal

Make the new-tab collection view denser by rendering groups as compact cards. A card expands independently when its header is activated, so multiple groups can show their saved links at once.

## Layout

- Render `#groups-grid` as a responsive CSS grid with cards at least 260px wide.
- Render one column on narrow screens.
- Keep the selected group color as the card's left accent bar.
- Keep the user-selected background image and translucent card treatment.

## Collapsed Card

Each card initially shows only:

- Group icon and name.
- Saved-tab count.
- A chevron that reflects expanded state.

The header is a keyboard-accessible button. Click, Enter, or Space toggles only that card. Opening one card does not collapse any other card.

## Expanded Card

The expanded region contains:

- Saved tab entries with favicon, title, and shortened URL.
- A clickable tab entry that opens its URL in a new browser tab.
- A delete control for each saved tab.
- Open All, Edit, and Delete collection actions.

The region opens and closes with a short CSS transition. Action clicks must not toggle the card accidentally.

## Data And Compatibility

- No changes to group or saved-tab storage schemas.
- Existing groups, colors, icons, background image settings, export, and import continue to work unchanged.

## Verification

- At desktop widths, cards flow into multiple columns; at narrow widths, they use one column.
- Multiple cards can be expanded concurrently.
- The card header is usable by mouse and keyboard.
- Opening a tab, deleting a tab, opening all tabs, editing, and deleting a group retain their current behavior.
