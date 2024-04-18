import path from 'path'
import fs from 'fs/promises'
import { BufferJSON, initAuthCreds, WAProto as proto } from '@whiskeysockets/baileys';
import { getS3Client } from './s3';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DeleteAuthKeyProps, GetAuthKeyProps, InsertOrUpdateAuthKeyProps, S3AuthStateProps } from './types';

// Function that normalize key name
const fixFileName = (file: string) => {
  if (!file) {
    return undefined;
  }
  const replacedSlash = file.replace(/\//g, '__');
  const replacedColon = replacedSlash.replace(/:/g, '-');
  return replacedColon;
};

const generateBucketKey = (sessionId: string, key: string, bucket: string) => `${bucket}/sessions/${sessionId}-${key}.json`

// Upsert session json in s3
async function insertOrUpdateAuthKey({ dataString, key, s3Props, sessionId }: InsertOrUpdateAuthKeyProps) {
  const s3Client = getS3Client(s3Props)
  const bucketKey = generateBucketKey(sessionId, key, s3Props.bucket)
  try {
    const getObjectCommand = new GetObjectCommand({ Bucket: s3Props.bucket, Key: bucketKey })
    const response = await s3Client.send(getObjectCommand)
    const keyJsonString = await response.Body?.transformToString()
    if (!keyJsonString) return
    const putObjectCommand = new PutObjectCommand({
      Bucket: s3Props.bucket,
      Key: bucketKey,
      Body: dataString
    })
    await s3Client.send(putObjectCommand)
  } catch (err: any) {
    if (err.name !== 'NoSuchKey') return
    const putObjectCommand = new PutObjectCommand({
      Bucket: s3Props.bucket,
      Key: bucketKey,
      Body: dataString
    })
    await s3Client.send(putObjectCommand)
  }
}

// Get the session in s3
export async function getAuthKey({ key, s3Props, sessionId }: GetAuthKeyProps) {
  try {
    const bucketKey = generateBucketKey(sessionId, key, s3Props.bucket)
    const s3Client = getS3Client(s3Props)
    const getObjectCommand = new GetObjectCommand({ Bucket: s3Props.bucket, Key: bucketKey })
    const response = await s3Client.send(getObjectCommand)
    const keyJsonString = await response.Body?.transformToString()
    if (!keyJsonString) return null
    return keyJsonString
  } catch (err: any) {
    return null
  }
}


// Remove session in s3
async function deleteAuthKey({ key, s3Props, sessionId }: DeleteAuthKeyProps) {
  const s3Client = getS3Client(s3Props)
  const bucketKey = generateBucketKey(sessionId, key, s3Props.bucket)
  const deleteCommand = new DeleteObjectCommand({
    Bucket: s3Props.bucket,
    Key: bucketKey
  })
  await s3Client.send(deleteCommand)
}


export const s3AuthState = (s3Props: S3AuthStateProps) => {
  return async (sessionId: string, saveOnlyCreds = false) => {
    const localFolder = path.join(process.cwd(), 'sessions', sessionId)
    const localFile = (key: string) => path.join(localFolder, (fixFileName(key) + '.json'))
    if (saveOnlyCreds) await fs.mkdir(localFolder, { recursive: true })

    async function writeData(data: string, key: string) {
      const dataString = JSON.stringify(data, BufferJSON.replacer);
      if (saveOnlyCreds && key != 'creds') {
        await fs.writeFile(localFile(key), dataString)
        return;
      }
      await insertOrUpdateAuthKey({
        sessionId,
        key,
        dataString,
        s3Props
      })
      return
    }

    async function readData(key: string) {
      try {
        let rawData: string | null = null
        if (saveOnlyCreds && key != 'creds') {
          rawData = await fs.readFile(localFile(key), { encoding: 'utf-8' })
        } else {
          rawData = await getAuthKey({
            sessionId,
            key,
            s3Props
          })
        }
        if (!rawData) return
        const parsedData = JSON.parse(rawData, BufferJSON.reviver);
        return parsedData;
      } catch (err) {
        console.log('❌ readData', (err as Error).message)
        return null;
      }
    }

    async function removeData(key: string) {
      try {
        if (saveOnlyCreds && key != 'creds') {
          await fs.unlink(localFile(key))
        } else {
          await deleteAuthKey({
            sessionId,
            key,
            s3Props
          })
        }
      } catch (err) {

      }
    }


    let creds = await readData('creds');
    if (!creds) {
      creds = initAuthCreds();
      await writeData(creds, 'creds');
    }

    return {
      state: {
        creds,
        keys: {
          get: async (type: string, ids: string[]) => {
            const data = {} as any;
            await Promise.all(ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }));
            return data;
          },
          set: async (data: any) => {
            const tasks: any[] = [];
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                const key = `${category}-${id}`;
                tasks.push(value ? writeData(value, key) : removeData(key));
              }
            }
            await Promise.all(tasks);
          }
        }
      },
      saveCreds: () => {
        return writeData(creds, 'creds');
      }
    }
  }
}
