# Mapa dos módulos JavaScript

A ordem abaixo é a ordem de concatenação em cada bundle. Os fragmentos conservam os escopos originais; não são módulos ES nem scripts para carregar separadamente.

## wwwroot/app.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/app/010-state-and-display.js](scripts/app/010-state-and-display.js) | 0 |
| [scripts/app/020-first-run-tutorial.js](scripts/app/020-first-run-tutorial.js) | 1 |
| [scripts/app/030-library-update-queue.js](scripts/app/030-library-update-queue.js) | 0 |
| [scripts/app/040-audio-and-focus.js](scripts/app/040-audio-and-focus.js) | 0 |
| [scripts/app/050-runtime-sessions.js](scripts/app/050-runtime-sessions.js) | 0 |
| [scripts/app/060-session-conflicts.js](scripts/app/060-session-conflicts.js) | 1 |
| [scripts/app/070-game-focus-recovery.js](scripts/app/070-game-focus-recovery.js) | 1 |
| [scripts/app/080-intro-and-platforms.js](scripts/app/080-intro-and-platforms.js) | 0 |
| [scripts/app/090-web-fixes-and-top-profile.js](scripts/app/090-web-fixes-and-top-profile.js) | 2 |
| [scripts/app/100-notifications.js](scripts/app/100-notifications.js) | 1 |
| [scripts/app/110-update-prompt.js](scripts/app/110-update-prompt.js) | 1 |
| [scripts/app/120-clock-fallbacks-and-host-messages.js](scripts/app/120-clock-fallbacks-and-host-messages.js) | 0 |
| [scripts/app/130-global-focus-and-profile-overlays.js](scripts/app/130-global-focus-and-profile-overlays.js) | 1 |
| [scripts/app/140-user-picker.js](scripts/app/140-user-picker.js) | 0 |
| [scripts/app/150-quick-panel-state-and-helpers.js](scripts/app/150-quick-panel-state-and-helpers.js) | 1 |
| [scripts/app/151-quick-panel-storage.js](scripts/app/151-quick-panel-storage.js) | 0 |
| [scripts/app/152-quick-panel-content-and-render.js](scripts/app/152-quick-panel-content-and-render.js) | 0 |
| [scripts/app/153-quick-panel-incremental-updates.js](scripts/app/153-quick-panel-incremental-updates.js) | 0 |
| [scripts/app/154-quick-panel-event-wiring.js](scripts/app/154-quick-panel-event-wiring.js) | 0 |
| [scripts/app/155-quick-panel-lifecycle-and-navigation.js](scripts/app/155-quick-panel-lifecycle-and-navigation.js) | 0 |
| [scripts/app/156-quick-panel-public-api.js](scripts/app/156-quick-panel-public-api.js) | 0 |
| [scripts/app/157-extension-and-disc-dialogs.js](scripts/app/157-extension-and-disc-dialogs.js) | 0 |
| [scripts/app/158-overlay-routing-and-loading.js](scripts/app/158-overlay-routing-and-loading.js) | 0 |
| [scripts/app/159-add-dialog-and-library-filters.js](scripts/app/159-add-dialog-and-library-filters.js) | 0 |
| [scripts/app/160-modal-lifecycle-and-app-selection.js](scripts/app/160-modal-lifecycle-and-app-selection.js) | 0 |
| [scripts/app/170-folder-list.js](scripts/app/170-folder-list.js) | 0 |
| [scripts/app/180-artwork-and-hero.js](scripts/app/180-artwork-and-hero.js) | 0 |
| [scripts/app/190-auxiliary-style-installation.js](scripts/app/190-auxiliary-style-installation.js) | 1 |
| [scripts/app/200-context-menu.js](scripts/app/200-context-menu.js) | 0 |
| [scripts/app/210-item-removal.js](scripts/app/210-item-removal.js) | 0 |
| [scripts/app/220-artwork-wizard.js](scripts/app/220-artwork-wizard.js) | 0 |
| [scripts/app/230-item-editor.js](scripts/app/230-item-editor.js) | 0 |
| [scripts/app/240-virtual-keyboard.js](scripts/app/240-virtual-keyboard.js) | 0 |
| [scripts/app/250-navigation-hint.js](scripts/app/250-navigation-hint.js) | 0 |
| [scripts/app/260-ambient-background.js](scripts/app/260-ambient-background.js) | 1 |
| [scripts/app/270-session-transition.js](scripts/app/270-session-transition.js) | 0 |
| [scripts/app/280-media-app-forms.js](scripts/app/280-media-app-forms.js) | 0 |
| [scripts/app/290-launch-overlay.js](scripts/app/290-launch-overlay.js) | 1 |

