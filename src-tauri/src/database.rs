use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SavedCharacter {
  pub id: i64,
  pub name: String,
  pub created_at: String,
  pub sheet_json: String,
  /// Relative path (from the app data dir) of the hero photo, when one exists.
  pub photo_path: Option<String>,
}

pub struct CharacterDatabase {
  path: PathBuf,
}

impl CharacterDatabase {
  pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
    let path = path.as_ref().to_path_buf();
    let database = Self { path };
    database.initialize_schema()?;
    database.migrate_schema()?;
    Ok(database)
  }

  fn connection(&self) -> Result<Connection, String> {
    Connection::open(&self.path).map_err(|error| error.to_string())
  }

  fn initialize_schema(&self) -> Result<(), String> {
    let connection = self.connection()?;
    connection.execute(
      "CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sheet_json TEXT NOT NULL,
        photo_path TEXT
      )",
      [],
    ).map_err(|error| error.to_string())?;
    Ok(())
  }

  /// Adds the `photo_path` column to databases created before the photo feature.
  fn migrate_schema(&self) -> Result<(), String> {
    let connection = self.connection()?;
    let has_photo_path = connection
      .prepare("PRAGMA table_info(characters)")
      .map_err(|error| error.to_string())?
      .query_map([], |row| row.get::<_, String>(1))
      .map_err(|error| error.to_string())?
      .filter_map(Result::ok)
      .any(|column| column == "photo_path");
    if !has_photo_path {
      connection
        .execute("ALTER TABLE characters ADD COLUMN photo_path TEXT", [])
        .map_err(|error| error.to_string())?;
    }
    Ok(())
  }

  pub fn save(&self, name: &str, sheet_json: &str) -> Result<i64, String> {
    let connection = self.connection()?;
    connection.execute(
      "INSERT INTO characters (name, sheet_json) VALUES (?1, ?2)",
      params![name, sheet_json],
    ).map_err(|error| error.to_string())?;
    Ok(connection.last_insert_rowid())
  }

  /// Overwrites an existing character, keeping its id and creation timestamp.
  pub fn update(&self, id: i64, name: &str, sheet_json: &str) -> Result<(), String> {
    let connection = self.connection()?;
    let affected = connection.execute(
      "UPDATE characters SET name = ?2, sheet_json = ?3 WHERE id = ?1",
      params![id, name, sheet_json],
    ).map_err(|error| error.to_string())?;

    if affected == 0 {
      return Err(format!("character {} not found", id));
    }
    Ok(())
  }

  pub fn load(&self) -> Result<Vec<SavedCharacter>, String> {
    let connection = self.connection()?;
    let mut statement = connection
      .prepare("SELECT id, name, created_at, sheet_json, photo_path FROM characters ORDER BY id DESC")
      .map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| {
      Ok(SavedCharacter {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
        sheet_json: row.get(3)?,
        photo_path: row.get(4)?,
      })
    }).map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
  }

  pub fn delete(&self, id: i64) -> Result<(), String> {
    let connection = self.connection()?;
    connection.execute("DELETE FROM characters WHERE id = ?1", params![id])
      .map_err(|error| error.to_string())?;
    Ok(())
  }

  /// Persists the relative photo path for a character.
  pub fn save_photo_path(&self, id: i64, photo_path: &str) -> Result<(), String> {
    let connection = self.connection()?;
    let affected = connection
      .execute(
        "UPDATE characters SET photo_path = ?2 WHERE id = ?1",
        params![id, photo_path],
      )
      .map_err(|error| error.to_string())?;
    if affected == 0 {
      return Err(format!("character {} not found", id));
    }
    Ok(())
  }

  /// Clears the stored photo path, returning the previous relative path if any.
  pub fn clear_photo_path(&self, id: i64) -> Result<Option<String>, String> {
    let connection = self.connection()?;
    let previous: Option<String> = connection
      .query_row(
        "SELECT photo_path FROM characters WHERE id = ?1",
        params![id],
        |row| row.get(0),
      )
      .map_err(|error| error.to_string())?;
    connection
      .execute(
        "UPDATE characters SET photo_path = NULL WHERE id = ?1",
        params![id],
      )
      .map_err(|error| error.to_string())?;
    Ok(previous)
  }

  /// Returns the stored relative photo path, if any.
  pub fn photo_path_for_id(&self, id: i64) -> Result<Option<String>, String> {
    let connection = self.connection()?;
    let path: Option<String> = connection
      .query_row(
        "SELECT photo_path FROM characters WHERE id = ?1",
        params![id],
        |row| row.get(0),
      )
      .map_err(|error| error.to_string())?;
    Ok(path)
  }
}

