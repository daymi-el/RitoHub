use regex::Regex;
use reqwest::Client;
use serde_json::{json, Value};
use urlencoding::encode;

use crate::riot_api::RiotAccountBundle;

pub struct LeagueOfGraphsScraper {
    client: Client,
}

struct ScrapedProfile {
    game_name: String,
    tag_line: String,
    league_entry: Option<Value>,
}

impl LeagueOfGraphsScraper {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent(format!(
                "{}/{}",
                env!("CARGO_PKG_NAME"),
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .expect("LeagueOfGraphs client should initialize");

        Self { client }
    }

    pub async fn lookup_account(
        &self,
        game_name: &str,
        tag_line: &str,
        platform: &str,
    ) -> Result<RiotAccountBundle, String> {
        let profile = self.fetch_profile(game_name, tag_line, platform).await?;

        Ok(RiotAccountBundle {
            riot_data: build_riot_account_value(&profile.game_name, &profile.tag_line, platform),
            league_data: profile.league_entry.into_iter().collect(),
        })
    }

    pub async fn get_league_entries(
        &self,
        game_name: &str,
        tag_line: &str,
        platform: &str,
    ) -> Result<Vec<Value>, String> {
        let profile = self.fetch_profile(game_name, tag_line, platform).await?;
        Ok(profile.league_entry.into_iter().collect())
    }

    async fn fetch_profile(
        &self,
        game_name: &str,
        tag_line: &str,
        platform: &str,
    ) -> Result<ScrapedProfile, String> {
        let platform_slug = leagueofgraphs_platform_slug(platform)?;
        let profile_slug = format!("{}-{}", encode(game_name), encode(tag_line));
        let url = format!("https://www.leagueofgraphs.com/summoner/{platform_slug}/{profile_slug}");

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|error| format!("Failed to reach LeagueofGraphs: {error}"))?;

        let status = response.status();
        let html = response
            .text()
            .await
            .map_err(|error| format!("Failed to read LeagueofGraphs response: {error}"))?;

        if !status.is_success() {
            return Err(format!(
                "LeagueofGraphs returned HTTP {} while loading the summoner page.",
                status.as_u16()
            ));
        }

        let (resolved_game_name, resolved_tag_line) = parse_title_identity(&html)
            .unwrap_or_else(|| (game_name.to_string(), tag_line.to_string()));
        let league_entry = parse_primary_rank_entry(&html);

        Ok(ScrapedProfile {
            game_name: resolved_game_name,
            tag_line: resolved_tag_line,
            league_entry,
        })
    }
}

fn build_riot_account_value(game_name: &str, tag_line: &str, platform: &str) -> Value {
    json!({
        "puuid": build_synthetic_puuid(game_name, tag_line, platform),
        "gameName": game_name,
        "tagLine": tag_line,
    })
}

fn build_synthetic_puuid(game_name: &str, tag_line: &str, platform: &str) -> String {
    format!(
        "leagueofgraphs:{}:{}#{}",
        platform.to_uppercase(),
        game_name.trim(),
        tag_line.trim()
    )
}

fn parse_title_identity(html: &str) -> Option<(String, String)> {
    let regex = Regex::new(
        r"(?is)<title>\s*([^#<]+)#([^<(]+)\s*\([A-Z0-9]+\)\s*-\s*LeagueOfGraphs\s*</title>",
    )
        .ok()?;
    let captures = regex.captures(html)?;
    let game_name = captures.get(1)?.as_str().trim().to_string();
    let tag_line = captures.get(2)?.as_str().trim().to_string();
    Some((game_name, tag_line))
}

fn parse_primary_rank_entry(html: &str) -> Option<Value> {
    let block_regex = Regex::new(
        r#"(?is)<div class="best-league__inner img-align-block">.*?<span class="leagueTier">([^<]+)</span>(.*?)</div>\s*</div>"#,
    )
        .ok()?;
    let captures = block_regex.captures(html)?;
    let raw_tier = captures.get(1)?.as_str().trim();

    if raw_tier.eq_ignore_ascii_case("Unranked") {
        return None;
    }

    let (tier, rank) = split_rank_label(raw_tier);
    let trailing_html = captures
        .get(2)
        .map(|value| value.as_str())
        .unwrap_or_default();
    let league_points = parse_number_capture(trailing_html, r"([0-9]{1,4})\s*LP").unwrap_or(0);
    let wins = parse_number_capture(trailing_html, r"([0-9]{1,4})\s*W").unwrap_or(0);
    let losses = parse_number_capture(trailing_html, r"([0-9]{1,4})\s*L").unwrap_or(0);

    Some(json!({
        "queueType": "RANKED_SOLO_5x5",
        "tier": tier,
        "rank": rank,
        "leaguePoints": league_points,
        "wins": wins,
        "losses": losses,
    }))
}

fn split_rank_label(label: &str) -> (String, String) {
    let mut parts = label.split_whitespace();
    let tier = parts.next().unwrap_or("UNRANKED").to_uppercase();
    let rank = parts.next().unwrap_or("").to_uppercase();
    (tier, rank)
}

fn parse_number_capture(haystack: &str, pattern: &str) -> Option<u32> {
    let regex = Regex::new(pattern).ok()?;
    regex
        .captures(haystack)?
        .get(1)?
        .as_str()
        .parse::<u32>()
        .ok()
}

fn leagueofgraphs_platform_slug(platform: &str) -> Result<&'static str, String> {
    match platform.to_uppercase().as_str() {
        "BR1" => Ok("br"),
        "EUN1" => Ok("eune"),
        "EUW1" => Ok("euw"),
        "JP1" => Ok("jp"),
        "KR" => Ok("kr"),
        "LA1" => Ok("lan"),
        "LA2" => Ok("las"),
        "NA1" => Ok("na"),
        "OC1" => Ok("oce"),
        "RU" => Ok("ru"),
        "SG2" => Ok("sg"),
        "TH2" => Ok("th"),
        "TW2" => Ok("tw"),
        "TR1" => Ok("tr"),
        "VN2" => Ok("vn"),
        "PH2" => Ok("ph"),
        _ => Err(format!("Unsupported LeagueofGraphs platform: {platform}")),
    }
}
