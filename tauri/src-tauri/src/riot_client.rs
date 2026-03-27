use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
#[cfg(target_os = "windows")]
use std::thread::sleep;
#[cfg(target_os = "windows")]
use std::time::{Duration, Instant};

use serde::Serialize;

#[cfg(target_os = "windows")]
use windows::{
    core::{Error as WindowsError, BOOL, BSTR},
    Win32::{
        Foundation::{CloseHandle, GlobalFree, HANDLE, HWND, LPARAM, RPC_E_CHANGED_MODE},
        System::{
            Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
                COINIT_APARTMENTTHREADED,
            },
            DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData},
            Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE},
            Ole::CF_UNICODETEXT,
            Threading::{
                OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
                PROCESS_QUERY_LIMITED_INFORMATION,
            },
            Variant::{VARIANT, VARIANT_0, VARIANT_0_0, VARIANT_0_0_0, VT_I4},
        },
        UI::{
            Accessibility::{
                CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationElementArray,
                IUIAutomationValuePattern, TreeScope_Descendants, UIA_EditControlTypeId,
                UIA_ValuePatternId,
            },
            Input::KeyboardAndMouse::{
                mouse_event, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
                KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
                VIRTUAL_KEY, VK_BACK, VK_CONTROL, VK_RETURN, VK_TAB,
            },
            WindowsAndMessaging::{
                EnumWindows, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
                GetWindowThreadProcessId, IsWindowVisible, SetCursorPos, SetForegroundWindow,
                ShowWindow, SW_RESTORE,
            },
        },
    },
};

#[cfg(target_os = "windows")]
const WINDOWS_RIOT_PROCESS_NAMES: &[&str] = &[
    "Riot Client.exe",
    "RiotClientServices.exe",
    "RiotClientUx.exe",
    "RiotClientUxRender.exe",
    "RiotClientCrashHandler.exe",
    "LeagueClient.exe",
    "LeagueClientUx.exe",
    "LeagueClientUxRender.exe",
    "LeagueCrashHandler.exe",
    "LeagueCrashHandler64.exe",
];

#[derive(Debug, Clone, Serialize)]
pub struct RiotLoginError {
    pub stage: &'static str,
    pub code: &'static str,
    pub message: String,
}

impl RiotLoginError {
    fn new(stage: &'static str, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            stage,
            code,
            message: message.into(),
        }
    }

    pub fn task_join(message: impl Into<String>) -> Self {
        Self::new("launch_client", "task_join_failed", message)
    }
}

pub fn switch_riot_account(username: &str, password: &str) -> Result<(), RiotLoginError> {
    close_riot_clients();

    let riot_client_path = find_riot_client_path().ok_or_else(|| {
        RiotLoginError::new(
            "launch_client",
            "client_not_found",
            "Unable to find the Riot Client installation path.",
        )
    })?;

    launch_riot_client(&riot_client_path)?;

    #[cfg(target_os = "windows")]
    run_windows_login_automation(username, password)?;

    Ok(())
}