#[cfg(test)]
mod tests {
  use super::CharacterDatabase;
  use rusqlite::Connection;
  use std::fs;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn setup() -> (CharacterDatabase, std::path::PathBuf) {
    let suffix = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let path = std::env::temp_dir().join(format!("fabula-test-{suffix}.db"));
    (CharacterDatabase::open(&path).unwrap(), path)
  }

  #[test]
  fn round_trips_and_deletes_character() {
    let (database, path) = setup();
    let id = database.save("Test Hero", "{\"name\":\"Test Hero\"}").unwrap();
    let characters = database.load().unwrap();
    assert_eq!(characters.len(), 1);
    assert_eq!(characters[0].id, id);
    assert_eq!(characters[0].name, "Test Hero");
    assert_eq!(characters[0].photo_path, None);
    database.delete(id).unwrap();
    assert!(database.load().unwrap().is_empty());
    let _ = fs::remove_file(path);
  }

  #[test]
  fn updates_sheet_json_without_creating_a_new_record() {
    let (database, path) = setup();
    let id = database.save("Test Hero", "{\"level\":5}").unwrap();
    database.update(id, "Test Hero", "{\"level\":25}").unwrap();

    let characters = database.load().unwrap();
    assert_eq!(characters.len(), 1);
    assert_eq!(characters[0].id, id);
    assert_eq!(characters[0].sheet_json, "{\"level\":25}");

    assert!(database.update(id + 1, "Ghost", "{}").is_err());
    let _ = fs::remove_file(path);
  }

  #[test]
  fn photo_path_round_trips_and_clears() {
    let (database, path) = setup();
    let id = database.save("Photo Hero", "{}").unwrap();

    // No photo initially.
    assert_eq!(database.photo_path_for_id(id).unwrap(), None);

    // Save and read back.
    database.save_photo_path(id, "photos/hero.jpg").unwrap();
    assert_eq!(
      database.photo_path_for_id(id).unwrap(),
      Some("photos/hero.jpg".to_string())
    );
    let characters = database.load().unwrap();
    assert_eq!(
      characters[0].photo_path,
      Some("photos/hero.jpg".to_string())
    );

    // Clear returns the previous path and nulls the column.
    let previous = database.clear_photo_path(id).unwrap();
    assert_eq!(previous, Some("photos/hero.jpg".to_string()));
    assert_eq!(database.photo_path_for_id(id).unwrap(), None);

    let _ = fs::remove_file(path);
  }

  #[test]
  fn photo_paths_fail_for_unknown_character() {
    let (database, path) = setup();
    assert!(database.save_photo_path(999, "photos/ghost.jpg").is_err());
    assert!(database.clear_photo_path(999).is_err());
    let _ = fs::remove_file(path);
  }

  #[test]
  fn migration_adds_photo_path_column_to_legacy_database() {
    let suffix = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let path = std::env::temp_dir().join(format!("fabula-legacy-{suffix}.db"));

    // Create a legacy database with the old schema (no photo_path column).
    {
      let connection = Connection::open(&path).unwrap();
      connection
        .execute(
          "CREATE TABLE characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sheet_json TEXT NOT NULL
          )",
          [],
        )
        .unwrap();
      connection
        .execute("INSERT INTO characters (name, sheet_json) VALUES ('Legacy', '{}')", [])
        .unwrap();
    }

    // Opening with the new code migrates the schema without data loss.
    let database = CharacterDatabase::open(&path).unwrap();
    let characters = database.load().unwrap();
    assert_eq!(characters.len(), 1);
    assert_eq!(characters[0].name, "Legacy");
    assert_eq!(characters[0].photo_path, None);

    // The migrated column is usable.
    database.save_photo_path(characters[0].id, "photos/legacy.jpg").unwrap();
    assert_eq!(
      database.photo_path_for_id(characters[0].id).unwrap(),
      Some("photos/legacy.jpg".to_string())
    );

    let _ = fs::remove_file(path);
  }
}