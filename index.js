const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const REDIRECT_URI = process.env.REDIRECT_URI;

const USERS_FILE = "users.json";


function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}


/* CALLBACK ROUTE */
app.get("/callback", async (req, res) => {

    const code = req.query.code;

    if (!code)
        return res.send("Missing OAuth code");

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

        let users = loadUsers();

        if (!users.includes(user.id)) {
            users.push(user.id);
            saveUsers(users);
        }

        res.send("Authorization saved");

    } catch {

        res.send("OAuth failed");

    }
});


/* DASHBOARD PAGE */
app.get("/", (req, res) => {

    const users = loadUsers();

    res.send(`
    <h2>Admin Panel</h2>

    <p>Total authorized users: ${users.length}</p>

    <form action="/join">
        Invite Code:
        <input name="code" placeholder="abc123">
        <button>Join Server</button>
    </form>

    <br>

    <a href="/users">View User IDs</a>
    `);
});


/* JOIN SERVER ROUTE */
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

    const users = loadUsers();

    let joined = 0;

    for (const id of users) {

        const r = await fetch(
            `https://discord.com/api/guilds/${guild}/members/${id}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bot ${BOT_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        if (r.status === 201 || r.status === 204)
            joined++;
    }

    res.send(`Joined ${joined} users`);
});


/* USERS LIST */
app.get("/users", (req, res) => {

    res.json(loadUsers());

});


app.listen(process.env.PORT || 3000);
