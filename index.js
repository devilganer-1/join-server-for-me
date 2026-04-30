const express = require("express");
const fetch = require("node-fetch");
const { Pool } = require("pg");

const app = express();

/* ENV VARIABLES FROM RAILWAY */

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;


/* DATABASE CONNECTION */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});


/* CREATE TABLE IF NOT EXISTS */

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
    console.error("Database error:", err);
  }
})();


/* HOMEPAGE ADMIN PANEL */

app.get("/", async (req, res) => {

  const result = await pool.query(
    "SELECT COUNT(*) FROM users"
  );

  res.send(`
    <h2>Discord OAuth Admin Panel</h2>

    <p>Authorized users: ${result.rows[0].count}</p>

    <form action="/join">
      Invite Code:
      <input name="code" placeholder="abc123">
      <button>Join Server</button>
    </form>

    <br>

    <a href="/stats">View Stats</a>
  `);

});


/* SHOW USER COUNT */

app.get("/stats", async (req, res) => {

  const result = await pool.query(
    "SELECT COUNT(*) FROM users"
  );

  res.send(
    `Authorized users: ${result.rows[0].count}`
  );

});


/* DISCORD CALLBACK ROUTE */

app.get("/callback", async (req, res) => {

  const code = req.query.code;

  if (!code) {
    return res.send("Missing OAuth code");
  }

  try {

    const params = new URLSearchParams();

    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", process.env.REDIRECT_URI);

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

    console.log("TOKEN:", tokenData);

    if (!tokenData.access_token) {
      return res.send(
        "OAuth failed (no access token)"
      );
    }

    const userRes = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization:
            `Bearer ${tokenData.access_token}`
        }
      }
    );

    const user = await userRes.json();

    console.log("USER:", user);

    if (!user.id) {
      return res.send(
        "OAuth failed (cannot fetch user)"
      );
    }

    await pool.query(
      "INSERT INTO users (id, access_token) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [user.id, tokenData.access_token]
    );

    res.send("Authorization successful!");

  } catch (err) {

    console.error("CALLBACK ERROR:", err);

    res.send("OAuth failed (database error)");

  }

});


/* JOIN USERS TO SERVER */

app.get("/join", async (req, res) => {

  const invite = req.query.code;

  if (!invite) {
    return res.send("Missing invite code");
  }

  const inviteData = await fetch(
    `https://discord.com/api/v10/invites/${invite}`
  );

  const json = await inviteData.json();

  if (!json.guild) {
    return res.send("Invalid invite");
  }

  const guild = json.guild.id;

  const users = await pool.query(
    "SELECT * FROM users"
  );

  let joined = 0;

  for (const user of users.rows) {

    const r = await fetch(
      `https://discord.com/api/guilds/${guild}/members/${user.id}`,
      {
        method: "PUT",
        headers: {
          Authorization:
            `Bot ${BOT_TOKEN}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          access_token:
            user.access_token
        })
      }
    );

    if (
      r.status === 201 ||
      r.status === 204
    ) {
      joined++;
    }

  }

  res.send(
    `Joined ${joined} users`
  );

});


app.listen(
  process.env.PORT || 3000,
  () => console.log("Server running")
);