fn launch_riot_client(riot_client_path: &PathBuf) -> Result<(), RiotLoginError> {
    let mut command = Command::new(riot_client_path);

    if let Some(working_directory) = riot_client_path.parent() {
        command.current_dir(working_directory);
    }

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            RiotLoginError::new(
                "launch_client",
                "spawn_failed",
                format!("Failed to launch Riot Client: {error}"),
            )
        })?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn run_windows_login_automation(username: &str, password: &str) -> Result<(), RiotLoginError> {
    let _apartment = ComApartment::initialize().map_err(|error| {
        RiotLoginError::new(
            "wait_for_window",
            "com_init_failed",
            format!("Failed to initialize Windows automation: {error}"),
        )
    })?;

    let automation = create_ui_automation().map_err(|error| {
        RiotLoginError::new(
            "wait_for_window",
            "automation_init_failed",
            format!("Failed to start Windows UI Automation: {error}"),
        )
    })?;

    wait_for_riot_windows(Duration::from_secs(45))?;
    let controls = match wait_for_login_controls(&automation, Duration::from_secs(20)) {
        Ok(controls) => Some(controls),
        Err(_) => None,
    };

    if let Some(controls) = controls {
        set_edit_value(
            &controls.username,
            username,
            "fill_username",
            "username_entry_failed",
        )?;
        set_edit_value(
            &controls.password,
            password,
            "fill_password",
            "password_entry_failed",
        )?;
        submit_login(&controls.password)?;
        return Ok(());
    }

    let mut last_error = None;
    let windows = find_riot_windows();

    for hwnd in &windows {
        if perform_heuristic_login(*hwnd, username, password).is_ok() {
            return Ok(());
        }

        if let Err(error) = perform_tab_navigation_login(*hwnd, username, password) {
            last_error = Some(error);
        } else {
            return Ok(());
        }
    }

    Err(last_error.unwrap_or_else(|| {
        RiotLoginError::new(
            "wait_for_controls",
            "controls_not_found",
            "Riot Client opened but the username/password fields could not be reached.",
        )
    }))
}

fn close_riot_clients() {
    #[cfg(target_os = "windows")]
    {
        for process_name in WINDOWS_RIOT_PROCESS_NAMES {
            let _ = Command::new("taskkill")
                .args(["/F", "/IM", process_name])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .output();
        }

        wait_for_windows_processes_to_exit(WINDOWS_RIOT_PROCESS_NAMES, Duration::from_secs(10));
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
            let _ = Command::new("pkill")
                .args(["-f", process_name])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .output();
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
            let _ = Command::new("pkill")
                .args(["-f", process_name])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .output();
        }
    }
}

#[cfg(target_os = "windows")]
fn find_riot_client_path() -> Option<PathBuf> {
    find_windows_riot_client_path()
}

#[cfg(not(target_os = "windows"))]
fn find_riot_client_path() -> Option<PathBuf> {
    if let Ok(custom_path) = std::env::var("RIOT_CLIENT_PATH") {
        let custom = PathBuf::from(custom_path);
        if custom.exists() {
            return Some(custom);
        }
    }

    let candidates = ["/Applications/Riot Client.app/Contents/MacOS/Riot Client"];

    candidates
        .iter()
        .map(PathBuf::from)
        .find(|candidate| candidate.exists())
}

#[cfg(target_os = "windows")]
fn find_windows_riot_client_path() -> Option<PathBuf> {
    if let Ok(custom_path) = std::env::var("RIOT_CLIENT_PATH") {
        if let Some(path) = resolve_windows_riot_client_path(Path::new(&custom_path)) {
            return Some(path);
        }
    }

    if let Some(path) = find_windows_riot_client_path_from_shortcuts() {
        return Some(path);
    }

    let install_roots = [
        PathBuf::from(r"C:\Games\Riot Games\Riot Client"),
        PathBuf::from(r"C:\Riot Games\Riot Client"),
        PathBuf::from(r"C:\Program Files\Riot Games\Riot Client"),
    ];

    install_roots
        .iter()
        .find_map(|install_root| resolve_windows_riot_client_path(install_root))
}

