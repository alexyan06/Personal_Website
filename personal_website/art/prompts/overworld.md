# Overworld prompt

Source: DESIGN.md §2a. Final asset is 320x180, NES palette (enforced by postprocess, not the prompt).
Location positions are fractions of the frame so the site can place labels and click areas:

| Location | Center (x, y) |
|---|---|
| Cottage (About) | 0.50, 0.50 |
| Library (Learning) | 0.22, 0.25 |
| Workshop (Projects) | 0.78, 0.25 |
| Item shop (Skills) | 0.18, 0.58 |
| Town (Experience) | 0.80, 0.58 |
| Trophy hall (Misc) | 0.50, 0.82 |

Text, labels and Alex's sprite are overlaid by the site, so the image must contain no lettering.

---PROMPT---
An original 8-bit NES-era video game overworld map, drawn as genuine low-resolution pixel art: imagine a 320x180 pixel image scaled up so every art pixel is a crisp, clearly visible square block. Hard pixel edges, flat colors from a limited NES-style palette, no anti-aliasing, no gradients, no blur, no soft lighting, no painterly texture. Shading only with flat color steps or simple dithering. Top-down three-quarter overhead view, the classic style of 1980s console role-playing game world maps, but an original world that does not copy any existing game's map, buildings, characters or tiles.

The whole frame shows one green island in a bright blue ocean on a sunny day. The island fills most of the frame with a band of ocean visible on every side, and simple repeating wave tiles in the water. Sandy beach and a few rocks along the coastline. Grass covers the island, with a handful of small trees and bushes scattered sparsely. Keep the land mostly open and calm so the buildings stand out.

Six locations sit on the island, connected by simple tan dirt paths. Each location is a distinct, chunky, easy-to-recognize silhouette with its own main color, large enough to read when the image is tiny:
1. Exact center of the frame: a small cozy wooden cottage with a red roof, a chimney with a puff of smoke, and a tiny garden. Leave a small patch of plain grass directly in front of its door. Dirt paths branch out from this cottage to each of the other five locations.
2. Upper left: a stone library, a sturdy grey building with tall arched windows and a peaked roof.
3. Upper right: an inventor's workshop, a wooden building with a large gear on its wall and a smoking chimney.
4. Left side, middle: a small item shop with a striped awning and a hanging sign with a simple potion-bottle shape on it.
5. Right side, middle: a small town of four distinct buildings clustered together: a market stall with a green awning, a white bank with columns, a brick hall with a clock tower, and a small garage with a roll-up door.
6. Bottom center: a trophy hall, a small marble building with columns and a golden trophy shape on its roof.

Leave a strip of open grass directly beneath each location so a text label can be placed there later.

Absolutely no text, letters, numbers, words, signs with writing, logos, UI, borders, frames, characters or people anywhere in the image. Just the island world.
