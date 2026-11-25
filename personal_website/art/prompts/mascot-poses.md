# Character sheet: three poses of the approved design

The design (face, hair, parka) comes from art/raw/_refs/mascot-design.png: the standing pose of the
sheet drawn from the owner's photo (art/prompts/mascot.md). This prompt redraws the three poses from
that design so both wave poses raise the same arm; the photo itself is not sent again.

  node art/scripts/generate.mjs --name mascot --prompt art/prompts/mascot-poses.md --ref art/raw/_refs/mascot-design.png --n 4 --chroma-key

---PROMPT---
The attached image shows one pixel-art game character standing on a magenta background. Draw a sprite sheet of exactly this character: the same face, the same black tousled hair, the same dark navy parka with the tan fur-trimmed hood, the same blue jeans and white sneakers, the same proportions, colors, outlines and pixel-art style. He faces the viewer in every pose.

Three poses in one row, left to right, evenly spaced, with clear empty magenta between them. All three are the same size and stand on the same baseline.

In all three poses, the arm on the LEFT side of the picture hangs straight down at his side and never moves.

1. Left pose: standing relaxed, both arms down at his sides, exactly as in the attached image.
2. Middle pose: the arm on the RIGHT side of the picture is raised, with the open hand up beside his head, waving hello.
3. Right pose: the same arm, the one on the RIGHT side of the picture, is still raised, but the open hand is tilted outward to the right, away from his head and a little lower: the next moment of the same wave.

Each pose shows the whole body from the top of the hair to the soles of the shoes. No shadows on the ground. No props. No logos or text on the clothes.

The background is one flat, solid, pure magenta (#FF00FF) everywhere, with nothing else on it.
