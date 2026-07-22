use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SavedCharacter {
  pub id: i64,
  pub name: String,
  pub created_at: String,
  pub sheet_json: String,
}

pub struct CharacterDatabase {
  path: PathBuf,
}

impl CharacterDatabase {
  pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
    let path = path.as_ref().to_path_buf();
    let database = Self { path };
    database.initialize_schema()?;
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
        sheet_json TEXT NOT NULL
      )",
      [],
    ).map_err(|error| error.to_string())?;
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

  pub fn load(&self) -> Result<Vec<SavedCharacter>, String> {
    let connection = self.connection()?;
    let mut statement = connection
      .prepare("SELECT id, name, created_at, sheet_json FROM characters ORDER BY id DESC")
      .map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| {
      Ok(SavedCharacter {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
        sheet_json: row.get(3)?,
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
}

#[cfg(test)]
mod tests {
  use super::CharacterDatabase;
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
    database.delete(id).unwrap();
    assert!(database.load().unwrap().is_empty());
    let _ = fs::remove_file(path);
  }
}