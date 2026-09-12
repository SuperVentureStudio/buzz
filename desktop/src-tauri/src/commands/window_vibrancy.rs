//! Runtime macOS window vibrancy (blur-behind) toggle — the glass fallback.
//!
//! `window_glass::set_window_glass` is the default path. This one runs only
//! when the private WindowServer blur symbol is unavailable, because an
//! `NSVisualEffectView` material carries a fixed tint that CSS cannot lift.
//!
//! The main window is transparent from creation so macOS can composite its
//! material behind SVS's outer chrome. Glass-off CSS paints the full web
//! surface opaque; wry's `drawsBackground` flag is one-way at runtime, so the
//! CSS layer is the intentional opaque fallback rather than NSWindow opacity.
//!
//! Vibrancy applies an `NSVisualEffectView` behind the webview so the desktop
//! (and windows behind SVS) blurs through wherever the WKWebView canvas is
//! transparent. It is a native, macOS-only effect: there is no "intensity"
//! setting at the OS level, only a set of material presets. The frontend tunes
//! perceived intensity by adjusting CSS surface opacity while this command
//! handles the native material. On non-macOS platforms the command is a no-op
//! so the shared frontend can call it unconditionally.

#[cfg(target_os = "macos")]
use tauri::Manager;

/// Apply or clear macOS window vibrancy for the main window.
///
/// `material` accepts the common `NSVisualEffectMaterial` names
/// (`sidebar`, `hud-window`, `under-window-background`, `fullscreen-ui`,
/// `header-view`, `popover`, `menu`, `titlebar`). Unknown values fall back to
/// `sidebar`.
#[tauri::command]
pub fn set_window_vibrancy(
    #[allow(unused_variables)] enabled: bool,
    #[allow(unused_variables)] material: Option<String>,
    #[allow(unused_variables)] app_handle: tauri::AppHandle,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{
            apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial, NSVisualEffectState,
        };

        let window = app_handle
            .get_webview_window("main")
            .ok_or_else(|| "main window not found".to_string())?;

        if !enabled {
            // Do not reset the transparent NSWindow or WebKit canvas here.
            // After a glass session the canvas may remain non-drawing, but
            // glass-off CSS deliberately covers it with opaque surfaces.
            clear_vibrancy(&window).map_err(|e| e.to_string())?;
            return Ok(());
        }

        let material = match material.as_deref() {
            Some("hud-window") => NSVisualEffectMaterial::HudWindow,
            Some("under-window-background") => NSVisualEffectMaterial::UnderWindowBackground,
            Some("fullscreen-ui") => NSVisualEffectMaterial::FullScreenUI,
            Some("header-view") => NSVisualEffectMaterial::HeaderView,
            Some("popover") => NSVisualEffectMaterial::Popover,
            Some("menu") => NSVisualEffectMaterial::Menu,
            Some("titlebar") => NSVisualEffectMaterial::Titlebar,
            _ => NSVisualEffectMaterial::Sidebar,
        };

        // `apply_vibrancy` appends a new tagged `NSVisualEffectView` each call,
        // while `clear_vibrancy` only removes one. Repeated enables (theme
        // switches, follow-system flips) would otherwise stack blur views and
        // leave a stale one behind on the next non-SVS theme. Clear any
        // existing view first so exactly one material is ever installed. The
        // clear is a no-op (returns `false`) when none is present.
        let _ = clear_vibrancy(&window);

        // Install the blur layer first: a failure of the canvas write leaves
        // the window with vibrancy behind an opaque webview, not a see-through
        // one. Either mixed state self-corrects on the next toggle.
        apply_vibrancy(&window, material, Some(NSVisualEffectState::Active), None)
            .map_err(|e| e.to_string())?;

        // Make only the WKWebView canvas transparent so native vibrancy shows
        // through. Targeting the
        // webview layer directly (via `AsRef<Webview>`) avoids the
        // `WebviewWindow::set_background_color` path, which also writes the
        // NSWindow layer. Must follow `apply_vibrancy` so the blur layer is
        // present before the canvas becomes see-through.
        let webview: &tauri::Webview<_> = window.as_ref();
        webview
            .set_background_color(Some(tauri::window::Color(0, 0, 0, 0)))
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}