## wwwroot/bluetooth-ui.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/bluetooth-ui/010-implementation.js](scripts/bluetooth-ui/010-implementation.js) | 1 |

## wwwroot/controls.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/controls/010-scope-and-translations.js](scripts/controls/010-scope-and-translations.js) | 0 |
| [scripts/controls/020-input-definitions-and-state.js](scripts/controls/020-input-definitions-and-state.js) | 0 |
| [scripts/controls/030-formatting-and-model-helpers.js](scripts/controls/030-formatting-and-model-helpers.js) | 0 |
| [scripts/controls/040-artwork-and-icons.js](scripts/controls/040-artwork-and-icons.js) | 0 |
| [scripts/controls/050-binding-presentation.js](scripts/controls/050-binding-presentation.js) | 0 |
| [scripts/controls/060-style-installation.js](scripts/controls/060-style-installation.js) | 1 |
| [scripts/controls/070-overlay-creation.js](scripts/controls/070-overlay-creation.js) | 0 |
| [scripts/controls/080-editor-lifecycle.js](scripts/controls/080-editor-lifecycle.js) | 0 |
| [scripts/controls/090-host-messages.js](scripts/controls/090-host-messages.js) | 0 |
| [scripts/controls/100-editor-rendering.js](scripts/controls/100-editor-rendering.js) | 0 |
| [scripts/controls/110-pickers-and-capture.js](scripts/controls/110-pickers-and-capture.js) | 0 |
| [scripts/controls/120-dialogs-and-feedback.js](scripts/controls/120-dialogs-and-feedback.js) | 0 |
| [scripts/controls/130-focus-helpers.js](scripts/controls/130-focus-helpers.js) | 0 |
| [scripts/controls/140-directional-navigation.js](scripts/controls/140-directional-navigation.js) | 0 |
| [scripts/controls/150-menu-integrations-and-public-api.js](scripts/controls/150-menu-integrations-and-public-api.js) | 0 |

## wwwroot/emulators.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/emulators/010-implementation.js](scripts/emulators/010-implementation.js) | 0 |

## wwwroot/file-browser.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/file-browser/010-implementation.js](scripts/file-browser/010-implementation.js) | 0 |

## wwwroot/grid-controller.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/grid-controller/010-implementation.js](scripts/grid-controller/010-implementation.js) | 1 |

## wwwroot/intro-system.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/intro-system/010-state-and-config.js](scripts/intro-system/010-state-and-config.js) | 0 |
| [scripts/intro-system/020-presentation-and-completion.js](scripts/intro-system/020-presentation-and-completion.js) | 1 |
| [scripts/intro-system/030-handoff-assets-and-ambient.js](scripts/intro-system/030-handoff-assets-and-ambient.js) | 0 |
| [scripts/intro-system/040-readiness-and-input.js](scripts/intro-system/040-readiness-and-input.js) | 0 |
| [scripts/intro-system/050-ambient-lifecycle.js](scripts/intro-system/050-ambient-lifecycle.js) | 0 |
| [scripts/intro-system/060-host-and-package-messages.js](scripts/intro-system/060-host-and-package-messages.js) | 0 |
| [scripts/intro-system/070-startup.js](scripts/intro-system/070-startup.js) | 0 |
| [scripts/intro-system/080-public-api-and-bootstrap.js](scripts/intro-system/080-public-api-and-bootstrap.js) | 0 |

## wwwroot/media.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/media/010-implementation.js](scripts/media/010-implementation.js) | 1 |

