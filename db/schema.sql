-- Fault Tree Escape Room — MySQL schema
-- Run once: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS escaperoomrca
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE escaperoomrca;

-- Each game session. scenario_json stores the Gemini-generated ETA (with answers).
CREATE TABLE IF NOT EXISTS games (
  id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  code       CHAR(6)          NOT NULL,
  status     ENUM('waiting','active','paused','ended') NOT NULL DEFAULT 'waiting',
  scenario_json LONGTEXT      NOT NULL,
  created_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP        NULL,
  ended_at   TIMESTAMP        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_code (code)
) ENGINE=InnoDB;

-- One row per student per game.
CREATE TABLE IF NOT EXISTS players (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id      INT UNSIGNED NOT NULL,
  name         VARCHAR(100) NOT NULL,
  joined_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  escaped_at   TIMESTAMP    NULL,
  total_penalty_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Teacher accounts. Passwords stored as bcrypt hashes.
-- Use GET /api/auth.php?action=setup to create the first account.
CREATE TABLE IF NOT EXISTS teachers (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  username      VARCHAR(100)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB;

-- Per-player progress on each hidden node.
CREATE TABLE IF NOT EXISTS node_progress (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  player_id   INT UNSIGNED  NOT NULL,
  node_id     VARCHAR(20)   NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  hints_used  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  revealed_at TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_node (player_id, node_id),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;
