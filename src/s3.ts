import { S3Client } from "@aws-sdk/client-s3"
import { S3ClientProps } from "./types"


export const getS3Client = ({ s3AccessKeyId, s3Region, s3secretAccessKey }: S3ClientProps) => {
  const s3 = new S3Client({
    credentials: {
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3secretAccessKey,
    },
    region: s3Region
  })

  return s3
}