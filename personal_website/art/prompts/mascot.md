# The character in the cottage

Source: the owner's request to replace the About Me frame with a character of himself who waves.
Refs, in this order:
1. art/approved/about.raw.jpg (the room he stands in: style and scale)
2. art/raw/_refs/me.png (the owner's photo, which he supplied for this on 2026-11-25; it is kept in
   art/raw/, which is git-ignored, so the photo itself is never committed)

The photo shows him from the chest up, so the legs and shoes are described in words.
The sheet is cut into frames by art/scripts/mascot-cut.mjs: poses are found as separate shapes on
the magenta background, left to right.

  node art/scripts/generate.mjs --name mascot --prompt art/prompts/mascot.md --ref art/approved/about.raw.jpg --ref art/raw/_refs/me.png --n 3 --chroma-key

---PROMPT---
A sprite sheet of one game character for the room shown in the first attached image. Match that image's art style exactly: the same chunky pixel-art look, the same flat colors with simple shading, the same dark outlines, as if he were drawn by the same artist to stand in that room.

The character is the man in the second attached image, drawn as a cute game character that is clearly recognizable as him: an Asian man with the same face shape, the same short black hair with a slightly tousled fringe over the forehead, the same dark eyes and eyebrows. He wears the same dark navy winter parka as in the photo, zipped up, with its light tan fur-trimmed hood down and resting around his shoulders, plus plain blue jeans and white sneakers. No logos, patches, badges or text anywhere on his clothes.

Cute role-playing-game proportions: a slightly large head, about two and a half heads tall. He faces the viewer, seen from the same slightly raised angle as the room. A small friendly smile.

Draw exactly three poses of this same character in one row, left to right, evenly spaced, with clear empty space between them. All three are the same size, stand at the same height on the same baseline, and are identical in every detail except one arm:
1. Left: standing relaxed, both arms down at his sides.
2. Middle: the same pose, but one arm raised with the open hand beside his head, waving hello.
3. Right: the same as the middle pose, but the raised hand tilted outward, away from his head, as the next moment of the wave.

Each pose shows the whole body from the top of the hair to the soles of the shoes. No shadows on the ground. No props.

The background is one flat, solid, pure magenta (#FF00FF) everywhere, with nothing else on it: no floor, no room, no frame, no text, no labels, no numbers.