## wwwroot/nav-menu.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/nav-menu/010-scope-and-data.js](scripts/nav-menu/010-scope-and-data.js) | 0 |
| [scripts/nav-menu/020-shortcuts-and-desktop-warning.js](scripts/nav-menu/020-shortcuts-and-desktop-warning.js) | 2 |
| [scripts/nav-menu/030-lazy-grid.js](scripts/nav-menu/030-lazy-grid.js) | 0 |
| [scripts/nav-menu/040-library-filters-and-dual-pane.js](scripts/nav-menu/040-library-filters-and-dual-pane.js) | 0 |
| [scripts/nav-menu/050-system-settings-hub.js](scripts/nav-menu/050-system-settings-hub.js) | 0 |
| [scripts/nav-menu/060-storage-legacy.js](scripts/nav-menu/060-storage-legacy.js) | 1 |
| [scripts/nav-menu/070-storage-v2-legacy.js](scripts/nav-menu/070-storage-v2-legacy.js) | 1 |
| [scripts/nav-menu/080-storage-management.js](scripts/nav-menu/080-storage-management.js) | 1 |
| [scripts/nav-menu/090-video-settings.js](scripts/nav-menu/090-video-settings.js) | 1 |
| [scripts/nav-menu/100-startup-settings.js](scripts/nav-menu/100-startup-settings.js) | 0 |
| [scripts/nav-menu/110-update-settings.js](scripts/nav-menu/110-update-settings.js) | 1 |
| [scripts/nav-menu/120-ambient-helpers-and-state.js](scripts/nav-menu/120-ambient-helpers-and-state.js) | 0 |
| [scripts/nav-menu/130-style-installation.js](scripts/nav-menu/130-style-installation.js) | 1 |
| [scripts/nav-menu/140-overlay-categories-and-launch.js](scripts/nav-menu/140-overlay-categories-and-launch.js) | 0 |
| [scripts/nav-menu/150-content-routing-and-profile.js](scripts/nav-menu/150-content-routing-and-profile.js) | 1 |
| [scripts/nav-menu/160-legacy-profile.js](scripts/nav-menu/160-legacy-profile.js) | 0 |
| [scripts/nav-menu/170-profile-history.js](scripts/nav-menu/170-profile-history.js) | 0 |
| [scripts/nav-menu/180-settings-hub.js](scripts/nav-menu/180-settings-hub.js) | 0 |
| [scripts/nav-menu/185-web-permissions.js](scripts/nav-menu/185-web-permissions.js) | 1 |
| [scripts/nav-menu/190-device-settings.js](scripts/nav-menu/190-device-settings.js) | 0 |
| [scripts/nav-menu/200-windows-and-gpu-updates.js](scripts/nav-menu/200-windows-and-gpu-updates.js) | 0 |
| [scripts/nav-menu/210-account-settings.js](scripts/nav-menu/210-account-settings.js) | 1 |
| [scripts/nav-menu/220-sharing-legacy.js](scripts/nav-menu/220-sharing-legacy.js) | 1 |
| [scripts/nav-menu/230-sharing.js](scripts/nav-menu/230-sharing.js) | 1 |
| [scripts/nav-menu/240-extensions.js](scripts/nav-menu/240-extensions.js) | 1 |
| [scripts/nav-menu/250-focus-and-scrolling.js](scripts/nav-menu/250-focus-and-scrolling.js) | 0 |
| [scripts/nav-menu/260-open-and-close.js](scripts/nav-menu/260-open-and-close.js) | 0 |
| [scripts/nav-menu/270-keyboard-and-controller-navigation.js](scripts/nav-menu/270-keyboard-and-controller-navigation.js) | 0 |
| [scripts/nav-menu/280-host-message-updates.js](scripts/nav-menu/280-host-message-updates.js) | 0 |
| [scripts/nav-menu/290-context-menu-and-public-api.js](scripts/nav-menu/290-context-menu-and-public-api.js) | 0 |

