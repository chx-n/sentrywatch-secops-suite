use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct BackendState {
    pub process: Mutex<Option<Child>>,
}

impl BackendState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }

    pub fn start(&self) {
        let mut proc_guard = self.process.lock().unwrap();
        if proc_guard.is_some() {
            return;
        }

        // Spawn Python FastAPI server in background
        #[cfg(target_os = "windows")]
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let mut cmd = Command::new("python");
        cmd.args(["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000"])
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        match cmd.spawn() {
            Ok(child) => {
                println!("[SentryWatch Desktop] Python backend spawned with PID: {}", child.id());
                *proc_guard = Some(child);
            }
            Err(e) => {
                eprintln!("[SentryWatch Desktop] Failed to spawn Python backend: {}. Using simulated/existing server.", e);
            }
        }
    }

    pub fn stop(&self) {
        let mut proc_guard = self.process.lock().unwrap();
        if let Some(mut child) = proc_guard.take() {
            println!("[SentryWatch Desktop] Terminating Python backend PID: {}...", child.id());
            let _ = child.kill();
            let _ = child.wait();
            println!("[SentryWatch Desktop] Python backend stopped.");
        }
    }
}

#[tauri::command]
pub fn check_backend_running(app: AppHandle) -> bool {
    let state = app.state::<BackendState>();
    let is_running = state.process.lock().unwrap().is_some();
    is_running
}
