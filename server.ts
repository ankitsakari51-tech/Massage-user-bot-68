import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';

const API_ID = 39960956;
const API_HASH = '78f36658dc9c702a608dc71720ef7706';

const SESSION_FILE = path.join(process.cwd(), 'telegram_session.txt');
const MESSAGED_USERS_FILE = path.join(process.cwd(), 'messaged_users.json');
const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

let sessionString = '';
if (fs.existsSync(SESSION_FILE)) {
    sessionString = fs.readFileSync(SESSION_FILE, 'utf-8');
}

interface HistoryEntry {
    userId: string;
    groupId: string;
    timestamp: number;
}
let messageHistory: HistoryEntry[] = [];
let messagedUsers = new Set<string>();

if (fs.existsSync(MESSAGED_USERS_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(MESSAGED_USERS_FILE, 'utf-8'));
        if (data.length > 0 && typeof data[0] === 'string') {
            messageHistory = data.map((id: string) => ({ userId: id, groupId: 'unknown', timestamp: Date.now() }));
        } else {
            messageHistory = data;
        }
        messageHistory.forEach(h => messagedUsers.add(h.userId));
    } catch (e) {
        console.error("Error reading messaged_users.json", e);
    }
}

function saveHistory() {
    fs.writeFileSync(MESSAGED_USERS_FILE, JSON.stringify(messageHistory));
}

let settings = {
    msgText: "NEW LIKE GROUP NO ADD NO VERIFICATION 👇",
    btnText: "JOIN LIKE GROUP",
    btnLink: "https://t.me/gt1490bot"
};

let targetGroups = new Set<string>();
if (fs.existsSync(SETTINGS_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        if (data.targetGroups) targetGroups = new Set(data.targetGroups);
        if (data.msgText) settings.msgText = data.msgText;
        if (data.btnText) settings.btnText = data.btnText;
        if (data.btnLink) settings.btnLink = data.btnLink;
    } catch(e) {}
}

function saveSettings() {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ 
        targetGroups: Array.from(targetGroups),
        ...settings
    }));
}

let client: TelegramClient | null = null;
let isBotActive = false; 
let isClientConnected = false;
let logs: string[] = [];

let messagesSentCurrentWindow = 0;
let cooldownUntil = 0;
const adminCache = new Map<string, Set<string>>();

function addLog(msg: string) {
    const time = new Date().toISOString();
    logs.push(`[${time}] ${msg}`);
    if (logs.length > 100) logs.shift();
    console.log(msg);
}