## wwwroot/navigation.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/navigation/010-state-hints-and-context.js](scripts/navigation/010-state-hints-and-context.js) | 0 |
| [scripts/navigation/020-targets-and-spatial-candidates.js](scripts/navigation/020-targets-and-spatial-candidates.js) | 0 |
| [scripts/navigation/030-group-transitions.js](scripts/navigation/030-group-transitions.js) | 0 |
| [scripts/navigation/040-overlay-focus-and-actions.js](scripts/navigation/040-overlay-focus-and-actions.js) | 0 |
| [scripts/navigation/050-focus-movement.js](scripts/navigation/050-focus-movement.js) | 0 |
| [scripts/navigation/060-scrolling-and-keyboard.js](scripts/navigation/060-scrolling-and-keyboard.js) | 0 |
| [scripts/navigation/070-controller-state-and-quarantine.js](scripts/navigation/070-controller-state-and-quarantine.js) | 0 |
| [scripts/navigation/080-back-action-routing.js](scripts/navigation/080-back-action-routing.js) | 0 |
| [scripts/navigation/090-controller-button-and-direction-mapping.js](scripts/navigation/090-controller-button-and-direction-mapping.js) | 0 |
| [scripts/navigation/100-native-controller-snapshots.js](scripts/navigation/100-native-controller-snapshots.js) | 0 |
| [scripts/navigation/110-gamepad-dispatch-loop.js](scripts/navigation/110-gamepad-dispatch-loop.js) | 0 |
| [scripts/navigation/120-initial-focus-and-pointer.js](scripts/navigation/120-initial-focus-and-pointer.js) | 0 |

## wwwroot/profile-photo-picker.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/profile-photo-picker/010-implementation.js](scripts/profile-photo-picker/010-implementation.js) | 1 |

## wwwroot/profile-sync-ui.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/profile-sync-ui/010-implementation.js](scripts/profile-sync-ui/010-implementation.js) | 1 |

## wwwroot/renderer.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/renderer/010-featured-presentation.js](scripts/renderer/010-featured-presentation.js) | 0 |
| [scripts/renderer/020-card-interaction.js](scripts/renderer/020-card-interaction.js) | 0 |
| [scripts/renderer/030-transition-artwork-lifecycle.js](scripts/renderer/030-transition-artwork-lifecycle.js) | 0 |
| [scripts/renderer/040-card-renderer.js](scripts/renderer/040-card-renderer.js) | 2 |
| [scripts/renderer/050-tab-transitions.js](scripts/renderer/050-tab-transitions.js) | 1 |

## wwwroot/setup.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/setup/010-state-and-style-installation.js](scripts/setup/010-state-and-style-installation.js) | 1 |
| [scripts/setup/020-markup.js](scripts/setup/020-markup.js) | 0 |
| [scripts/setup/030-layout-and-user-form.js](scripts/setup/030-layout-and-user-form.js) | 0 |
| [scripts/setup/040-accordion-and-scrolling.js](scripts/setup/040-accordion-and-scrolling.js) | 0 |
| [scripts/setup/050-background-animation.js](scripts/setup/050-background-animation.js) | 0 |
| [scripts/setup/060-authentication-and-cloud-profile.js](scripts/setup/060-authentication-and-cloud-profile.js) | 0 |
| [scripts/setup/070-setup-lifecycle-and-focus.js](scripts/setup/070-setup-lifecycle-and-focus.js) | 0 |
| [scripts/setup/080-validation.js](scripts/setup/080-validation.js) | 0 |
| [scripts/setup/090-event-wiring.js](scripts/setup/090-event-wiring.js) | 0 |
| [scripts/setup/100-folders-and-photo-selection.js](scripts/setup/100-folders-and-photo-selection.js) | 0 |
| [scripts/setup/110-sync-messages.js](scripts/setup/110-sync-messages.js) | 0 |

## wwwroot/sound-ui.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/sound-ui/010-implementation.js](scripts/sound-ui/010-implementation.js) | 1 |

## wwwroot/store.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/store/010-implementation.js](scripts/store/010-implementation.js) | 0 |

## wwwroot/stores.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/stores/010-implementation.js](scripts/stores/010-implementation.js) | 1 |

## wwwroot/strings.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/strings/010-implementation.js](scripts/strings/010-implementation.js) | 0 |

## wwwroot/wifi-ui.js

| Fonte | CSS extraído |
| --- | --- |
| [scripts/wifi-ui/010-implementation.js](scripts/wifi-ui/010-implementation.js) | 1 |
