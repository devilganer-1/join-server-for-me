const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const REDIRECT_URI = process.env.REDIRECT_URI;

const USERS_FILE = "users.json";

/* Load saved users */
function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

/* Save users */
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

/* OAuth callback */
app.get("/callback", async (req, res) => {

    const code = req.query.code;

    if (!code)
        return res.send("❌ No OAuth code received");

    try {

        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI
        });

        const tokenResponse = await fetch(
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

        const tokenData = await tokenResponse.json();

        const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization:
                        `Bearer ${tokenData.access_token}`
                }
            }
        );

        const user = await userResponse.json();

        let users = loadUsers();

        if (!users.includes(user.id)) {
            users.push(user.id);
            saveUsers(users);
        }

        res.send("✅ Authorization successful. Account saved!");

    } catch (err) {

        console.error(err);

        res.send("❌ Authorization failed.");

    }
});


/* Join all users using invite code */
app.get("/invitejoin", async (req, res) => {

    const invite = req.query.code;

    if (!invite)
        return res.send("Missing invite code");

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

    res.send(`✅ Joined ${joined} users to ${json.guild.name}`);

});


/* Show authorized users */
app.get("/users", (req, res) => {

    res.json(loadUsers());

});


/* Show total count */
app.get("/stats", (req, res) => {

    const users = loadUsers();

    res.send(`Authorized users: ${users.length}`);

});


/* Dashboard homepage */
app.get("/", (req, res) => {

    res.send(`
        <h2>Discord OAuth Join Panel</h2>

        <form action="/invitejoin">
            Invite Code:
            <input name="code" placeholder="abc123">
            <button>Join Server</button>
        </form>

        <br>

        <a href="/stats">View Authorized Count</a><br>
        <a href="/users">View Users List</a>
    `);

});


app.listen(process.env.PORT || 3000);
