mod live;
use tauri_plugin_keyring::KeyringExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Never allow the keyring plugin's test backend in an installed Wuff client.
    if std::env::var_os("KEYRING_USE_MOCK").is_some() {
        panic!("Mock credential storage is not allowed");
    }
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}));
    builder
        .manage(live::LiveSockets::default())
        .invoke_handler(tauri::generate_handler![
            live::live_open,
            live::live_send,
            live::live_close
        ])
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_keyring::init())
        .setup(|app| {
            // macOS Keychain supports development builds and signed distribution.
            // The plugin default protected store requires a provisioning profile.
            #[cfg(target_os = "macos")]
            keyring_core::set_default_store(apple_native_keyring_store::keychain::Store::new()?);
            app.keyring()
                .initialize_service("com.timbenniks.wufftodo.tauri".into())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("could not start Wuff Todo");
}
