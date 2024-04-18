export type S3AuthStateProps = { s3AccessKeyId: string, s3secretAccessKey: string, s3Region: string, bucket: string }
export type S3ClientProps = Omit<S3AuthStateProps, 'bucket'>

type DefaultProps = {
  sessionId: string,
  key: string,
  s3Props: S3AuthStateProps
}
export type InsertOrUpdateAuthKeyProps = DefaultProps & {
  dataString: string,
}

export type GetAuthKeyProps = DefaultProps

export type DeleteAuthKeyProps = DefaultProps