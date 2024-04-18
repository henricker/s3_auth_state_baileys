# S3 AUTH STATE BAILEYS

## How to use ?

```ts
  const sessionId = 'testId'
  //Basically you need pass your s3 credentials and this function will return the s3 store function
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

```

# How to install?
```bash
npm install @aws-sdk/client-s3
npm install s3_auth_state_baileys
```