#[cfg(target_os = "windows")]
fn find_windows_riot_client_path_from_shortcuts() -> Option<PathBuf> {
    let mut shortcut_paths = Vec::new();

    if let Ok(program_data) = std::env::var("ProgramData") {
        shortcut_paths.push(
            Path::new(&program_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
                .join("Riot Games")
                .join("Riot Client.lnk"),
        );
    }

    if let Ok(app_data) = std::env::var("APPDATA") {
        shortcut_paths.push(
            Path::new(&app_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
                .join("Riot Games")
                .join("Riot Client.lnk"),
        );
    }

    shortcut_paths.iter().find_map(|shortcut_path| {
        resolve_windows_shortcut_target(shortcut_path)
            .and_then(|target_path| resolve_windows_riot_client_path(&target_path))
    })
}

#[cfg(target_os = "windows")]
fn resolve_windows_riot_client_path(candidate: &Path) -> Option<PathBuf> {
    if !candidate.exists() {
        return None;
    }

    if candidate.is_dir() {
        return select_windows_riot_launch_path(candidate);
    }

    if candidate
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("lnk"))
    {
        return resolve_windows_shortcut_target(candidate)
            .and_then(|target_path| resolve_windows_riot_client_path(&target_path));
    }

    if candidate.is_file() {
        if is_windows_riot_launch_binary(candidate) {
            return Some(candidate.to_path_buf());
        }

        if let Some(parent) = candidate.parent() {
            return select_windows_riot_launch_path(parent);
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn select_windows_riot_launch_path(install_root: &Path) -> Option<PathBuf> {
    let services_path = install_root.join("RiotClientServices.exe");
    if services_path.exists() {
        return Some(services_path);
    }

    let electron_path = install_root
        .join("RiotClientElectron")
        .join("Riot Client.exe");
    if electron_path.exists() {
        return Some(electron_path);
    }

    None
}

#[cfg(target_os = "windows")]
fn is_windows_riot_launch_binary(path: &Path) -> bool {
    path.file_name()
        .and_then(|file_name| file_name.to_str())
        .is_some_and(|file_name| {
            file_name.eq_ignore_ascii_case("RiotClientServices.exe")
                || file_name.eq_ignore_ascii_case("Riot Client.exe")
        })
}

#[cfg(target_os = "windows")]
fn resolve_windows_shortcut_target(shortcut_path: &Path) -> Option<PathBuf> {
    if !shortcut_path.exists() {
        return None;
    }

    let escaped_shortcut_path = escape_powershell_literal(&shortcut_path.to_string_lossy());
    let script = format!(
        "$shell = New-Object -ComObject WScript.Shell; \
         $shortcut = $shell.CreateShortcut('{escaped_shortcut_path}'); \
         if ($shortcut.TargetPath) {{ Write-Output $shortcut.TargetPath }}"
    );

    let output = powershell_command(&["-Command", &script]).ok()?;

    if !output.status.success() {
        return None;
    }

    let target_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if target_path.is_empty() {
        return None;
    }

    Some(PathBuf::from(target_path))
}

#[cfg(target_os = "windows")]
fn wait_for_windows_processes_to_exit(process_names: &[&str], timeout: Duration) {
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        if !windows_processes_are_running(process_names) {
            return;
        }

        sleep(Duration::from_millis(250));
    }
}

#[cfg(target_os = "windows")]
fn windows_processes_are_running(process_names: &[&str]) -> bool {
    let powershell_names = process_names
        .iter()
        .map(|process_name| {
            format!(
                "'{}'",
                escape_powershell_literal(trim_windows_extension(process_name))
            )
        })
        .collect::<Vec<_>>()
        .join(", ");

    let script = format!(
        "$running = Get-Process -Name @({powershell_names}) -ErrorAction SilentlyContinue; \
         if ($null -ne $running) {{ exit 0 }} else {{ exit 1 }}"
    );

    powershell_command(&["-Command", &script])
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn powershell_command(args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
        ])
        .args(args)
        .output()
        .map_err(|error| format!("Failed to execute PowerShell: {error}"))
}

#[cfg(target_os = "windows")]
fn trim_windows_extension(process_name: &str) -> &str {
    process_name.strip_suffix(".exe").unwrap_or(process_name)
}

#[cfg(target_os = "windows")]
fn escape_powershell_literal(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(target_os = "windows")]
#[derive(Clone)]
struct LoginControls {
    username: IUIAutomationElement,
    password: IUIAutomationElement,
}

#[cfg(target_os = "windows")]
struct ComApartment {
    should_uninitialize: bool,
}

#[cfg(target_os = "windows")]
impl ComApartment {
    fn initialize() -> Result<Self, WindowsError> {
        let result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };

        if result.is_ok() {
            return Ok(Self {
                should_uninitialize: true,
            });
        }

        if result == RPC_E_CHANGED_MODE {
            return Ok(Self {
                should_uninitialize: false,
            });
        }

        Err(WindowsError::from(result))
    }
}

#[cfg(target_os = "windows")]
impl Drop for ComApartment {
    fn drop(&mut self) {
        if self.should_uninitialize {
            unsafe {
                CoUninitialize();
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn create_ui_automation() -> Result<IUIAutomation, WindowsError> {
    unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER) }
}

#[cfg(target_os = "windows")]
fn wait_for_riot_windows(timeout: Duration) -> Result<Vec<HWND>, RiotLoginError> {
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        let windows = find_riot_windows();
        if !windows.is_empty() {
            return Ok(windows);
        }

        sleep(Duration::from_millis(500));
    }

    Err(RiotLoginError::new(
        "wait_for_window",
        "window_not_found",
        "Riot Client opened but the login window never appeared.",
    ))
}

#[cfg(target_os = "windows")]
fn find_riot_windows() -> Vec<HWND> {
    let mut windows = Vec::new();

    unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let windows = &mut *(lparam.0 as *mut Vec<HWND>);
        windows.push(hwnd);
        BOOL(1)
    }

    unsafe {
        let _ = EnumWindows(
            Some(enum_windows_callback),
            LPARAM(&mut windows as *mut Vec<HWND> as isize),
        );
    }

    windows
        .into_iter()
        .filter(|hwnd| is_riot_window(*hwnd))
        .collect()
}

#[cfg(target_os = "windows")]
fn is_riot_window(hwnd: HWND) -> bool {
    if hwnd.0.is_null() {
        return false;
    }

    let is_visible = unsafe { IsWindowVisible(hwnd).as_bool() };
    if !is_visible {
        return false;
    }

    let Some(process_name) = get_window_process_name(hwnd) else {
        return false;
    };

    if !matches!(
        process_name.as_str(),
        "riotclientux.exe" | "riot client.exe" | "riotclientservices.exe"
    ) {
        return false;
    }

    let title = get_window_title(hwnd);
    if title.is_empty() {
        return true;
    }

    !title.to_ascii_lowercase().contains("leagueclient")
}

#[cfg(target_os = "windows")]
fn get_window_title(hwnd: HWND) -> String {
    let length = unsafe { GetWindowTextLengthW(hwnd) };
    if length <= 0 {
        return String::new();
    }

    let mut buffer = vec![0u16; length as usize + 1];
    let copied = unsafe { GetWindowTextW(hwnd, &mut buffer) };
    String::from_utf16_lossy(&buffer[..copied as usize])
}

#[cfg(target_os = "windows")]
fn get_window_process_name(hwnd: HWND) -> Option<String> {
    let mut process_id = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
    }

    if process_id == 0 {
        return None;
    }

    let process =
        unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()? };
    let _process_handle = HandleGuard(process);

    let mut buffer = vec![0u16; 260];
    let mut length = buffer.len() as u32;
    unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(buffer.as_mut_ptr()),
            &mut length,
        )
            .ok()?;
    }

    let path = String::from_utf16_lossy(&buffer[..length as usize]);
    Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase())
}

