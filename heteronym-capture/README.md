# heteronym-capture

A single-file, zero-dependency web applet for the **Heteronym** project. It records one guided
take of your face — every angle, several expressions — and exports the raw video plus a curated
set of sharp still frames. That frame set is the reference material for building the baseline
"mes": AI likenesses that actually look like you, before any persona gets layered on top
(video generation via Higgsfield or similar).

Everything runs in your browser. **Nothing is uploaded anywhere.** The video and frames exist
only on your machine until you deliberately hand them to a generation tool.

## Use it

1. Open `index.html` in Chrome (double-click usually works). If the browser refuses camera
   access from a `file://` page, serve it locally instead:

   ```
   cd heteronym-capture
   python3 -m http.server
   ```

   then open <http://localhost:8000>.

2. **Enable camera**, pick the right one if you have several, and **Begin capture**.
3. Follow the on-screen prompts (~80 seconds total): straight ahead, slow turn to each full
   profile, chin up/down, a head roll, slight and full smiles, talking, distance change, and a
   neutral bookend. **Move slowly** — slow movement is what makes every angle land as a sharp frame.
4. Review: blurry frames are auto-deselected (dimmed); click any thumbnail to toggle.
5. Download the selected frames as a `.zip` and the full take as a `.webm`.

## Getting a likeness that's actually *you*

- **Light:** face a window or soft lamp. Even, diffuse light; no hard side shadow, no backlight.
- **Background:** plain wall. The model should learn your face, not your bookshelf.
- **Framing:** camera at eye level, face filling about two-thirds of the frame.
- **Baseline first:** hair off the face, glasses off, neutral-ish or no makeup. If glasses or a
  particular hair situation is also canonically "you," record a second take that way — takes are
  cheap.
- **Curate for variety, not volume.** 40–80 frames with clean coverage of every yaw/pitch angle
  and each expression beat 200 near-duplicates of one flattering angle. Keep some genuinely
  neutral frames; generators drift toward whatever expression dominates the reference set.
- **Multiple sessions help:** a second take in different clothing/lighting on another day makes
  the likeness more robust and less tied to one moment.

## Files you get

| File | What it is |
|---|---|
| `YYYY-MM-DD-HH-mm_frames.zip` | The selected still frames (`frame_0000.jpg` …), full camera resolution |
| `YYYY-MM-DD-HH-mm_take.webm` | The complete continuous video of the take |

## Notes

- Frames are grabbed at ~3/sec at the camera's native resolution (targets 1080p).
- Sharpness scoring is variance-of-Laplacian; the auto-deselect threshold is relative to the
  take's own median, so it adapts to your camera.
- The zip writer is built in (store-only — JPEGs are already compressed). No CDNs, no libraries,
  no network access at all.
