import NodeCache from 'node-cache'
import { s3AuthState } from '.'
import makeWASocket, { AnyMessageContent, DisconnectReason, fetchLatestBaileysVersion, isJidBroadcast, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys'
import logger from './logger'
const msgRetryCounterCache = new NodeCache()


const doReplies = !process.argv.includes('--no-reply')

async function startSock() {
  const sessionId = 'testId'
  const { state, saveCreds } = await s3AuthState({
    bucket: 'your-bucket-name',
    s3AccessKeyId: 'S3_ACCESS_KEY_ID',
    s3Region: 'S3_REGION',
    s3secretAccessKey: 'S3_SECRET_ACCESS_KEY',
  })(sessionId, false)
  const { version } = await fetchLatestBaileysVersion()


  const sock = makeWASocket({
    version,
    logger: logger as any,
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger as any),
    },
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
    shouldIgnoreJid: jid => isJidBroadcast(jid),
  })

  const sendMessageWTyping = async (msg: AnyMessageContent, jid: any) => {
    await sock.sendMessage(jid, msg)
  }

  sock.ev.process(
    async (events) => {
      if (events['connection.update']) {
        const update = events['connection.update']
        const { connection, lastDisconnect } = update as any
        if (connection === 'close') {
          if ((lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
            startSock()
          } else {
            console.log('Connection closed. You are logged out.')
          }
        }

        console.log('connection update', update)
      }

      if (events['creds.update']) {
        await saveCreds()
      }

      if (events['messages.upsert']) {
        const upsert = events['messages.upsert']
        console.log('recv messages ', JSON.stringify(upsert, undefined, 2))

        if (upsert.type === 'notify') {
          for (const msg of upsert.messages) {
            if (!msg.key.fromMe && doReplies) {
              console.log('replying to', msg.key.remoteJid)
              //await sock.readMessages([msg.key])
              //await sendMessageWTyping({ text: 'olaaaaaaaaaaaa' }, msg.key.remoteJid)
            }
          }
        }
      }
    }
  )
}

startSock()