#[cfg(target_os = "windows")]
struct HandleGuard(HANDLE);

#[cfg(target_os = "windows")]
impl Drop for HandleGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

#[cfg(target_os = "windows")]
fn focus_window(hwnd: HWND) {
    unsafe {
        let _ = ShowWindow(hwnd, SW_RESTORE);
        let _ = SetForegroundWindow(hwnd);
    }
}

#[cfg(target_os = "windows")]
fn wait_for_login_controls(
    automation: &IUIAutomation,
    timeout: Duration,
) -> Result<LoginControls, RiotLoginError> {
    let deadline = Instant::now() + timeout;
    let mut saw_riot_window = false;

    while Instant::now() < deadline {
        let windows = find_riot_windows();
        saw_riot_window |= !windows.is_empty();

        for hwnd in windows {
            if let Some(controls) = try_find_login_controls(automation, hwnd) {
                return Ok(controls);
            }
        }

        sleep(Duration::from_millis(400));
    }

    Err(RiotLoginError::new(
        "wait_for_controls",
        "controls_not_found",
        if saw_riot_window {
            "Riot Client opened, but its login inputs never became available."
        } else {
            "Riot Client opened but no interactive Riot window stayed available long enough to automate."
        },
    ))
}

#[cfg(target_os = "windows")]
fn try_find_login_controls(automation: &IUIAutomation, hwnd: HWND) -> Option<LoginControls> {
    focus_window(hwnd);

    let window = unsafe { automation.ElementFromHandle(hwnd).ok()? };
    let control_type = variant_i32(UIA_EditControlTypeId.0);
    let condition = unsafe {
        automation
            .CreatePropertyCondition(
                windows::Win32::UI::Accessibility::UIA_ControlTypePropertyId,
                &control_type,
            )
            .ok()?
    };

    let elements = unsafe { window.FindAll(TreeScope_Descendants, &condition).ok()? };
    collect_login_controls(&elements)
}

