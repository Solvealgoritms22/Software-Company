use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub struct Subprocesses {
    pub backend: Option<Child>,
    pub db: Option<Child>,
}

impl Drop for Subprocesses {
    fn drop(&mut self) {
        log_diagnostics("--- Deteniendo subprocesos (Drop) ---");
        if let Some(mut child) = self.backend.take() {
            log_diagnostics("Matando backend process...");
            let _ = child.kill();
        }
        if let Some(mut child) = self.db.take() {
            log_diagnostics("Matando database process...");
            let _ = child.kill();
        }
    }
}

fn log_diagnostics(message: &str) {
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let log_dir = PathBuf::from(local_app_data).join("DevFoundry");
        let _ = std::fs::create_dir_all(&log_dir);
        let log_file = log_dir.join("launch.log");
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_file) {
            let _ = writeln!(file, "{}", message);
        }
    }
}

pub fn spawn_services(app: &tauri::App) -> Subprocesses {
    log_diagnostics("--- Iniciando spawn_services ---");

    // ── 1. Desplegar .env a AppData si aún no existe ─────────────────────────────
    let mut local_env_dir = None;
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let data_dir = PathBuf::from(&local_app_data).join("DevFoundry");
        let _ = std::fs::create_dir_all(&data_dir);
        let target_env = data_dir.join(".env");
        local_env_dir = Some(data_dir.clone());

        if !target_env.exists() {
            let mut env_src: Option<PathBuf> = None;

            if let Ok(resource_dir) = app.path().resource_dir() {
                let p = resource_dir.join(".env.production");
                if p.exists() { env_src = Some(p); }
            }

            if env_src.is_none() {
                if let Ok(current_exe) = std::env::current_exe() {
                    if let Some(parent) = current_exe.parent() {
                        let p = parent.join(".env.production");
                        if p.exists() { env_src = Some(p); }
                    }
                }
            }

            if let Some(src) = env_src {
                match std::fs::copy(&src, &target_env) {
                    Ok(_) => log_diagnostics(&format!(".env copiado desde {:?} -> {:?}", src, target_env)),
                    Err(e) => log_diagnostics(&format!("ERROR copiando .env: {:?}", e)),
                }
            } else {
                log_diagnostics("ADVERTENCIA: No se encontró .env.production para desplegar.");
            }
        } else {
            log_diagnostics(".env ya existe en AppData.");
        }
    }

    // ── 2. Buscar rutas de los ejecutables de producción ─────────────────────────
    let mut backend_candidates = Vec::new();
    let mut node_candidates = Vec::new();
    let mut pglite_script_candidates = Vec::new();

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            backend_candidates.push(parent.join("bin").join("devfoundry-backend.exe"));
            node_candidates.push(parent.join("bin").join("node.exe"));
            pglite_script_candidates.push(parent.join("knowledge_base").join("pglite").join("server.mjs"));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        backend_candidates.push(resource_dir.join("bin").join("devfoundry-backend.exe"));
        node_candidates.push(resource_dir.join("bin").join("node.exe"));
        pglite_script_candidates.push(resource_dir.join("knowledge_base").join("pglite").join("server.mjs"));
    }

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let df_dir = PathBuf::from(local_app_data).join("DevFoundry");
        backend_candidates.push(df_dir.join("bin").join("devfoundry-backend.exe"));
        node_candidates.push(df_dir.join("bin").join("node.exe"));
        pglite_script_candidates.push(df_dir.join("knowledge_base").join("pglite").join("server.mjs"));
    }

    let backend_exe = backend_candidates.into_iter().find(|c| c.exists());
    let node_exe = node_candidates.into_iter().find(|c| c.exists());
    let pglite_script = pglite_script_candidates.into_iter().find(|c| c.exists());

    // ── 3. Lanzar Procesos ───────────────────────────────────────────────────────
    let mut db_child = None;
    let mut backend_child = None;

    // A. Lanzar PGlite Database
    if let (Some(node), Some(script)) = (&node_exe, &pglite_script) {
        log_diagnostics(&format!("Iniciando PGlite con node={:?}, script={:?}", node, script));
        let mut cmd = Command::new(node);
        cmd.arg(script);
        if let Some(ref env_dir) = local_env_dir {
            let db_path = env_dir.join("data").join("factory");
            let marker_file = env_dir.join("data").join(".migrated_dev_data");

            if !marker_file.exists() {
                log_diagnostics("Marcador de migración no encontrado. Buscando base de datos de desarrollo...");
                let mut dev_db_opt = None;
                if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
                    let dev_db = PathBuf::from(&local_app_data).join("Software-Company").join("db");
                    if dev_db.exists() {
                        dev_db_opt = Some(dev_db);
                    }
                }

                if let Some(src) = dev_db_opt {
                    log_diagnostics(&format!("Migrando base de datos de desarrollo desde {:?}", src));
                    let _ = std::fs::remove_dir_all(&db_path); // Limpiar base de datos vacía
                    match copy_dir_all(&src, &db_path) {
                        Ok(_) => {
                            log_diagnostics(&format!("Base de datos de desarrollo copiada -> {:?}", db_path));
                            let pid_file = db_path.join("postmaster.pid");
                            if pid_file.exists() {
                                let _ = std::fs::remove_file(pid_file);
                            }
                            // Crear marcador
                            if let Ok(_) = std::fs::File::create(&marker_file) {
                                log_diagnostics("Marcador .migrated_dev_data creado.");
                            }
                        }
                        Err(e) => log_diagnostics(&format!("ERROR migrando base de datos de desarrollo: {:?}", e)),
                    }
                } else {
                    // Si no hay base de datos de desarrollo, intentar copiar desde recursos si la BD no existe
                    if !db_path.exists() {
                        log_diagnostics("Base de datos de producción no existe y no se encontró base de datos de desarrollo. Migrando base de datos de recursos...");
                        let mut db_src: Option<PathBuf> = None;

                        if let Ok(resource_dir) = app.path().resource_dir() {
                            let p = resource_dir.join("knowledge_base").join("pglite").join("data");
                            if p.exists() { db_src = Some(p); }
                        }

                        if db_src.is_none() {
                            if let Ok(current_exe) = std::env::current_exe() {
                                if let Some(parent) = current_exe.parent() {
                                    let p = parent.join("knowledge_base").join("pglite").join("data");
                                    if p.exists() { db_src = Some(p); }
                                }
                            }
                        }

                        if let Some(src) = db_src {
                            match copy_dir_all(&src, &db_path) {
                                Ok(_) => {
                                    log_diagnostics(&format!("Base de datos de recursos copiada -> {:?}", db_path));
                                    let pid_file = db_path.join("postmaster.pid");
                                    if pid_file.exists() {
                                        let _ = std::fs::remove_file(pid_file);
                                    }
                                }
                                Err(e) => log_diagnostics(&format!("ERROR migrando base de datos de recursos: {:?}", e)),
                            }
                        }
                    }
                    // Crear marcador de todas formas para no reintentar
                    let _ = std::fs::File::create(&marker_file);
                }
            } else if !db_path.exists() {
                log_diagnostics("Marcador existe pero base de datos no. Creando base de datos vacía.");
                let _ = std::fs::create_dir_all(&db_path);
            }
            cmd.env("PGLITE_DB_PATH", db_path.to_string_lossy().to_string());
            cmd.env("PGLITE_PORT", "5432");
            cmd.env("PGLITE_HOST", "127.0.0.1");
            log_diagnostics(&format!("Base de datos configurada en PGLITE_DB_PATH={:?}", db_path));
        }

        cmd.stdout(Stdio::null()).stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        match cmd.spawn() {
            Ok(child) => {
                log_diagnostics("Database iniciada correctamente.");
                db_child = Some(child);
            }
            Err(e) => {
                log_diagnostics(&format!("ERROR iniciando database: {:?}", e));
            }
        }
    } else {
        // Fallback de desarrollo para Database
        log_diagnostics("No se encontró node.exe/server.mjs en producción. Usando fallback de desarrollo...");
        let Some(root) = repo_root() else {
            log_diagnostics("ERROR: No se encontró la raíz del repositorio.");
            return Subprocesses { backend: None, db: None };
        };
        let dev_script = root.join("knowledge_base").join("pglite").join("server.mjs");
        if dev_script.exists() {
            let mut cmd = Command::new("node");
            cmd.arg(&dev_script)
               .current_dir(&root)
               .stdout(Stdio::null())
               .stderr(Stdio::null());

            if let Some(ref env_dir) = local_env_dir {
                let db_path = env_dir.join("data").join("factory");
                let _ = std::fs::create_dir_all(&db_path);
                cmd.env("PGLITE_DB_PATH", db_path.to_string_lossy().to_string());
            }

            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000);
            }

            match cmd.spawn() {
                Ok(child) => {
                    log_diagnostics("Database (desarrollo) iniciada correctamente.");
                    db_child = Some(child);
                }
                Err(e) => {
                    log_diagnostics(&format!("ERROR iniciando database (desarrollo): {:?}", e));
                }
            }
        }
    }

    // B. Lanzar Orchestrator Backend
    if let Some(backend) = &backend_exe {
        log_diagnostics(&format!("Iniciando Backend con exe={:?}", backend));
        let mut cmd = Command::new(backend);
        
        // Redirigir stdout y stderr a archivos para diagnóstico en producción
        if let Some(ref env_dir) = local_env_dir {
            let stdout_log = env_dir.join("backend_stdout.log");
            let stderr_log = env_dir.join("backend_stderr.log");
            
            if let Ok(stdout_file) = OpenOptions::new().create(true).write(true).truncate(true).open(stdout_log) {
                cmd.stdout(Stdio::from(stdout_file));
            } else {
                cmd.stdout(Stdio::null());
            }

            if let Ok(stderr_file) = OpenOptions::new().create(true).write(true).truncate(true).open(stderr_log) {
                cmd.stderr(Stdio::from(stderr_file));
            } else {
                cmd.stderr(Stdio::null());
            }
        } else {
            cmd.stdout(Stdio::null()).stderr(Stdio::null());
        }

        // Configurar directorio actual en el directorio del exe o appdata
        if let Some(ref env_dir) = local_env_dir {
            cmd.current_dir(env_dir);
        }

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        match cmd.spawn() {
            Ok(child) => {
                log_diagnostics("Backend iniciado correctamente.");
                backend_child = Some(child);
            }
            Err(e) => {
                log_diagnostics(&format!("ERROR iniciando backend: {:?}", e));
            }
        }
    } else {
        // Fallback de desarrollo para Backend
        log_diagnostics("No se encontró devfoundry-backend.exe. Usando fallback de desarrollo (.venv)...");
        if let Some(root) = repo_root() {
            let venv_python = root.join(".venv").join("Scripts").join("python.exe");
            let python_cmd = if venv_python.exists() {
                venv_python.to_string_lossy().to_string()
            } else {
                "python".to_string()
            };

            let mut cmd = Command::new(&python_cmd);
            cmd.args([
                "orchestrator/run_backend.py"
            ])
            .current_dir(&root)
            .stdout(Stdio::null())
            .stderr(Stdio::null());

            // Si hay AppData configurado, inyectar variables de entorno de producción si es necesario
            if let Some(ref env_dir) = local_env_dir {
                cmd.env("PGLITE_DB_PATH", env_dir.join("data").join("factory").to_string_lossy().to_string());
            }

            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000);
            }

            match cmd.spawn() {
                Ok(child) => {
                    log_diagnostics(&format!("Backend (desarrollo) iniciado correctamente usando {}", python_cmd));
                    backend_child = Some(child);
                }
                Err(e) => {
                    log_diagnostics(&format!("ERROR iniciando backend (desarrollo): {:?}", e));
                }
            }
        }
    }

    Subprocesses {
        backend: backend_child,
        db: db_child,
    }
}

fn repo_root() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    loop {
        if dir.join("orchestrator").join("run_backend.py").exists() {
            return Some(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}
