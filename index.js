const express = require("express");
const fetch = require("node-fetch");
const { Pool } = require("pg");

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const REDIRECT_URI = process.env.REDIRECT_URI;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost")
  ? false
  : { rejectUnauthorized: false }
});


/* CREATE TABLE IF NOT EXISTS */

(async () => {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            access_token TEXT
        )
    `);

})();


/* SAVE USER AFTER AUTHORIZE */

app.get("/callback", async (req, res) => {

    const code = req.query.code;

    if (!code) return res.send("Missing OAuth code");

    try {

        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI
        });

        const tokenRes = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",
                body: params,
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );

        const tokenData = await tokenRes.json();

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

        await pool.query(
            `INSERT INTO users (id, access_token)
             VALUES ($1, $2)
             ON CONFLICT (id) DO NOTHING`,
            [user.id, tokenData.access_token]
        );

        res.send("Authorization saved!");

    } catch (err) {

        console.error(err);

        res.send("OAuth failed");

    }

});


/* JOIN USERS */

app.get("/join", async (req, res) => {

    const invite = req.query.code;

    if (!invite)
        return res.send("Missing invite");

    const inviteData = await fetch(
        `https://discord.com/api/v10/invites/${invite}`
    );

    const json = await inviteData.json();

    if (!json.guild)
        return res.send("Invalid invite");

    const guild = json.guild.id;

    const result = await pool.query(
        "SELECT * FROM users"
    );

    let joined = 0;

    for (const user of result.rows) {

        const r = await fetch(
            `https://discord.com/api/guilds/${guild}/members/${user.id}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bot ${BOT_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    access_token: user.access_token
                })
            }
        );

        if (r.status === 201 || r.status === 204)
            joined++;

    }

    res.send(`Joined ${joined} users`);

});


/* SHOW STATS */

app.get("/stats", async (req, res) => {

    const result = await pool.query(
        "SELECT COUNT(*) FROM users"
    );

    res.send(
        `Authorized users: ${result.rows[0].count}`
    );

});


/* ADMIN PANEL */

app.get("/", async (req, res) => {

    const result = await pool.query(
        "SELECT COUNT(*) FROM users"
    );

    res.send(`
        <h2>Admin Panel</h2>

        <p>Total users: ${result.rows[0].count}</p>

        <form action="/join">
            Invite Code:
            <input name="code">
            <button>Join Server</button>
        </form>

        <br>

        <a href="/stats">Refresh Stats</a>
    `);

});


app.listen(process.env.PORT || 3000);
