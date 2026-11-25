# Music

The player in the top-left corner of the site plays the MP3 files in these two folders.

| Folder | Where it plays | What belongs in it |
|---|---|---|
| `published/` | The live site and this computer | Only music you have the right to publish: your own, or tracks whose licence allows use on a website. |
| `private/` | This computer only | Anything you want to hear while working on the site. The folder is git-ignored, so it never reaches GitHub or the live site. |

## Adding a song

1. Drop the `.mp3` into one of the folders.
2. Optional: add a line for it to that folder's `playlist.json` to set its place in the order, its name and where it is from:

   ```json
   { "file": "my-song.mp3", "title": "My Song", "from": "The Artist", "credit": "CC BY 4.0, The Artist" }
   ```

   `from` shows under the title. `credit` is for licences that ask for attribution; it shows in place of `from` when given.
   A file that is not in `playlist.json` still plays, after the listed ones, named after its file (`my-song.mp3` becomes "My Song").

The dev server picks up new files on its own. The live site gets them on the next deploy.

## Order

Songs in `private/` play first, then `published/`. On the live site only `published/` exists.

## The picture

Put a square image named `logo.png` (or `.webp`, `.jpg`, `.svg`) in this folder and the player shows it in place of the note icon. It is published with the site.

## The placeholder

`published/placeholder-tune.mp3` is a short loop made by `scripts/placeholder-tune.mjs` so the live site has one free-to-use song. Delete it and its line in `playlist.json` once real songs are in.
