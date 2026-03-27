mod app_state;
mod leagueofgraphs;
mod commands;
mod riot_api;
mod riot_client;
mod secure_storage;

use app_state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    if let Some(error) = app_state.riot_api_error() {
        eprintln!("Riot API commands are unavailable: {error}");
    }

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::switch_riot_account,
            commands::lookup_riot_account,
            commands::get_summoner_profile,
            commands::get_riot_account_by_puuid,
            commands::get_league_entries,
            commands::get_current_game,
            commands::get_match_history,
            commands::load_accounts_storage,
            commands::save_accounts_storage
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