#[cfg(target_os = "windows")]
fn collect_login_controls(elements: &IUIAutomationElementArray) -> Option<LoginControls> {
    let length = unsafe { elements.Length().ok()? };
    let mut username = None;
    let mut password = None;
    let mut fallback_fields = Vec::new();

    for index in 0..length {
        let element = unsafe { elements.GetElement(index).ok()? };
        let is_enabled = unsafe { element.CurrentIsEnabled().ok()?.as_bool() };
        if !is_enabled {
            continue;
        }

        fallback_fields.push(element.clone());

        let is_password = unsafe { element.CurrentIsPassword().ok()?.as_bool() };
        if is_password {
            if password.is_none() {
                password = Some(element);
            }
        } else if username.is_none() {
            username = Some(element);
        }

        if username.is_some() && password.is_some() {
            break;
        }
    }

    if username.is_none() && !fallback_fields.is_empty() {
        username = fallback_fields.first().cloned();
    }

    if password.is_none() && fallback_fields.len() >= 2 {
        password = fallback_fields.get(1).cloned();
    }

    Some(LoginControls {
        username: username?,
        password: password?,
    })
}

#[cfg(target_os = "windows")]
fn set_edit_value(
    element: &IUIAutomationElement,
    value: &str,
    stage: &'static str,
    code: &'static str,
) -> Result<(), RiotLoginError> {
    if try_set_with_value_pattern(element, value).is_ok() {
        return Ok(());
    }

    unsafe {
        element.SetFocus().map_err(|error| {
            RiotLoginError::new(
                stage,
                code,
                format!("Windows could not focus the Riot login field: {error}"),
            )
        })?;
    }

    sleep(Duration::from_millis(120));
    clear_active_field().map_err(|error| {
        RiotLoginError::new(
            stage,
            code,
            format!("RitoHub focused the Riot login field but could not clear it: {error}"),
        )
    })?;
    sleep(Duration::from_millis(80));
    paste_text_via_clipboard(value).map_err(|error| {
        RiotLoginError::new(
            stage,
            "send_input_failed",
            format!(
                "RitoHub reached the Riot login window but Windows blocked text entry: {error}"
            ),
        )
    })
}

#[cfg(target_os = "windows")]
fn try_set_with_value_pattern(
    element: &IUIAutomationElement,
    value: &str,
) -> Result<(), WindowsError> {
    let pattern =
        unsafe { element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)? };
    let value = BSTR::from(value);
    unsafe { pattern.SetValue(&value) }
}

