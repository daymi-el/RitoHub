use reqwest::{Client, RequestBuilder, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{sync::Mutex, time::sleep};
use urlencoding::encode;

#[derive(Clone)]
pub struct RiotApi {
    client: Client,
    rate_limiter: Arc<RiotRateLimiter>,
    account_cache: Arc<ResponseCache<Value>>,
    league_entries_cache: Arc<ResponseCache<Vec<Value>>>,
    current_game_cache: Arc<ResponseCache<Value>>,
    match_history_cache: Arc<ResponseCache<Vec<Value>>>,
    match_details_cache: Arc<ResponseCache<Value>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RiotAccountBundle {
    pub riot_data: Value,
    pub league_data: Vec<Value>,
}

#[derive(Debug, Deserialize)]
pub struct MatchHistoryRequest {
    pub platform: String,
    pub puuid: String,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub queue: Option<u16>,
    #[serde(rename = "type")]
    pub match_type: Option<String>,
    pub start: Option<u16>,
    pub count: Option<u8>,
}

#[derive(Debug, Deserialize)]
struct RiotApiErrorResponse {
    status: RiotApiErrorStatus,
}

#[derive(Debug, Deserialize)]
struct RiotApiErrorStatus {
    message: String,
    status_code: u16,
}

impl RiotApi {
    pub fn from_env() -> Result<Self, String> {
        let api_key = std::env::var("RIOT_API_KEY")
            .map_err(|_| "Missing RIOT_API_KEY for native Riot API access.".to_string())?;

        let client = Client::builder()
            .user_agent(format!(
                "{}/{}",
                env!("CARGO_PKG_NAME"),
                env!("CARGO_PKG_VERSION")
            ))
            .default_headers(build_headers(api_key)?)
            .build()
            .map_err(|error| format!("Failed to initialize Riot API client: {error}"))?;

        Ok(Self {
            client,
            rate_limiter: Arc::new(RiotRateLimiter::new()),
            account_cache: Arc::new(ResponseCache::new()),
            league_entries_cache: Arc::new(ResponseCache::new()),
            current_game_cache: Arc::new(ResponseCache::new()),
            match_history_cache: Arc::new(ResponseCache::new()),
            match_details_cache: Arc::new(ResponseCache::new()),
        })
    }

    pub async fn lookup_account(
        &self,
        game_name: &str,
        tag_line: &str,
        platform: &str,
    ) -> Result<RiotAccountBundle, String> {
        let region = regional_host(platform)?;
        let account_url = format!(
            "https://{region}/riot/account/v1/accounts/by-riot-id/{}/{}",
            encode(game_name),
            encode(tag_line)
        );

        let riot_data: Value = self.send_json(self.client.get(account_url)).await?;

        let puuid = riot_data
            .get("puuid")
            .and_then(Value::as_str)
            .ok_or_else(|| "Riot API account response did not include a puuid.".to_string())?;

        let league_data = self.get_league_entries(puuid, platform).await?;

        Ok(RiotAccountBundle {
            riot_data,
            league_data,
        })
    }

    pub async fn get_summoner_profile(
        &self,
        puuid: &str,
        platform: &str,
    ) -> Result<RiotAccountBundle, String> {
        let riot_data = self.get_account_by_puuid(puuid, platform).await?;
        let league_data = self.get_league_entries(puuid, platform).await?;

        Ok(RiotAccountBundle {
            riot_data,
            league_data,
        })
    }

    pub async fn get_account_by_puuid(&self, puuid: &str, platform: &str) -> Result<Value, String> {
        let region = regional_host(platform)?;
        let account_url = format!(
            "https://{region}/riot/account/v1/accounts/by-puuid/{}",
            encode(puuid)
        );

        self.account_cache
            .get_or_fetch(
                format!("account:{region}:{puuid}"),
                CachePolicy::AccountByPuuid,
                || async { self.send_json(self.client.get(account_url)).await },
            )
            .await
    }

    pub async fn get_league_entries(
        &self,
        puuid: &str,
        platform: &str,
    ) -> Result<Vec<Value>, String> {
        let host = platform_host(platform)?;
        let league_url = format!(
            "https://{host}/lol/league/v4/entries/by-puuid/{}",
            encode(puuid)
        );

        self.league_entries_cache
            .get_or_fetch(
                format!("league:{host}:{puuid}"),
                CachePolicy::LeagueEntries,
                || async { self.send_json(self.client.get(league_url)).await },
            )
            .await
    }

    pub async fn get_current_game(&self, puuid: &str, platform: &str) -> Result<Value, String> {
        let host = platform_host(platform)?;
        let live_game_url = format!(
            "https://{host}/lol/spectator/v5/active-games/by-summoner/{}",
            encode(puuid)
        );

        self.current_game_cache
            .get_or_fetch(
                format!("live-game:{host}:{puuid}"),
                CachePolicy::CurrentGame,
                || async { self.send_json(self.client.get(live_game_url)).await },
            )
            .await
    }

    pub async fn get_match_history(
        &self,
        request: &MatchHistoryRequest,
    ) -> Result<Vec<Value>, String> {
        let region = regional_host(&request.platform)?;
        let match_ids_url = format!(
            "https://{region}/lol/match/v5/matches/by-puuid/{}/ids",
            encode(&request.puuid)
        );

        let mut query = Vec::<(String, String)>::new();

        if let Some(start_time) = request.start_time {
            query.push(("startTime".to_string(), start_time.to_string()));
        }

        if let Some(end_time) = request.end_time {
            query.push(("endTime".to_string(), end_time.to_string()));
        }

        if let Some(queue) = request.queue {
            query.push(("queue".to_string(), queue.to_string()));
        }

        if let Some(match_type) = request.match_type.as_deref() {
            query.push(("type".to_string(), match_type.to_string()));
        }

        if let Some(start) = request.start {
            query.push(("start".to_string(), start.to_string()));
        }

        query.push(("count".to_string(), request.count.unwrap_or(20).to_string()));

        let query_key = build_match_history_cache_key(&request.platform, &query);

        self.match_history_cache
            .get_or_fetch(query_key, CachePolicy::MatchHistory, || async {
                let match_ids: Vec<String> = self
                    .send_json(self.client.get(match_ids_url).query(&query))
                    .await?;

                let mut matches = Vec::with_capacity(match_ids.len());

                for match_id in match_ids {
                    let match_url = format!(
                        "https://{region}/lol/match/v5/matches/{}",
                        encode(&match_id)
                    );

                    let match_details = self
                        .match_details_cache
                        .get_or_fetch(
                            format!("match:{region}:{match_id}"),
                            CachePolicy::MatchDetails,
                            || async { self.send_json(self.client.get(match_url)).await },
                        )
                        .await?;

                    matches.push(match_details);
                }

                Ok(matches)
            })
            .await
    }

    async fn send_json<T>(&self, request: RequestBuilder) -> Result<T, String>
    where
        T: DeserializeOwned,
    {
        self.send_json_with_retry(request).await
    }

    async fn send_json_with_retry<T>(&self, request: RequestBuilder) -> Result<T, String>
    where
        T: DeserializeOwned,
    {
        const MAX_RETRIES: usize = 3;
        let mut attempt = 0;

        loop {
            let next_request = request
                .try_clone()
                .ok_or_else(|| "Failed to clone Riot API request.".to_string())?;

            self.rate_limiter.acquire().await;

            let response = next_request
                .send()
                .await
                .map_err(|error| format!("Failed to reach the Riot API: {error}"))?;

            if response.status() == StatusCode::TOO_MANY_REQUESTS && attempt < MAX_RETRIES {
                let wait_duration = retry_after_duration(&response);
                sleep(wait_duration).await;
                attempt += 1;
                continue;
            }

            return parse_response(response).await;
        }
    }
}

struct RiotRateLimiter {
    state: Mutex<RiotRateLimiterState>,
}

struct ResponseCache<T> {
    entries: Mutex<HashMap<String, CacheEntry<T>>>,
}

#[derive(Clone)]
struct CacheEntry<T> {
    value: T,
    expires_at: Instant,
}

#[derive(Clone, Copy)]
enum CachePolicy {
    AccountByPuuid,
    LeagueEntries,
    CurrentGame,
    MatchHistory,
    MatchDetails,
}

impl CachePolicy {
    fn ttl(self) -> Duration {
        match self {
            Self::AccountByPuuid => Duration::from_secs(12 * 60 * 60),
            Self::LeagueEntries => Duration::from_secs(90),
            Self::CurrentGame => Duration::from_secs(10),
            Self::MatchHistory => Duration::from_secs(30),
            Self::MatchDetails => Duration::from_secs(10 * 60),
        }
    }
}

struct RiotRateLimiterState {
    short_window: VecDeque<Instant>,
    long_window: VecDeque<Instant>,
}

impl<T> ResponseCache<T>
where
    T: Clone,
{
    fn new() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }

    async fn get_or_fetch<F, Fut>(
        &self,
        key: String,
        policy: CachePolicy,
        fetcher: F,
    ) -> Result<T, String>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output=Result<T, String>>,
    {
        if let Some(value) = self.get(&key).await {
            return Ok(value);
        }

        let value = fetcher().await?;
        self.set(key, value.clone(), policy).await;
        Ok(value)
    }

    async fn get(&self, key: &str) -> Option<T> {
        let now = Instant::now();
        let mut entries = self.entries.lock().await;

        match entries.get(key) {
            Some(entry) if entry.expires_at > now => Some(entry.value.clone()),
            Some(_) => {
                entries.remove(key);
                None
            }
            None => None,
        }
    }

    async fn set(&self, key: String, value: T, policy: CachePolicy) {
        let expires_at = Instant::now() + policy.ttl();
        let mut entries = self.entries.lock().await;

        entries.insert(key, CacheEntry { value, expires_at });
    }
}

impl RiotRateLimiter {
    const SHORT_WINDOW_LIMIT: usize = 19;
    const SHORT_WINDOW_DURATION: Duration = Duration::from_secs(1);
    const LONG_WINDOW_LIMIT: usize = 95;
    const LONG_WINDOW_DURATION: Duration = Duration::from_secs(120);
    const POLL_INTERVAL: Duration = Duration::from_millis(100);

    fn new() -> Self {
        Self {
            state: Mutex::new(RiotRateLimiterState {
                short_window: VecDeque::new(),
                long_window: VecDeque::new(),
            }),
        }
    }

    async fn acquire(&self) {
        loop {
            let wait_duration = {
                let mut state = self.state.lock().await;
                let now = Instant::now();

                prune_window(&mut state.short_window, now, Self::SHORT_WINDOW_DURATION);
                prune_window(&mut state.long_window, now, Self::LONG_WINDOW_DURATION);

                let short_wait = window_wait_duration(
                    &state.short_window,
                    Self::SHORT_WINDOW_LIMIT,
                    Self::SHORT_WINDOW_DURATION,
                    now,
                );
                let long_wait = window_wait_duration(
                    &state.long_window,
                    Self::LONG_WINDOW_LIMIT,
                    Self::LONG_WINDOW_DURATION,
                    now,
                );

                match max_duration(short_wait, long_wait) {
                    Some(wait_duration) => wait_duration.max(Self::POLL_INTERVAL),
                    None => {
                        state.short_window.push_back(now);
                        state.long_window.push_back(now);
                        return;
                    }
                }
            };

            sleep(wait_duration).await;
        }
    }
}

async fn parse_response<T>(response: reqwest::Response) -> Result<T, String>
where
    T: DeserializeOwned,
{
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read Riot API response: {error}"))?;

    if !status.is_success() {
        return Err(format_riot_api_error(status, &body));
    }

    serde_json::from_str(&body)
        .map_err(|error| format!("Failed to parse Riot API response JSON: {error}"))
}

fn build_headers(api_key: String) -> Result<reqwest::header::HeaderMap, String> {
    use reqwest::header::{HeaderMap, HeaderValue};

    let mut headers = HeaderMap::new();
    let value = HeaderValue::from_str(&api_key)
        .map_err(|error| format!("Invalid RIOT_API_KEY header value: {error}"))?;

    headers.insert("X-Riot-Token", value);
    Ok(headers)
}

fn retry_after_duration(response: &reqwest::Response) -> Duration {
    const DEFAULT_RETRY_AFTER: Duration = Duration::from_secs(2);
    const MAX_RETRY_AFTER: Duration = Duration::from_secs(15);

    let Some(value) = response.headers().get("retry-after") else {
        return DEFAULT_RETRY_AFTER;
    };

    let Ok(value) = value.to_str() else {
        return DEFAULT_RETRY_AFTER;
    };

    let Ok(seconds) = value.trim().parse::<u64>() else {
        return DEFAULT_RETRY_AFTER;
    };

    Duration::from_secs(seconds).min(MAX_RETRY_AFTER)
}

fn prune_window(window: &mut VecDeque<Instant>, now: Instant, duration: Duration) {
    while let Some(timestamp) = window.front() {
        if now.duration_since(*timestamp) < duration {
            break;
        }

        window.pop_front();
    }
}

fn window_wait_duration(
    window: &VecDeque<Instant>,
    limit: usize,
    duration: Duration,
    now: Instant,
) -> Option<Duration> {
    if window.len() < limit {
        return None;
    }

    window.front().map(|timestamp| {
        duration
            .checked_sub(now.duration_since(*timestamp))
            .unwrap_or_default()
    })
}

fn max_duration(left: Option<Duration>, right: Option<Duration>) -> Option<Duration> {
    match (left, right) {
        (Some(left), Some(right)) => Some(left.max(right)),
        (Some(left), None) => Some(left),
        (None, Some(right)) => Some(right),
        (None, None) => None,
    }
}

fn build_match_history_cache_key(platform: &str, query: &[(String, String)]) -> String {
    let mut key = format!("match-history:{}", platform.to_uppercase());

    for (name, value) in query {
        key.push(':');
        key.push_str(name);
        key.push('=');
        key.push_str(value);
    }

    key
}

fn format_riot_api_error(status: StatusCode, body: &str) -> String {
    if let Ok(error_response) = serde_json::from_str::<RiotApiErrorResponse>(body) {
        return format!(
            "Riot API returned {}: {}",
            error_response.status.status_code, error_response.status.message
        );
    }

    let trimmed_body = body.trim();

    if trimmed_body.is_empty() {
        return format!("Riot API returned HTTP {}.", status.as_u16());
    }

    format!(
        "Riot API returned HTTP {}: {}",
        status.as_u16(),
        trimmed_body
    )
}

fn platform_host(platform: &str) -> Result<&'static str, String> {
    match platform.to_uppercase().as_str() {
        "BR1" => Ok("br1.api.riotgames.com"),
        "EUN1" => Ok("eun1.api.riotgames.com"),
        "EUW1" => Ok("euw1.api.riotgames.com"),
        "JP1" => Ok("jp1.api.riotgames.com"),
        "KR" => Ok("kr.api.riotgames.com"),
        "LA1" => Ok("la1.api.riotgames.com"),
        "LA2" => Ok("la2.api.riotgames.com"),
        "NA1" => Ok("na1.api.riotgames.com"),
        "OC1" => Ok("oc1.api.riotgames.com"),
        "PH2" => Ok("ph2.api.riotgames.com"),
        "RU" => Ok("ru.api.riotgames.com"),
        "SG2" => Ok("sg2.api.riotgames.com"),
        "TH2" => Ok("th2.api.riotgames.com"),
        "TR1" => Ok("tr1.api.riotgames.com"),
        "TW2" => Ok("tw2.api.riotgames.com"),
        "VN2" => Ok("vn2.api.riotgames.com"),
        _ => Err(format!("Unsupported Riot platform: {platform}")),
    }
}

fn regional_host(platform: &str) -> Result<&'static str, String> {
    match platform.to_uppercase().as_str() {
        "BR1" | "LA1" | "LA2" | "NA1" => Ok("americas.api.riotgames.com"),
        "JP1" | "KR" => Ok("asia.api.riotgames.com"),
        "EUN1" | "EUW1" | "RU" | "TR1" => Ok("europe.api.riotgames.com"),
        "OC1" | "PH2" | "SG2" | "TH2" | "TW2" | "VN2" => Ok("sea.api.riotgames.com"),
        _ => Err(format!("Unsupported Riot platform: {platform}")),
    }
}
