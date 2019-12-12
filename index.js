require('dotenv').config();

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

const shortId = require('shortid');

let awsCreds = { 
    accessKeyId: process.env.AWS_ID, 
    secretAccessKey: process.env.AWS_SECRET,
    region: 'us-east-2' // required by TranscribeService -Lawrence
};

const s3 = new AWS.S3(awsCreds);
const v2t = new AWS.TranscribeService(awsCreds);

let uploadFileToS3Bucket = async (fileName) => {
    return new Promise((resolve, reject) => {
        let fileBuffer = null;

        try {
            fileBuffer = fs.readFileSync(fileName);
        }
        catch(err) {
            reject(err);
        }

        let params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: path.basename(fileName),
            Body: fileBuffer
        };

        s3.upload(params, function(err, data) {
            if (err) {
                return reject(err);
            }
            console.log(`File uploaded successfully. ${data.Location}`);
            resolve(data);
        });

    });
}

let transcribeUri = async (uri) => {
    return new Promise((resolve, reject) => {

        let params = {
            LanguageCode: 'en-US',
            Media: { 
              MediaFileUri: uri,
            },
            TranscriptionJobName: 'TestJob11',
            MediaFormat: 'wav',
        }

        v2t.startTranscriptionJob(params, (err, data) => {
            return (err) ? reject(err) : resolve(data);
        });
        
    });
}

async function main() {
    let ret = null;
    
    try {
        ret = await uploadFileToS3Bucket('./samples/vmail_sample1.wav');
    }
    catch(e) {
        return console.log(e);
    }

    let s3Uri = ret.Location;

    console.log(`S3 successfully uploaded: ${s3Uri}`);

    try {
        ret = await transcribeUri(s3Uri);
    }
    catch(e) {
        console.log(e);
    }

    console.log(ret);
    // This does not return the transcription results.
    //
    // Lamba Function created (in AWS) to wait for a CloudWatch event (this must also be set up)
    // when the transcription job is complete Transcribe issues event that triggers our Lambda
    // function to callback to our server that the transcription is done (JobTitle included).
    // Using JobTitle we can continue to use AWS SDK to look up that JobTitle/ID and get results
    // for storage. -Lawrence
}

main();