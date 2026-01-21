# Netflix Intro Animation (Pure CSS)

This folder contains the source code for the Netflix Intro Animation, originally created by Claudio Bonfati.
The code was retrieved from a GitHub repository that mirrors the CodePen project.

## Files

- `index.html`: The HTML structure for the animation. Currently set to animate the letter "N".
- `style.css`: The complete CSS styles, including the "fur" (brush) effects and lighting animations.
- `script.js`: Empty file (the animation is pure CSS).

## How to use

1. Open `index.html` in your browser.
2. To see other letters, edit `index.html` and change the `letter` attribute on the `<netflixintro>` tag.
   Supported letters: N, E, T, F, L, I, X.

   Example:
   ```html
   <netflixintro letter="E">
   ```

## Implementation Details

The animation uses a combination of:
- **Helpers**: Divs representing parts of the letter.
- **Fur Spans**: Multiple span elements with gradients to create the brush/fur effect.
- **Lamp Spans**: Spans for the lighting/sparkles effect.
- **CSS Keyframes**: For the movement and fading.

The `style.css` file contains all the logic. Look for `.effect-brush` and `.fur-` classes for the brush effect.
