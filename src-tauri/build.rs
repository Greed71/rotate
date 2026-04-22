fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "platform_blurb",
                "security_status",
                "security_set_pin",
                "security_unlock",
                "security_lock",
                "security_change_pin",
                "integrations_list",
                "integrations_add",
                "cloudflare_link",
                "cloudflare_status",
                "cloudflare_list_tokens",
                "cloudflare_reveal_managed_token",
                "cloudflare_rotate_account_token",
                "cloudflare_unlink",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
