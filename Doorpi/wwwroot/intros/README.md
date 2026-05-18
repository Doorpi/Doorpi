# Doorpi Intro Packages

Doorpi intros are self-contained packages loaded at boot before the real user picker or setup screen.

## Built-in intros

Built-in intros live in:

```text
wwwroot/intros/<intro-id>/
```

The active built-in intro is selected by:

```text
wwwroot/intros/active-intro.json
```

## Installed intros

Community/store intros should be installed in the runtime data folder:

```text
Data/intros/<intro-id>/
```

The active installed intro is selected by:

```text
Data/intros/active.json
```

If `Data/intros/active.json` exists, it takes priority over the bundled `active-intro.json`.

## Manifest

Each package must include `manifest.json`:

```json
{
  "schemaVersion": 1,
  "id": "my-intro",
  "name": "My Intro",
  "version": "1.0.0",
  "author": "Author",
  "entry": "index.html",
  "fallbackTimeoutMs": 12000,
  "exitFadeMs": 520,
  "handoff": {
    "enabled": true,
    "ambient": "blob",
    "background": "#07071a",
    "colors": ["rgba(15,25,85,0.7)"],
    "userPicker": {
      "transparentBackdrop": true,
      "className": "my-intro-picker",
      "style": "handoff.css"
    }
  }
}
```

The `entry` file can use regular HTML, CSS, JavaScript, images, and other local assets inside the package folder.

## User Picker Handoff

The `handoff` object controls what remains on screen after the intro ends and before the user selects a real profile.

- `ambient: "blob"` keeps Doorpi's shared blob background alive.
- `ambient: "none"` or `ambient: false` disables the shared background.
- `background`, `vignette`, and `colors` configure the built-in blob.
- `userPicker.transparentBackdrop` controls whether the real user picker removes its own blurred backdrop.
- `userPicker.className` adds custom classes to the real user picker overlay.
- `userPicker.style` loads a CSS file from the intro package into the parent Doorpi screen during handoff.
- `userPicker.css` can inline CSS directly from the manifest for small tweaks.

Custom handoff CSS can target `.doorpi-user-overlay`, `.doorpi-user-panel`, `.doorpi-user-card`, `.doorpi-avatar`, and the class named in `userPicker.className`.

To skip any custom transition entirely:

```json
{
  "handoff": {
    "enabled": false
  }
}
```

## Runtime Events

The intro entry should notify the host with `postMessage`:

```js
window.parent.postMessage({
  type: 'doorpi:intro:handoff',
  handoff: {
    ambient: 'blob',
    colors: [],
    userPicker: {
      className: 'my-intro-picker',
      style: 'handoff.css'
    }
  }
}, '*');
window.parent.postMessage({ type: 'doorpi:intro:complete' }, '*');
```

If the intro does not send `doorpi:intro:complete`, Doorpi continues after `fallbackTimeoutMs`.