#[cfg(target_os = "windows")]
fn submit_login(password_field: &IUIAutomationElement) -> Result<(), RiotLoginError> {
    unsafe {
        password_field.SetFocus().map_err(|error| {
            RiotLoginError::new(
                "submit",
                "focus_submit_failed",
                format!("RitoHub filled the login form but could not focus it for submit: {error}"),
            )
        })?;
    }

    sleep(Duration::from_millis(120));
    send_virtual_key(VK_RETURN).map_err(|error| {
        RiotLoginError::new(
            "submit",
            "send_input_failed",
            format!("RitoHub filled the login form but could not submit it: {error}"),
        )
    })
}

#[cfg(target_os = "windows")]
fn perform_heuristic_login(
    hwnd: HWND,
    username: &str,
    password: &str,
) -> Result<(), RiotLoginError> {
    focus_window(hwnd);
    sleep(Duration::from_millis(900));

    let rect = get_window_rect(hwnd).ok_or_else(|| {
        RiotLoginError::new(
            "wait_for_controls",
            "window_rect_unavailable",
            "Riot Client opened but its window bounds could not be read.",
        )
    })?;

    click_window_point(&rect, 0.5, 0.46).map_err(|error| {
        RiotLoginError::new(
            "fill_username",
            "mouse_focus_failed",
            format!("Could not focus the Riot username field: {error}"),
        )
    })?;
    sleep(Duration::from_millis(250));
    clear_active_field().map_err(|error| {
        RiotLoginError::new(
            "fill_username",
            "send_input_failed",
            format!("Could not clear the Riot username field: {error}"),
        )
    })?;
    paste_text_via_clipboard(username).map_err(|error| {
        RiotLoginError::new(
            "fill_username",
            "send_input_failed",
            format!("Could not type the Riot username: {error}"),
        )
    })?;

    sleep(Duration::from_millis(250));
    click_window_point(&rect, 0.5, 0.58).map_err(|error| {
        RiotLoginError::new(
            "fill_password",
            "mouse_focus_failed",
            format!("Could not focus the Riot password field: {error}"),
        )
    })?;
    sleep(Duration::from_millis(250));
    clear_active_field().map_err(|error| {
        RiotLoginError::new(
            "fill_password",
            "send_input_failed",
            format!("Could not clear the Riot password field: {error}"),
        )
    })?;
    paste_text_via_clipboard(password).map_err(|error| {
        RiotLoginError::new(
            "fill_password",
            "send_input_failed",
            format!("Could not type the Riot password: {error}"),
        )
    })?;

    sleep(Duration::from_millis(250));
    send_virtual_key(VK_RETURN).map_err(|error| {
        RiotLoginError::new(
            "submit",
            "send_input_failed",
            format!("RitoHub filled the login form but could not submit it: {error}"),
        )
    })
}

