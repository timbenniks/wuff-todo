fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["live_open", "live_send", "live_close"]),
    ))
    .expect("failed to build native permissions");
}
