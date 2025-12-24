import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys"
import Pino from "pino"

const PHONE_NUMBER = "6285171597960" // ← GANTI INI

async function startBot () {
  const { state, saveCreds } = await useMultiFileAuthState("auth")

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" }),
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "open") {
      console.log("✅ Socket open")

      if (!sock.authState.creds.registered) {
        try {
          const code = await sock.requestPairingCode(PHONE_NUMBER)
          console.log("🔗 PAIRING CODE:", code)
        } catch (err) {
          console.error("❌ Pairing error:", err?.output?.statusCode || err)
        }
      }
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log("❌ Connection closed. Reason:", reason)

      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 5000)
      }
    }
  })
}

startBot()
