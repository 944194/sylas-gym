
require("dotenv").config();

const bcrypt = require("bcrypt");
const readline = require("readline");
const pool = require("./db");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function createOwner() {
  try {
    const username = (await ask("Enter owner username: ")).trim();
    const password = await ask("Enter a strong owner password: ");

    if (!/^[a-zA-Z0-9_.-]{3,100}$/.test(username)) {
      throw new Error("Username must be 3–100 characters.");
    }

    if (password.length < 12 || password.length > 72) {
      throw new Error("Password must be between 12 and 72 characters.");
    }

    const existing = await pool.query(
      "SELECT id FROM owners WHERE username = $1",
      [username]
    );

    if (existing.rowCount > 0) {
      throw new Error("This username already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO owners (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, created_at`,
      [username, passwordHash]
    );

    console.log("\nOwner account created successfully!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("\nOwner setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

createOwner();
