use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
fn switch_riot_account(username: String, password: String) -> Result<(), String> {
    close_riot_clients();

    let riot_client_path = find_riot_client_path()
        .ok_or_else(|| "Unable to find Riot Client installation path".to_string())?;

    launch_riot_client(&riot_client_path)?;

    #[cfg(target_os = "windows")]
    run_windows_login_automation(&username, &password)?;

    Ok(())
}

fn launch_riot_client(riot_client_path: &PathBuf) -> Result<(), String> {
    Command::new(riot_client_path)
        .arg("--allow-multiple-clients")
        .spawn()
        .map_err(|err| format!("Failed to launch Riot Client: {err}"))?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn run_windows_login_automation(username: &str, password: &str) -> Result<(), String> {
    let escaped_username = username.replace('`', "``").replace('"', "`\"");
    let escaped_password = password.replace('`', "``").replace('"', "`\"");

    let script = format!(
        r#"Start-Sleep -Seconds 6
$wshell = New-Object -ComObject WScript.Shell
if (-not $wshell.AppActivate('Riot Client')) {{ exit 0 }}
Start-Sleep -Milliseconds 700
Set-Clipboard -Value "{escaped_username}"
$wshell.SendKeys('^v')
Start-Sleep -Milliseconds 100
$wshell.SendKeys('{{TAB}}')
Start-Sleep -Milliseconds 100
Set-Clipboard -Value "{escaped_password}"
$wshell.SendKeys('^v')
Start-Sleep -Milliseconds 100
$wshell.SendKeys('{{ENTER}}')"#,
    );

    Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .spawn()
        .map_err(|err| format!("Failed to automate Riot login on Windows: {err}"))?;

    Ok(())
}

fn close_riot_clients() {
    #[cfg(target_os = "windows")]
    {
        let process_names = [
            "RiotClientServices.exe",
            "RiotClientUx.exe",
            "RiotClientUxRender.exe",
            "LeagueClient.exe",
            "LeagueClientUx.exe",
            "LeagueClientUxRender.exe",
        ];

        for process_name in process_names {
            let _ = Command::new("taskkill")
                .args(["/F", "/IM", process_name])
                .output();
        }
    }

    #[cfg(target_os = "macos")]
    {
        let process_names = [
            "Riot Client",
            "RiotClientServices",
            "RiotClientUx",
            "RiotClientUxRender",
            "LeagueClient",
            "LeagueClientUx",
            "LeagueClientUxRender",
        ];

        for process_name in process_names {
            let _ = Command::new("pkill").args(["-f", process_name]).output();
        }
    }

    #[cfg(target_os = "linux")]
    {
        let process_names = [
            "RiotClientServices",
            "RiotClientUx",
            "RiotClientUxRender",
            "LeagueClient",
            "LeagueClientUx",
            "LeagueClientUxRender",
        ];

        for process_name in process_names {
            let _ = Command::new("pkill").args(["-f", process_name]).output();
        }
    }
}

fn find_riot_client_path() -> Option<PathBuf> {
    if let Ok(custom_path) = std::env::var("RIOT_CLIENT_PATH") {
        let custom = PathBuf::from(custom_path);
        if custom.exists() {
            return Some(custom);
        }
    }

    let candidates = [
        r"C:\Riot Games\Riot Client\RiotClientServices.exe",
        r"C:\Program Files\Riot Games\Riot Client\RiotClientServices.exe",
        "/Applications/Riot Client.app/Contents/MacOS/Riot Client",
    ];

    candidates
        .iter()
        .map(PathBuf::from)
        .find(|candidate| candidate.exists())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![switch_riot_account])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
