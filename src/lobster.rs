use std::path::Path;

use zed_extension_api::{self as zed, serde_json, settings::LspSettings, LanguageServerId, Result};

const SERVER_ID: &str = "lobster-lsp";

// Where a Lobster source checkout keeps the built server, relative to the
// directory above `bin/lobster`.
const SERVER_SCRIPT: &str = "dev/lsp/webpack-out/lobster_lsp.js";

struct LobsterExtension;

/// The `lobster` compiler: the `executable` setting, else `lobster` on PATH.
fn lobster_executable(settings: Option<&serde_json::Value>, worktree: &zed::Worktree) -> Option<String> {
    settings
        .and_then(|s| s.get("executable"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| worktree.which("lobster"))
}

impl zed::Extension for LobsterExtension {
    fn new() -> Self {
        LobsterExtension
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let lsp = LspSettings::for_worktree(SERVER_ID, worktree)?;

        if let Some(binary) = lsp.binary.filter(|b| b.path.is_some()) {
            return Ok(zed::Command {
                command: binary.path.unwrap(),
                args: binary.arguments.unwrap_or_else(|| vec!["--stdio".into()]),
                env: binary.env.map(|e| e.into_iter().collect()).unwrap_or_default(),
            });
        }

        let executable = lobster_executable(lsp.settings.as_ref(), worktree).ok_or_else(|| {
            "lobster not found: add it to PATH or set lsp.lobster-lsp.settings.executable".to_string()
        })?;
        let root = Path::new(&executable)
            .parent()
            .and_then(Path::parent)
            .ok_or_else(|| format!("no Lobster checkout around {executable}"))?;

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![root.join(SERVER_SCRIPT).to_string_lossy().into_owned(), "--stdio".into()],
            env: Default::default(),
        })
    }

    // The server reads the `lobster` section: executable, imports, experimental.
    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<serde_json::Value>> {
        let lsp = LspSettings::for_worktree(SERVER_ID, worktree)?;
        let mut config = serde_json::json!({ "executable": "", "imports": [], "experimental": false });
        if let Some(serde_json::Value::Object(user)) = lsp.settings.clone() {
            config.as_object_mut().unwrap().extend(user);
        }
        if let Some(executable) = lobster_executable(lsp.settings.as_ref(), worktree) {
            config["executable"] = executable.into();
        }
        Ok(Some(serde_json::json!({ "lobster": config })))
    }
}

zed::register_extension!(LobsterExtension);
