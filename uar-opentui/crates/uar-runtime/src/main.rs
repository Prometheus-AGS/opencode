use anyhow::{Context, Result};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::{io::{AsyncBufReadExt, AsyncWriteExt, BufReader}, sync::{mpsc, Mutex}};
use tokio_util::sync::CancellationToken;
use tracing_subscriber::EnvFilter;
use uar_protocol::{new_id, Role, RuntimeEvent, UiCommand};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::from_default_env()).with_writer(std::io::stderr).init();
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<RuntimeEvent>();
    let cancellations = Arc::new(Mutex::new(HashMap::<String, CancellationToken>::new()));
    tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();
        while let Some(event) = event_rx.recv().await {
            let mut bytes = serde_json::to_vec(&event).expect("runtime event must serialize");
            bytes.push(b'\n');
            if stdout.write_all(&bytes).await.is_err() || stdout.flush().await.is_err() { break; }
        }
    });
    let stdin = BufReader::new(tokio::io::stdin());
    let mut lines = stdin.lines();
    while let Some(line) = lines.next_line().await.context("read command")? {
        let command: UiCommand = match serde_json::from_str(&line) {
            Ok(command) => command,
            Err(error) => { let _ = event_tx.send(RuntimeEvent::Error { message: error.to_string() }); continue; }
        };
        match command {
            UiCommand::Initialize { .. } => event_tx.send(RuntimeEvent::Ready { runtime_version: env!("CARGO_PKG_VERSION").into(), session_id: new_id() })?,
            UiCommand::CreateSession => event_tx.send(RuntimeEvent::SessionCreated { session_id: new_id() })?,
            UiCommand::SubmitPrompt { session_id, content } => {
                let message_id = new_id();
                let token = CancellationToken::new();
                cancellations.lock().await.insert(session_id.clone(), token.clone());
                let tx = event_tx.clone();
                let map = cancellations.clone();
                tokio::spawn(async move {
                    let _ = tx.send(RuntimeEvent::MessageStarted { message_id: message_id.clone(), role: Role::Assistant });
                    let response = format!("UAR received: **{}**\n\nThe Rust runtime is connected and streaming through the OpenTUI client. Replace this demo response with the production UAR agent adapter next.", content.trim());
                    for word in response.split_inclusive(' ') {
                        tokio::select! {
                            _ = token.cancelled() => { let _ = tx.send(RuntimeEvent::TurnCancelled { session_id: session_id.clone() }); map.lock().await.remove(&session_id); return; }
                            _ = tokio::time::sleep(Duration::from_millis(28)) => { let _ = tx.send(RuntimeEvent::TextDelta { message_id: message_id.clone(), text: word.into() }); }
                        }
                    }
                    let _ = tx.send(RuntimeEvent::TurnCompleted { message_id });
                    map.lock().await.remove(&session_id);
                });
            }
            UiCommand::CancelTurn { session_id } => { if let Some(token) = cancellations.lock().await.remove(&session_id) { token.cancel(); } }
            UiCommand::LoadSession { .. } => {}
            UiCommand::Shutdown => break,
        }
    }
    Ok(())
}
