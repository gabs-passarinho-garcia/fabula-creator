use std::fs;
use std::path::PathBuf;
use tauri::Manager;

mod database;
use database::{CharacterDatabase, SavedCharacter};

struct DbState {
  db_path: PathBuf,
}

#[tauri::command]
fn save_character(
  state: tauri::State<'_, DbState>,
  name: String,
  sheet_json: String,
) -> Result<i64, String> {
  CharacterDatabase::open(&state.db_path)?.save(&name, &sheet_json)
}

#[tauri::command]
fn load_characters(state: tauri::State<'_, DbState>) -> Result<Vec<SavedCharacter>, String> {
  CharacterDatabase::open(&state.db_path)?.load()
}

#[tauri::command]
fn delete_character(state: tauri::State<'_, DbState>, id: i64) -> Result<(), String> {
  CharacterDatabase::open(&state.db_path)?.delete(id)
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

      CharacterDatabase::open(&db_path)?;

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
