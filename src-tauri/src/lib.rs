use std::fs;
use std::path::PathBuf;
use tauri::Manager;

mod database;
use database::{CharacterDatabase, SavedCharacter};

struct DbState {
  /// Full path of the SQLite database file.
  db_path: PathBuf,
  /// Directory where hero photo files are stored (sibling `photos/` folder).
  photos_dir: PathBuf,
}

impl DbState {
  /// Resolves a stored relative photo path against the app data directory.
  fn resolve_photo(&self, relative: &str) -> PathBuf {
    self
      .db_path
      .parent()
      .map(|parent| parent.join(relative))
      .unwrap_or_else(|| PathBuf::from(relative))
  }

  /// Deletes the photo file on disk, ignoring missing files.
  fn remove_photo_file(&self, relative: &str) {
    let full = self.resolve_photo(relative);
    let _ = fs::remove_file(full);
  }
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
fn update_character(
  state: tauri::State<'_, DbState>,
  id: i64,
  name: String,
  sheet_json: String,
) -> Result<(), String> {
  CharacterDatabase::open(&state.db_path)?.update(id, &name, &sheet_json)
}

#[tauri::command]
fn delete_character(state: tauri::State<'_, DbState>, id: i64) -> Result<(), String> {
  let db = CharacterDatabase::open(&state.db_path)?;
  // Remove the photo file from disk before dropping the record.
  if let Some(relative) = db.photo_path_for_id(id)? {
    state.remove_photo_file(&relative);
  }
  db.delete(id)
}

/// Writes raw base64 image bytes as `<uuid>.jpg` under the photos directory
/// and persists the relative path on the record. Replacing a photo deletes
/// the previous file first.
#[tauri::command]
fn save_character_photo(
  state: tauri::State<'_, DbState>,
  id: i64,
  base64_data: String,
) -> Result<(), String> {
  use base64::Engine;

  let db = CharacterDatabase::open(&state.db_path)?;
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(base64_data.trim())
    .map_err(|e| format!("invalid base64 image data: {e}"))?;
  if bytes.is_empty() {
    return Err("empty image data".to_string());
  }

  // Replacing a photo deletes the old file before writing the new one.
  if let Some(previous) = db.photo_path_for_id(id)? {
    state.remove_photo_file(&previous);
  }

  // Timestamp-based unique file name (V1; no uuid crate needed).
  let unique = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map_err(|e| e.to_string())?
    .as_nanos();
  let relative = format!("photos/hero-{id}-{unique}.jpg");
  let full = state.photos_dir.join(format!("hero-{id}-{unique}.jpg"));
  fs::write(&full, &bytes).map_err(|e| e.to_string())?;

  db.save_photo_path(id, &relative)
}

/// Clears the stored photo path and deletes the file from disk.
#[tauri::command]
fn delete_character_photo(
  state: tauri::State<'_, DbState>,
  id: i64,
) -> Result<(), String> {
  let db = CharacterDatabase::open(&state.db_path)?;
  if let Some(relative) = db.clear_photo_path(id)? {
    state.remove_photo_file(&relative);
  }
  Ok(())
}

/// Returns the photo as a data URI (base64), or `None` when there is no photo
/// or the file no longer exists on disk.
#[tauri::command]
fn get_character_photo(
  state: tauri::State<'_, DbState>,
  id: i64,
) -> Result<Option<String>, String> {
  use base64::Engine;

  let db = CharacterDatabase::open(&state.db_path)?;
  let photo_path = db.photo_path_for_id(id)?;
  match photo_path {
    None => Ok(None),
    Some(relative) => {
      let full = state.resolve_photo(&relative);
      if !full.exists() {
        // The record references a photo that no longer exists on disk.
        // Return None so the frontend can render the fallback placeholder.
        return Ok(None);
      }
      let bytes = fs::read(&full).map_err(|e| e.to_string())?;
      let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
      Ok(Some(format!("data:image/jpeg;base64,{encoded}")))
    }
  }
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

      // Ensure the photos directory exists for the current app data folder.
      let photos_dir = app_dir.join("photos");
      fs::create_dir_all(&photos_dir).map_err(|e| e.to_string())?;

      app.manage(DbState {
        db_path: db_path.clone(),
        photos_dir,
      });

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
      update_character,
      delete_character,
      save_character_photo,
      delete_character_photo,
      get_character_photo
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
