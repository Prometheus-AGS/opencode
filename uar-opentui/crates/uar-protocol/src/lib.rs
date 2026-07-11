use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum UiCommand {
    Initialize { cwd: String },
    SubmitPrompt { session_id: String, content: String },
    CancelTurn { session_id: String },
    CreateSession,
    LoadSession { session_id: String },
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuntimeEvent {
    Ready { runtime_version: String, session_id: String },
    SessionCreated { session_id: String },
    MessageStarted { message_id: String, role: Role },
    TextDelta { message_id: String, text: String },
    TurnCompleted { message_id: String },
    TurnCancelled { session_id: String },
    Error { message: String },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    User,
    Assistant,
    System,
    Tool,
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_round_trips() {
        let command = UiCommand::SubmitPrompt {
            session_id: "session-1".into(),
            content: "hello".into(),
        };
        let json = serde_json::to_string(&command).expect("serialize");
        let decoded: UiCommand = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(command, decoded);
    }
}
