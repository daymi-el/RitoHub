use crate::riot_api::RiotApi;

pub struct AppState {
    riot_api: Option<RiotApi>,
    riot_api_error: Option<String>,
}

impl AppState {
    pub fn new() -> Self {
        dotenvy::dotenv().ok();

        match RiotApi::from_env() {
            Ok(riot_api) => Self {
                riot_api: Some(riot_api),
                riot_api_error: None,
            },
            Err(error) => Self {
                riot_api: None,
                riot_api_error: Some(error),
            },
        }
    }

    pub fn riot_api(&self) -> Result<RiotApi, String> {
        self.riot_api.clone().ok_or_else(|| {
            self.riot_api_error.clone().unwrap_or_else(|| {
                "Riot API is unavailable. Set RIOT_API_KEY in tauri/src-tauri/.env or your environment."
                    .to_string()
            })
        })
    }

    pub fn riot_api_or_none(&self) -> Option<RiotApi> {
        self.riot_api.clone()
    }

    pub fn riot_api_error(&self) -> Option<&str> {
        self.riot_api_error.as_deref()
    }
}
