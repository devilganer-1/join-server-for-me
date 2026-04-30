const express = require("express");
const fetch = require("node-fetch");
const { Pool } = require("pg");

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

/* PostgreSQL connection */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* create table */

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL
      );
    `);
    console.log("Database ready");
  } catch (err) {
    console.error("Database init error:", err);
  }
})();

/* homepage route (fixes Cannot GET /) */

app.get("/", (req, res) => {
  res.send("OAuth server running");
});

/* stats route */

app.get("/stats", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM users");
    res.send(`Authorized users: ${result.rows[0].count}`);
  } catch (err) {
    console.error(err);
    res.send("Stats error");
  }
});

/* callback route */

app.get("/callback", async (req, res) => {

  const code = req.query.code;

  if (!code) {
    return res.send("Missing OAuth code");
  }

  try {

    const params = new URLSearchParams();

params.append("client_id", CLIENT_ID);
params.append("client_secret", CLIENT_SECRET);
params.append("grant_type", "authorization_code");
params.append("code", code);
params.append(
  "redirect_uri",
  "https://join-server-for-me-production.up.railway.app/callback"
);

    const tokenRes = await fetch(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        body: params,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.log("Token exchange failed:", tokenData);
      return res.send("OAuth failed (token exchange)");
    }

    const userRes = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    const user = await userRes.json();

    await pool.query(
      "INSERT INTO users (id, access_token) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [user.id, tokenData.access_token]
    );

    res.send("Authorization successful");

  } catch (err) {

    console.error("Callback error:", err);

    res.send("OAuth failed (server error)");

  }

});

app.listen(process.env.PORT || 3000);
