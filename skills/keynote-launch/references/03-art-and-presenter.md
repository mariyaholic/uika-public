# 03 — Art, footage and the presenter

## What carries the picture in a launch
1. **The product**: a hero render on seamless, a macro glide, or a silhouette on a horizon glow
   (Huawei qe5dJCRWifo: graphic share 0.8, all black-void macro).
2. **People using it**: documentary b-roll with handheld energy (Apple M5 library and lab, Microsoft customer
   films).
3. **The presenter**: on a stage in front of an LED (Jobs, Lei Jun, Rivian), keyed on an LED colour field
   (Stripe purple, Xiaomi), or walking through a real place (WWDC25 at Apple Park).
4. **Screen captures**: UI as the hero (Linear 9Q5BoiIFBiY, Raycast). The UI sits on a soft gradient or inside
   a device frame, never as a raw desktop.

## Sources we may use (rights first)
- **Our own renders and footage**: kit drawings, Blender (installed under
  `<TOOLING_DIR>/blender`), and screen recordings of our own apps run headless.
- **Openly licensed photos**: `stage-photos/` in the library has 120 curated Commons images with the licence
  per row. Attribute when a licence requires it.
- **Generated b-roll stand-ins**: `broll()` light blobs. These are honest placeholders, labelled as such in the
  brief.
- **Never** use frames, footage, logos or presenters from the reference library, which is study-only.

## Presenter options
- **No presenter (default)**: a narrator voice over graphics and b-roll. Most produced launch films work this
  way.
- **Illustrated presenter**: reuse the PC-98 pack's `presenter.py` approach (real art → sprite with stepped
  blink and lip flaps) only when the video is in the PC-98 look. In the launch look, use a clean cut-out
  portrait in a capsule window, held still.
- **Keyed presenter on a field**: if real footage of a person exists (owner-provided, with consent), key it onto a
  `field` colour and cut between mid shot and close-up every 5–8 s (Stripe, Xiaomi).

## Device frames and UI
- Draw devices as rounded rectangles (radius ≈ 0.18 x width) with an inner screen inset of 30 px, plus a contact
  shadow (template `_device`).
- UI shots: render the real UI headless at 2x and downscale. Show one action per shot. Use the dim-to-grey beat
  between UI states (Linear: the whole UI greys, then the next state brightens), and use a spinner → check beat
  for completion.

## Footage-feel rules
- Every b-roll shot gets one motion: a slow push (1.02 → 1.08 scale over the shot) or a lateral drift. Never
  hold footage-like frames dead still.
- Successive shots keep the camera's direction of travel (DJI momentum cuts).
- Captions over footage always sit on a scrim; never put white type on mid-grey footage without one.
