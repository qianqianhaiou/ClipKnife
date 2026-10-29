#![windows_subsystem = "windows"]

use std::{env, fs, path::PathBuf};
use tao::{
    dpi::{LogicalPosition, LogicalSize},
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};
use wry::WebViewBuilder;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 6 {
        return Err("Usage: settings-visual URL WIDTH HEIGHT REPORT.json DATA_DIR".into());
    }
    let url = args[1].clone();
    let local_file = url.starts_with("file:///");
    let origin = if local_file {
        let root = env::var("CLIPKNIFE_DEMO_FILE_ROOT")?;
        if !root.starts_with("file:///") || !root.ends_with('/') || !url.starts_with(&root) {
            return Err("File preview must stay inside the isolated docs root".into());
        }
        root
    } else {
        ["http://127.0.0.1:41387/", "http://127.0.0.1:41388/"]
            .into_iter()
            .find(|origin| url.starts_with(*origin))
            .ok_or("Only the isolated local preview is allowed")?
            .to_owned()
    };
    let width: f64 = args[2].parse()?;
    let height: f64 = args[3].parse()?;
    let report = PathBuf::from(&args[4]);
    let data_dir = PathBuf::from(&args[5]);
    fs::create_dir_all(&data_dir)?;
    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("素刀 UI 对照 — 隔离预览")
        .with_decorations(false)
        .with_inner_size(LogicalSize::new(width, height))
        .with_position(LogicalPosition::new(0.0, 0.0))
        .build(&event_loop)?;
    let mut context = wry::WebContext::new(Some(data_dir));
    let builder = WebViewBuilder::new_with_web_context(&mut context)
        .with_url(url)
        .with_navigation_handler(move |url| url.starts_with(&origin));
    let builder = if local_file {
        let qa = fs::read_to_string(env::var("CLIPKNIFE_DEMO_QA_SCRIPT")?)?;
        // Wry 0.55 IPC assumes an HTTP URI. Title reporting avoids that parser
        // without changing file origins or disabling any WebView security checks.
        builder
            .with_initialization_script(format!("if (window.top === window) {{ {qa} }}"))
            .with_document_title_changed_handler(move |title| {
                if let Some(json) = title.strip_prefix("demo-qa:") {
                    if let Err(error) = fs::write(&report, json) {
                        eprintln!("Cannot write file preview report: {error}");
                    }
                }
            })
    } else {
        builder.with_ipc_handler(move |request| {
            if let Err(error) = fs::write(&report, request.body()) {
                eprintln!("Cannot write HTTP preview report: {error}");
            }
        })
    };
    let _webview = builder.build(&window)?;
    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            *control_flow = ControlFlow::Exit;
        }
    });
}
