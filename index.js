require('dotenv').config();

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

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
            if( err ) reject(err);
            else resolve(data);
        });
        
    });
}

async function main() {
    let results = await uploadFileToS3Bucket('./samples/vmail_sample1.wav');

    console.log(results);

    let text = await transcribeUri(results.Location);

    console.log(text);
}

main();