# UX/UI Glassmorphism Redesign — Tab Collection Extension

## Overview

Comprehensive redesign of the Tab Collection Chrome Extension with glassmorphism style, new color palette, enhanced dark mode, subtle animations, and full responsive support — while keeping vanilla JS and refactoring HTML + CSS in sync.

## Design System

### Color Palette

**Light mode:**
- Background: subtle gradient (white → cool light gray) or user's custom background image
- Glass card: `background: rgba(255, 255, 255, 0.25)`, `backdrop-filter: blur(20px)`, `border: 1px solid rgba(255, 255, 255, 0.3)`
- Text primary: `#1a1a2e`, secondary: `#4a4a6a`

**Dark mode:**
- Background: gradient (#0a0a1a → #1a1a2e)
- Glass card: `background: rgba(255, 255, 255, 0.08)`, `backdrop-filter: blur(20px)`, border lighter
- Text: white → light gray scale

**Accent palette (10 colors, gradient variants):**
- Blue: `#4285f4` → `#5a9cff`
- Red: `#ea4335` → `#ff5a4a`
- Yellow: `#fbbc04` → `#ffd54f`
- Green: `#34a853` → `#4caf50`
- Orange: `#ff6d01` → `#ff8a3c`
- Teal: `#46bdc6` → `#5dd5df`
- Purple: `#7b1fa2` → `#9c27b0`
- Pink: `#e91e63` → `#f06292`
- Brown: `#795548` → `#8d6e63`
- Gray: `#607d8b` → `#78909c`

**Typography:** System font stack, scale 12/14/16/20/24/32px
**Spacing:** 4px base → 4/8/12/16/20/24/32/48px

### New Tab Page

- Header: glass sticky bar with logo + actions (New Collection, Export, Import, Customize)
- Group cards: CSS Grid `repeat(auto-fill, minmax(320px, 1fr))`, gap 20px
- Card: glassmorphism with gradient color bar, hover scale(1.02), smooth expand/collapse
- Responsive: 3-4 cols desktop, 2 cols tablet (<1024px), 1 col mobile (<640px)

### Popup

- Width 400px, max-height 500px with scroll
- Glass header, glass tab rows, glass dropdown, glass buttons
- Custom checkboxes with smooth animation
- Inline new group form with glass style

### Animations (Subtle)

- Card appear: fadeIn + translateY, staggered 50ms
- Expand/collapse: max-height 300ms ease, chevron rotate 180deg
- Hover: scale(1.02) 200ms
- Modal: fadeIn 200ms + scale(0.95→1) 250ms
- Status bar: slide down, 3s auto-dismiss
- Dark/light: background transition 300ms

### File Structure

```
styles/
├── variables.css        # CSS custom properties
├── reset.css            # CSS reset + base
├── glass.css            # Glassmorphism utilities
├── components.css       # Shared components
├── animations.css       # Keyframes + transitions
└── responsive.css       # Media queries
popup/
├── popup.html           # Refactored HTML (BEM classes)
├── popup.css            # Popup-specific styles
└── popup.js             # Same logic, updated class names
newtab/
├── newtab.html          # Refactored HTML
├── newtab.css           # Newtab-specific styles
└── newtab.js            # Same logic, updated class names
```
