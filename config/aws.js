module.exports={
    accessKeyId:      env("AWS_ACCESS_KEY",""), // Access key ID
    secretAccessKey:  env("AWS_SECRET_KEY",""), // Secret access key
    region:           env("AWS_REGION",""),
    bucketName:       env("AWS_BUCKET",""),
    assetsbucketName: env("ASSETS_AWS_BUCKET",""),
    stateMachineArn : env("CHATBOT_STATEMACHINE_ARN",""),
}