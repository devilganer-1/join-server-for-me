const express = require("express");
const fetch = require("node-fetch");

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.get("/callback", async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.send("❌ No code provided");
    }

    try {
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("client_secret", CLIENT_SECRET);
        params.append("grant_type", "authorization_code");
        params.append("code", code);
        params.append("redirect_uri", REDIRECT_URI);

        const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",
                body: params,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        const tokenData = await tokenResponse.json();

        const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                },
            }
        );

        const userData = await userResponse.json();

        await fetch(
            `https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bot ${BOT_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    access_token: tokenData.access_token,
                }),
            }
        );

        res.send("✅ Successfully joined the server!");
    } catch (err) {
        console.error(err);
        res.send("❌ Something went wrong.");
    }
});

app.listen(process.env.PORT || 3000, () =>
    console.log("Server running")
);