async function startServer() {
    const app = express();
    const PORT = parseInt(process.env.PORT || '3000', 10);

    app.use(express.json());

    app.post('/api/auth/sendCode', async (req, res) => {
        const { phoneNumber } = req.body;
        addLog(`Sending auth code to ${phoneNumber}...`);
        
        try {
            client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
                connectionRetries: 5,
            });
            await client.connect();
            
            const result = await client.sendCode({
                apiId: API_ID,
                apiHash: API_HASH
            }, phoneNumber);

            res.json({ success: true, phoneCodeHash: result.phoneCodeHash });
        } catch (error: any) {
            addLog(`Error sending code: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/auth/login', async (req, res) => {
        const { phoneNumber, phoneCode, phoneCodeHash } = req.body;
        try {
            if (!client) throw new Error("Client not initialized. Send code first.");
            
            await client.invoke(new Api.auth.SignIn({
                phoneNumber,
                phoneCodeHash,
                phoneCode,
            }));

            sessionString = (client.session as StringSession).save();
            fs.writeFileSync(SESSION_FILE, sessionString);
            
            addLog(`Successfully logged in as ${phoneNumber}`);
            isClientConnected = true;
            setupBotEvents();

            res.json({ success: true, session: sessionString });
        } catch (error: any) {
            addLog(`Error during login: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/auth/logout', async (req, res) => {
        try {
            isBotActive = false;
            if (client) {
                await client.disconnect();
                client = null;
            }
            if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
            sessionString = '';
            isClientConnected = false;
            addLog(`Logged out.`);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/status', (req, res) => {
        res.json({
            isConnected: isClientConnected,
            isBotActive,
            sessionString: sessionString,
            totalMessaged: messagedUsers.size,
            cooldownUntil,
            messagesSentCurrentWindow,
            logs
        });
    });

    app.post('/api/auth/loginSession', async (req, res) => {
        const { sessionStr } = req.body;
        try {
            client = new TelegramClient(new StringSession(sessionStr), API_ID, API_HASH, {
                connectionRetries: 5,
            });
            await client.connect();
            
            sessionString = (client.session as StringSession).save();
            fs.writeFileSync(SESSION_FILE, sessionString);
            
            addLog(`Successfully logged in via Session String`);
            isClientConnected = true;
            isBotActive = true;
            setupBotEvents();

            res.json({ success: true });
        } catch (error: any) {
            addLog(`Error during session login: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/groups', async (req, res) => {
        if (!client || !isClientConnected) return res.status(401).json({ error: "Not connected" });
        try {
            const dialogs = await client.getDialogs({});
            const groups = dialogs.filter(d => d.isGroup || d.isChannel).map(d => ({
                id: d.entity?.id?.toString(),
                title: d.title
            })).filter(g => g.id); // Ensure ID exists
            res.json({ groups });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/settings', (req, res) => {
        res.json({
            targetGroups: Array.from(targetGroups),
            ...settings
        });
    });

    app.post('/api/settings', (req, res) => {
        const { groups, msgText, btnText, btnLink } = req.body;
        if (groups !== undefined) targetGroups = new Set(groups);
        if (msgText !== undefined) settings.msgText = msgText;
        if (btnText !== undefined) settings.btnText = btnText;
        if (btnLink !== undefined) settings.btnLink = btnLink;
        saveSettings();
        addLog(`Updated settings & message config.`);
        res.json({ success: true });
    });

    app.post('/api/bot/toggle', (req, res) => {
        const { active } = req.body;
        isBotActive = active;
        addLog(`Bot is now ${active ? 'RUNNING' : 'PAUSED'}.`);
        res.json({ success: true, isBotActive });
    });

    app.get('/api/history', (req, res) => {
        res.json({ history: messageHistory });
    });

    if (sessionString) {
        addLog("Found existing session. Starting Telegram Client...");
        client = new TelegramClient(new StringSession(sessionString), API_ID, API_HASH, {
            connectionRetries: 5,
        });
        client.connect().then(() => {
            addLog("Telegram client connected with existing session.");
            isClientConnected = true;
            setupBotEvents();
        }).catch((e) => {
            addLog(`Failed to connect with existing session: ${e.message}`);
        });
    }

    function setupBotEvents() {
        if (!client) return;

        client.addEventHandler(async (event: any) => {
            if (!isBotActive) return;
            if (!event.isGroup && !event.isChannel) return;

            try {
                const message = event.message;
                const sender = await message.getSender();
                if (!sender || sender.bot) return; 

                const userId = sender.id.toString();
                const chatId = event.chatId.toString();

                if (targetGroups.size > 0 && !targetGroups.has(chatId) && !targetGroups.has('-100' + chatId)) {
                    return; 
                }

                if (messagedUsers.has(userId)) return;

                if (Date.now() < cooldownUntil) {
                    return;
                }

                if (!adminCache.has(chatId)) {
                    try {
                        const participants = await client!.invoke(new Api.channels.GetParticipants({
                            channel: event.chatId,
                            filter: new Api.ChannelParticipantsAdmins(),
                            offset: 0,
                            limit: 100,
                            hash: 0n
                        }));
                        const admins = new Set<string>();
                        if (participants && participants.participants) {
                            participants.participants.forEach((p: any) => {
                                admins.add(p.userId.toString());
                            });
                        }
                        adminCache.set(chatId, admins);
                    } catch (e) {
                         adminCache.set(chatId, new Set());
                    }
                }

                if (adminCache.get(chatId)?.has(userId)) {
                    return;
                }

                messagesSentCurrentWindow++;
                if (messagesSentCurrentWindow >= 5) {
                    const COOLDOWN_DURATION = 20 * 60 * 1000; 
                    cooldownUntil = Date.now() + COOLDOWN_DURATION;
                    addLog(`Reached 5 messages. Bot pausing for 20 minutes...`);
                    messagesSentCurrentWindow = 0; 
                }

                const msgToSend = `${settings.msgText}\n\n[${settings.btnText}](${settings.btnLink})`;
                
                await client!.sendMessage(sender.id, {
                    message: msgToSend,
                    parseMode: "md"
                });

                messagedUsers.add(userId);
                messageHistory.push({
                    userId,
                    groupId: chatId,
                    timestamp: Date.now()
                });
                saveHistory();
                
                addLog(`Sent DM to user ID: ${userId} (from group ${chatId})`);

            } catch (err: any) {
                if (!err.message?.includes('Cannot read properties')) {
                     addLog(`Error processing message: ${err.message}`);
                }
            }
        }, new NewMessage({}));
    }

    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.join(process.cwd(), 'dist')));
        app.get('*', (req, res) => {
            res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server started on http://localhost:${PORT}`);
    });
}

startServer();
