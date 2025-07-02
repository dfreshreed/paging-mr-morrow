# Lens API Node.js Client

A Node.js client that connects to the Poly Lens GraphQL API via WebSocket, subscribes to real-time telemetry streams, and logs colorized data to the CLI.

---

## 🚀 Features

- Connects to Poly Lens GraphQL WebSocket API
- Authenticates via OAuth client credentials
- Subscribes to:
  - People Count Stream → live occupancy data for rooms
  - Device Stream → device status and telemetry
- Colorized CLI output for easy reading
- Modular code structure under utils/

---

## 📁 Project Structure

```
├── utils/
│   ├── api.js          # GraphQL API calls (fetch room IDs, etc.)
│   ├── auth.js         # OAuth token retrieval
│   ├── config.js       # Environment config
│   ├── formatter.js    # JSON color formatting for CLI
│   └── logger.js       # Colorized logging and waiting messages
├── wsClient.js         # WebSocket connection logic
├── main.js             # Entry point (AKA file you run to fire it up)
├── .env.example        # Example environment variable file
├── .gitignore          # Git ignored files
├── LICENSE             # License info
├── package.json        # NPM metadata and dependencies
├── package-lock.json   # Locked dependency versions
└── README.md
```

---

## 📦 Requirements

- Node.js >= 18+
- npm or yarn

---

## 🔑 Environment Variables

Copy `.env.example` to create a local `.env`

```bash
cp .env.example .env
```

Replace the placeholder text with your API Credentials, Tenant ID, and Site ID `.env`:

```bash
HTTP_URL=https://api.silica-prod01.io.lens.poly.com/graphql
WS_URL=wss://api.silica-prod01.io.lens.poly.com/graphql
AUTH_URL=https://login.lens.poly.com/oauth/token

CLIENT_ID=yourLensClientId
CLIENT_SECRET=yourLensClientSecret
TENANT_ID=yourLensTenantId
```

---

## 🏗️ Installation

Install dependencies:

`npm install`

---

## 🎬 Usage

Fire up the WebSocket Client:

```css
node main.js
```

You should see output like:

```bash
🔍 Requesting token with:
{
  "authEp": "https://login.lens.poly.com/oauth/token",
  "client_id": "yourClientId",
  "client_secret": "[HIDDEN]",
  "grant_type": "client_credentials"
}

🔑 Got Access Token

▶️ HTTP endpoint is: https://api.silica-prod01.io.lens.poly.com/graphql
RoomIds: 00e0db93723a,00e0db775ba0,...
🎾 Fetched 15 room IDs | cursor → ey... | hasNextPage → true

Got 32 roomIds
🛰 Connecting to WebSocket: wss://api.silica-prod01.io.lens.poly.com/graphql

⛓️ Connected to WebSocket

⏳ Waiting for next transmission...
10:13:17 PM 🤖 Incoming transmission...
10:13:17 PM Device Stream Data:
{
  "connected": true,
  "externalIp": "...",
  ...
}
⏳ Waiting for next transmission...
```

---

## 🤓 How it Works

1. Fetch OAuth token from Lens Auth Endpoint using Lens API Connection (Client Credentials)

2. Uses pagination to fetch a list of room IDs from the Lens GraphQL API

3. Connects to the Websocket API and inits the GQL Connection

4. Subscribes to:

    - peopleCountStream

    - deviceStream

5. Parses and colorizes JSON payloads. Prints to the CLI in real-time.

6. Refreshes token on expiry and automatically retries connection every 5 seconds on disconnect

---

## 🚨 Error Handling

- Token Expiry → Automatically refreshes and reconnects.

- WebSocket Disconnect → Attempts reconnection every 5 seconds.

- HTTP Errors → Logged to console for troubleshooting.

---

## 🎨 Customization

### Adjust Device IDs

For now, you'll need to manually add some deviceIds in the array. I plan to fix this by running a query and populating them like I'm doing for the `roomIds`.

Edit `wsClient.js`:

```bash
const deviceIds = [
  '00e0db93723a', //add your deviceIds here
  '00e0db775ba0',
  ...
]

```