#[cfg(target_os = "windows")]
fn perform_tab_navigation_login(
    hwnd: HWND,
    username: &str,
    password: &str,
) -> Result<(), RiotLoginError> {
    focus_window(hwnd);
    sleep(Duration::from_millis(900));

    let rect = get_window_rect(hwnd).ok_or_else(|| {
        RiotLoginError::new(
            "wait_for_controls",
            "window_rect_unavailable",
            "Riot Client opened but its window bounds could not be read.",
        )
    })?;

    click_window_point(&rect, 0.5, 0.5).map_err(|error| {
        RiotLoginError::new(
            "wait_for_controls",
            "mouse_focus_failed",
            format!("Could not focus the Riot login surface: {error}"),
        )
    })?;
    sleep(Duration::from_millis(250));

    for initial_tabs in 0..=4 {
        focus_window(hwnd);
        sleep(Duration::from_millis(150));

        click_window_point(&rect, 0.5, 0.5).map_err(|error| {
            RiotLoginError::new(
                "wait_for_controls",
                "mouse_focus_failed",
                format!("Could not focus the Riot login surface: {error}"),
            )
        })?;
        sleep(Duration::from_millis(150));

        send_tab_presses(initial_tabs).map_err(|error| {
            RiotLoginError::new(
                "wait_for_controls",
                "send_input_failed",
                format!("Could not navigate to the Riot username field: {error}"),
            )
        })?;
        clear_active_field().map_err(|error| {
            RiotLoginError::new(
                "fill_username",
                "send_input_failed",
                format!("Could not clear the Riot username field: {error}"),
            )
        })?;
        paste_text_via_clipboard(username).map_err(|error| {
            RiotLoginError::new(
                "fill_username",
                "send_input_failed",
                format!("Could not type the Riot username: {error}"),
            )
        })?;

        sleep(Duration::from_millis(120));
        send_virtual_key(VK_TAB).map_err(|error| {
            RiotLoginError::new(
                "fill_password",
                "send_input_failed",
                format!("Could not navigate to the Riot password field: {error}"),
            )
        })?;
        sleep(Duration::from_millis(120));
        clear_active_field().map_err(|error| {
            RiotLoginError::new(
                "fill_password",
                "send_input_failed",
                format!("Could not clear the Riot password field: {error}"),
            )
        })?;
        paste_text_via_clipboard(password).map_err(|error| {
            RiotLoginError::new(
                "fill_password",
                "send_input_failed",
                format!("Could not type the Riot password: {error}"),
            )
        })?;

        sleep(Duration::from_millis(120));
        if send_virtual_key(VK_RETURN).is_ok() {
            return Ok(());
        }
    }

    Err(RiotLoginError::new(
        "submit",
        "send_input_failed",
        "RitoHub focused the Riot window but could not navigate and submit the login form.",
    ))
}

#[cfg(target_os = "windows")]
fn paste_text_via_clipboard(value: &str) -> Result<(), String> {
    set_clipboard_unicode_text(value)?;
    sleep(Duration::from_millis(80));
    send_key_chord(&[VK_CONTROL], VIRTUAL_KEY(0x56))?;
    sleep(Duration::from_millis(120));
    let _ = clear_clipboard_contents();
    Ok(())
}

