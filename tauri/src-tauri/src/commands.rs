use serde::Deserialize;
use serde_json::Value;
use tauri::AppHandle;
use tauri::State;

use crate::app_state::AppState;
use crate::leagueofgraphs::LeagueOfGraphsScraper;
use crate::riot_api::{MatchHistoryRequest, RiotAccountBundle};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiotAccountLookupRequest {
    pub game_name: String,
    pub tag_line: String,
    pub platform: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummonerProfileRequest {
    pub puuid: String,
    pub platform: String,
    pub game_name: Option<String>,
    pub tag_line: Option<String>,
}

#[tauri::command]
pub async fn switch_riot_account(
    username: String,
    password: String,
) -> Result<(), crate::riot_client::RiotLoginError> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::riot_client::switch_riot_account(&username, &password)
    })
        .await
        .map_err(|error| crate::riot_client::RiotLoginError::task_join(error.to_string()))?
}

#[tauri::command]
pub async fn lookup_riot_account(
    request: RiotAccountLookupRequest,
    state: State<'_, AppState>,
) -> Result<RiotAccountBundle, String> {
    let scraper = LeagueOfGraphsScraper::new();

    if let Some(riot_api) = state.riot_api_or_none() {
        match riot_api
            .lookup_account(&request.game_name, &request.tag_line, &request.platform)
            .await
        {
            Ok(result) => return Ok(result),
            Err(error) if should_try_leagueofgraphs_fallback(&error) => {}
            Err(error) => return Err(error),
        }
    }

    scraper
        .lookup_account(&request.game_name, &request.tag_line, &request.platform)
        .await
}

#[tauri::command]
pub async fn get_summoner_profile(
    request: SummonerProfileRequest,
    state: State<'_, AppState>,
) -> Result<RiotAccountBundle, String> {
    if let Some(riot_api) = state.riot_api_or_none() {
        match riot_api
            .get_summoner_profile(&request.puuid, &request.platform)
            .await
        {
            Ok(result) => return Ok(result),
            Err(error) if should_try_leagueofgraphs_fallback(&error) => {}
            Err(error) => return Err(error),
        }
    }

    let Some(game_name) = request.game_name.as_deref() else {
        return Err(missing_scraper_identity_message());
    };
    let Some(tag_line) = request.tag_line.as_deref() else {
        return Err(missing_scraper_identity_message());
    };

    LeagueOfGraphsScraper::new()
        .lookup_account(game_name, tag_line, &request.platform)
        .await
}

#[tauri::command]
pub async fn get_riot_account_by_puuid(
    request: SummonerProfileRequest,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    state
        .riot_api()?
        .get_account_by_puuid(&request.puuid, &request.platform)
        .await
}

#[tauri::command]
pub async fn get_league_entries(
    request: SummonerProfileRequest,
    state: State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    if let Some(riot_api) = state.riot_api_or_none() {
        match riot_api
            .get_league_entries(&request.puuid, &request.platform)
            .await
        {
            Ok(result) => return Ok(result),
            Err(error) if should_try_leagueofgraphs_fallback(&error) => {}
            Err(error) => return Err(error),
        }
    }

    let Some(game_name) = request.game_name.as_deref() else {
        return Err(missing_scraper_identity_message());
    };
    let Some(tag_line) = request.tag_line.as_deref() else {
        return Err(missing_scraper_identity_message());
    };

    LeagueOfGraphsScraper::new()
        .get_league_entries(game_name, tag_line, &request.platform)
        .await
}

#[tauri::command]
pub async fn get_current_game(
    request: SummonerProfileRequest,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    state
        .riot_api()?
        .get_current_game(&request.puuid, &request.platform)
        .await
}

#[tauri::command]
pub async fn get_match_history(
    request: MatchHistoryRequest,
    state: State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    state.riot_api()?.get_match_history(&request).await
}

#[tauri::command]
pub fn load_accounts_storage(app: AppHandle) -> Result<Value, String> {
    crate::secure_storage::load_accounts(&app)
}

#[tauri::command]
pub fn save_accounts_storage(app: AppHandle, accounts: Value) -> Result<(), String> {
    crate::secure_storage::save_accounts(&app, accounts)
}

fn should_try_leagueofgraphs_fallback(error: &str) -> bool {
    error.contains("429") || error.contains("rate limit") || error.contains("rate-limit")
}

fn missing_scraper_identity_message() -> String {
    "LeagueofGraphs fallback requires a Riot ID (game name and tag line).".to_string()
}
