use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

struct DbState {
  db_path: PathBuf,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SavedCharacter {
  id: i64,
  name: String,
  created_at: String,
  sheet_json: String,
}

fn get_connection(db_path: &PathBuf) -> Result<Connection, String> {
  Connection::open(db_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_character(
  state: tauri::State<'_, DbState>,
  name: String,
  sheet_json: String,
) -> Result<i64, String> {
  let conn = get_connection(&state.db_path)?;
  conn.execute(
    "INSERT INTO characters (name, sheet_json) VALUES (?1, ?2)",
    params![name, sheet_json],
  )
  .map_err(|e| e.to_string())?;

  let last_id = conn.last_insert_rowid();
  Ok(last_id)
}

#[tauri::command]
fn load_characters(state: tauri::State<'_, DbState>) -> Result<Vec<SavedCharacter>, String> {
  let conn = get_connection(&state.db_path)?;
  let mut stmt = conn
    .prepare("SELECT id, name, created_at, sheet_json FROM characters ORDER BY id DESC")
    .map_err(|e| e.to_string())?;

  let rows = stmt
    .query_map([], |row| {
      Ok(SavedCharacter {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
        sheet_json: row.get(3)?,
      })
    })
    .map_err(|e| e.to_string())?;

  let mut chars = Vec::new();
  for char_res in rows {
    if let Ok(c) = char_res {
      chars.push(c);
    }
  }
  Ok(chars)
}

#[tauri::command]
fn delete_character(state: tauri::State<'_, DbState>, id: i64) -> Result<(), String> {
  let conn = get_connection(&state.db_path)?;
  conn.execute("DELETE FROM characters WHERE id = ?1", params![id])
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // Get/create app data directory
      let app_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

      fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
      let db_path = app_dir.join("fabula_characters.db");

      // Initialize database schema
      let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
      conn.execute(
        "CREATE TABLE IF NOT EXISTS characters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sheet_json TEXT NOT NULL
        )",
        [],
      )
      .map_err(|e| e.to_string())?;

      app.manage(DbState { db_path });

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      save_character,
      load_characters,
      delete_character
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
