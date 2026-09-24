use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

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

        // Find project root containing pyproject.toml
        let mut project_root = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        for _ in 0..4 {
            if project_root.join("pyproject.toml").exists() {
                break;
            }
            if let Some(parent) = project_root.parent() {
                project_root = parent.to_path_buf();
            } else {
                break;
            }
        }

        // Prefer .venv python in project_root, then python3.13, then fallback
        let venv_python = if cfg!(target_os = "windows") {
            project_root.join(".venv").join("Scripts").join("python.exe")
        } else {
            project_root.join(".venv").join("bin").join("python")
        };

        let python_bin = if venv_python.exists() {
            venv_python.to_string_lossy().to_string()
        } else if std::path::Path::new("/usr/bin/python3.13").exists() {
            "/usr/bin/python3.13".to_string()
        } else if cfg!(target_os = "windows") {
            "python".to_string()
        } else {
            "python3".to_string()
        };

        println!("[SentryWatch Desktop] Starting backend from {:?} with python {:?}", project_root, python_bin);

        let mut cmd = Command::new(&python_bin);
        cmd.current_dir(&project_root);
        cmd.args(["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000"]);
        cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());

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
                eprintln!("[SentryWatch Desktop] Failed to spawn Python backend: {}. Using existing/simulated server.", e);
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
pub fn check_backend_running(state: tauri::State<std::sync::Arc<BackendState>>) -> bool {
    state.process.lock().unwrap().is_some()
}
