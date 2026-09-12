//! macOS glass: a transparent window plus WindowServer background blur.
//!
//! The previous implementation used `NSVisualEffectView` (the `window-vibrancy`
//! crate). That view composites one of a handful of fixed materials, each with
//! its own baked-in tint and opacity, and the OS exposes no intensity control
//! for it. No amount of CSS transparency above it can make it clearer, which is
//! why the old glass never looked like glass at its lowest setting.
//!
//! This takes the approach MonoCode uses instead: make the `NSWindow` itself
//! transparent and ask the WindowServer to blur whatever is behind it, through
//! the private `CGSSetWindowBackgroundBlurRadius`. Nothing then sits between the
//! desktop and the page, so the tint is entirely CSS's to decide and the blur
//! gains a real radius.
//!
//! Fully clear (`clearColor`, alpha 0) plus a native shadow makes macOS draw a
//! chamfered gap at the window corners, so the background keeps a hair of alpha.
//!
//! The blur symbol is private and resolved at runtime. When it cannot be found
//! the caller is told, and the frontend falls back to the vibrancy material.

#[cfg(target_os = "macos")]
use std::ffi::{c_char, c_int, c_void};
#[cfg(target_os = "macos")]
use std::sync::OnceLock;

/// Radius bounds for `CGSSetWindowBackgroundBlurRadius`. 0 clears the blur.
pub const GLASS_BLUR_MAX: u8 = 64;
/// Enough blur to read as frosted without smearing the desktop into mush.
pub const GLASS_BLUR_DEFAULT: u8 = 24;

#[cfg(target_os = "macos")]
const RTLD_DEFAULT: *mut c_void = -2isize as *mut c_void;

#[cfg(target_os = "macos")]
type CgsConnection = usize;
#[cfg(target_os = "macos")]
type SetBlurFn = unsafe extern "C" fn(CgsConnection, c_int, c_int) -> c_int;
#[cfg(target_os = "macos")]
type ConnectionFn = unsafe extern "C" fn() -> CgsConnection;

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
}

#[cfg(target_os = "macos")]
fn dlsym_addr(symbol: &[u8]) -> Option<*mut c_void> {
    // SAFETY: `symbol` is a NUL-terminated byte string and RTLD_DEFAULT searches
    // already-loaded images. A missing symbol returns null, which is handled.
    let addr = unsafe { dlsym(RTLD_DEFAULT, symbol.as_ptr() as *const c_char) };
    if addr.is_null() {
        None
    } else {
        Some(addr)
    }
}

#[cfg(target_os = "macos")]
fn set_blur_fn() -> Option<SetBlurFn> {
    static FN: OnceLock<Option<SetBlurFn>> = OnceLock::new();
    *FN.get_or_init(|| {
        dlsym_addr(b"CGSSetWindowBackgroundBlurRadius\0")
            // SAFETY: the resolved symbol has this signature in CoreGraphics.
            .map(|addr| unsafe { std::mem::transmute::<*mut c_void, SetBlurFn>(addr) })
    })
}

#[cfg(target_os = "macos")]
fn cgs_connection() -> Option<CgsConnection> {
    static CONNECTION: OnceLock<Option<CgsConnection>> = OnceLock::new();
    *CONNECTION.get_or_init(|| {
        let addr = dlsym_addr(b"CGSDefaultConnectionForThread\0")
            .or_else(|| dlsym_addr(b"CGSMainConnectionID\0"))?;
        // SAFETY: both symbols take no arguments and return the connection id.
        let f = unsafe { std::mem::transmute::<*mut c_void, ConnectionFn>(addr) };
        Some(unsafe { f() })
    })
}

/// Apply or clear the transparent-window glass on the main window.
///
/// Returns `Ok(false)` when the private blur symbol is unavailable, so the
/// caller can fall back rather than leave the user with a plain clear window.
#[tauri::command]
pub fn set_window_glass(
    #[allow(unused_variables)] enabled: bool,
    #[allow(unused_variables)] blur_radius: Option<u8>,
    #[allow(unused_variables)] app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        use objc2::rc::Retained;
        use objc2::runtime::AnyObject;
        use tauri::Manager;

        let window = app_handle
            .get_webview_window("main")
            .ok_or_else(|| "main window not found".to_string())?;

        if enabled && set_blur_fn().is_none() {
            return Ok(false);
        }

        let radius = blur_radius
            .unwrap_or(GLASS_BLUR_DEFAULT)
            .min(GLASS_BLUR_MAX);

        // The page canvas has to be see-through before the window behind it is
        // worth blurring. Ordered first so a failure here leaves an opaque
        // webview over an untouched window rather than a hole in the UI.
        let webview: &tauri::Webview<_> = window.as_ref();
        if enabled {
            webview
                .set_background_color(Some(tauri::window::Color(0, 0, 0, 0)))
                .map_err(|e| e.to_string())?;
        }

        let ns_window_ptr = window.ns_window().map_err(|e| e.to_string())?;
        if ns_window_ptr.is_null() {
            return Err("main window has no NSWindow".to_string());
        }

        // Called inline, not through `run_on_main_thread`: a synchronous Tauri
        // command already runs on the main thread, which is where AppKit needs
        // this, and hopping would deadlock waiting on a queue we are blocking.
        // This is the same assumption `set_window_vibrancy` makes.
        // SAFETY: the pointer is the live NSWindow for the main window.
        let object = unsafe { Retained::retain(ns_window_ptr as *mut AnyObject) }
            .ok_or_else(|| "NSWindow retain failed".to_string())?;
        unsafe { apply_glass(&object, enabled, radius) };

        Ok(true)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

/// Drive the AppKit window into or out of the glass state.
///
/// # Safety
/// `object` must be an `NSWindow` and the caller must be on the main thread.
#[cfg(target_os = "macos")]
unsafe fn apply_glass(object: &objc2::runtime::AnyObject, enabled: bool, radius: u8) {
    use objc2::msg_send;
    use objc2::runtime::{AnyClass, AnyObject, Bool};

    unsafe {
        if enabled {
            let _: () = msg_send![object, setOpaque: Bool::NO];

            // clearColor at a hair of alpha: fully clear plus a shadow makes
            // macOS chamfer the window corners.
            if let Some(color_class) = AnyClass::get(c"NSColor") {
                let clear: *mut AnyObject = msg_send![color_class, clearColor];
                if !clear.is_null() {
                    let tinted: *mut AnyObject = msg_send![clear, colorWithAlphaComponent: 0.01f64];
                    if !tinted.is_null() {
                        let _: () = msg_send![object, setBackgroundColor: tinted];
                    }
                }
            }

            let _: () = msg_send![object, setHasShadow: Bool::YES];
            let _: () = msg_send![object, invalidateShadow];
        } else {
            let _: () = msg_send![object, setOpaque: Bool::YES];
        }

        let window_number: isize = msg_send![object, windowNumber];
        if window_number <= 0 {
            return;
        }
        let Some(set_blur) = set_blur_fn() else {
            return;
        };
        let Some(connection) = cgs_connection() else {
            return;
        };
        let applied = if enabled { radius } else { 0 };
        set_blur(connection, window_number as c_int, applied as c_int);
    }
}