#[cfg(target_os = "windows")]
fn set_clipboard_unicode_text(value: &str) -> Result<(), String> {
    open_clipboard_with_retry()?;

    unsafe {
        EmptyClipboard().map_err(|error| format!("Failed to clear the clipboard: {error}"))?;
    }

    let utf16 = value
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let bytes = utf16.len() * std::mem::size_of::<u16>();
    let handle = unsafe { GlobalAlloc(GMEM_MOVEABLE, bytes) }
        .map_err(|error| format!("Failed to allocate clipboard memory: {error}"))?;

    let mut should_free_handle = true;

    let result = unsafe {
        let locked = GlobalLock(handle);
        if locked.is_null() {
            Err("Failed to lock clipboard memory.".to_string())
        } else {
            std::ptr::copy_nonoverlapping(utf16.as_ptr() as *const u8, locked.cast(), bytes);
            let _ = GlobalUnlock(handle);

            SetClipboardData(CF_UNICODETEXT.0 as u32, Some(HANDLE(handle.0)))
                .map_err(|error| format!("Failed to place text on the clipboard: {error}"))?;
            should_free_handle = false;
            Ok(())
        }
    };

    let close_result = unsafe {
        CloseClipboard().map_err(|error| format!("Failed to close the clipboard: {error}"))
    };

    if should_free_handle {
        unsafe {
            let _ = GlobalFree(Some(handle));
        }
    }

    result?;
    close_result?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_clipboard_contents() -> Result<(), String> {
    open_clipboard_with_retry()?;

    unsafe {
        EmptyClipboard().map_err(|error| format!("Failed to clear the clipboard: {error}"))?;
        CloseClipboard().map_err(|error| format!("Failed to close the clipboard: {error}"))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn open_clipboard_with_retry() -> Result<(), String> {
    for _ in 0..10 {
        if unsafe { OpenClipboard(Some(HWND(std::ptr::null_mut()))) }.is_ok() {
            return Ok(());
        }

        sleep(Duration::from_millis(40));
    }

    Err("The Windows clipboard was busy.".to_string())
}

#[cfg(target_os = "windows")]
fn send_tab_presses(count: usize) -> Result<(), String> {
    for _ in 0..count {
        send_virtual_key(VK_TAB)?;
        sleep(Duration::from_millis(80));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_active_field() -> Result<(), String> {
    send_key_chord(&[VK_CONTROL], VIRTUAL_KEY(0x41))?;
    sleep(Duration::from_millis(80));
    send_virtual_key(VK_BACK)
}

#[cfg(target_os = "windows")]
fn send_key_chord(modifiers: &[VIRTUAL_KEY], key: VIRTUAL_KEY) -> Result<(), String> {
    let mut inputs = Vec::with_capacity(modifiers.len() * 2 + 2);

    for modifier in modifiers {
        inputs.push(key_input_virtual(*modifier, KEYBD_EVENT_FLAGS(0)));
    }

    inputs.push(key_input_virtual(key, KEYBD_EVENT_FLAGS(0)));
    inputs.push(key_input_virtual(key, KEYEVENTF_KEYUP));

    for modifier in modifiers.iter().rev() {
        inputs.push(key_input_virtual(*modifier, KEYEVENTF_KEYUP));
    }

    send_inputs(&inputs)
}

#[cfg(target_os = "windows")]
fn send_virtual_key(key: VIRTUAL_KEY) -> Result<(), String> {
    let inputs = [
        key_input_virtual(key, KEYBD_EVENT_FLAGS(0)),
        key_input_virtual(key, KEYEVENTF_KEYUP),
    ];

    send_inputs(&inputs)
}

#[cfg(target_os = "windows")]
fn get_window_rect(hwnd: HWND) -> Option<windows::Win32::Foundation::RECT> {
    let mut rect = windows::Win32::Foundation::RECT::default();
    unsafe { GetWindowRect(hwnd, &mut rect).ok()? };
    Some(rect)
}

#[cfg(target_os = "windows")]
fn click_window_point(
    rect: &windows::Win32::Foundation::RECT,
    x_ratio: f32,
    y_ratio: f32,
) -> Result<(), String> {
    let width = rect.right - rect.left;
    let height = rect.bottom - rect.top;

    if width <= 0 || height <= 0 {
        return Err("The Riot window has invalid bounds.".to_string());
    }

    let x = rect.left + ((width as f32) * x_ratio).round() as i32;
    let y = rect.top + ((height as f32) * y_ratio).round() as i32;

    unsafe {
        SetCursorPos(x, y).map_err(|error| format!("Failed to move the mouse cursor: {error}"))?;
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn send_inputs(inputs: &[INPUT]) -> Result<(), String> {
    let sent = unsafe { SendInput(inputs, std::mem::size_of::<INPUT>() as i32) };

    if sent != inputs.len() as u32 {
        return Err(format!(
            "SendInput sent {sent} of {} keyboard events.",
            inputs.len()
        ));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn key_input_virtual(key: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(target_os = "windows")]
fn variant_i32(value: i32) -> VARIANT {
    VARIANT {
        Anonymous: VARIANT_0 {
            Anonymous: std::mem::ManuallyDrop::new(VARIANT_0_0 {
                vt: VT_I4,
                wReserved1: 0,
                wReserved2: 0,
                wReserved3: 0,
                Anonymous: VARIANT_0_0_0 { lVal: value },
            }),
        },
    }
}
