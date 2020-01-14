// lham @2020

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const commander = require('commander');
const request = require("request-promise-native");
const mongoose = require('mongoose');
const shortId = require('shortid');

const V2T = require('./models/voice_to_text');

// set up command line processor and parse 
commander.version('0.1.1', '-v, --version')
    .usage('[OPTIONS]...')
    .option('-d, --delay <ms>', 'Delay this script for n ms before starting...')
    .requiredOption('-t, --target <url>', 'Specify URI of target .WAV file.')
    .parse(process.argv);

let targetUri = commander.target;

if( !targetUri ) {
    console.log('You must use the -t or --target <url> to specifiy where the .wav URL end-point.')
    process.exit(1);
}


// set up our AWS credentials
let awsCreds = { 
    accessKeyId: process.env.AWS_ID, 
    secretAccessKey: process.env.AWS_SECRET,
    region: 'us-east-2' // required by TranscribeService 
};

const s3 = new AWS.S3(awsCreds);
const v2t = new AWS.TranscribeService(awsCreds);

let uploadFileToS3Bucket = async (fileName) => {
    return new Promise((resolve, reject) => {

        let fileBuffer = fs.readFileSync(fileName); // .catch will in promise will receive any read errors

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

let downloadWav = async (wavUri, outputFilename) => {
    console.log(`Downloading target WAV file: ${wavUri}...`);

    let wavBuffer = await request.get({uri: wavUri, encoding: null});       
                                                                            
    console.log(`Saving wav download to: ${outputFilename}`);
                                                                            
    fs.writeFileSync(outputFilename, wavBuffer);                                
}

let transcribeUri = async (uri, job_name) => {
    return new Promise((resolve, reject) => {

        let params = {
            LanguageCode: 'en-US',
            Media: { 
              MediaFileUri: uri,
            },
            TranscriptionJobName: job_name, 
            MediaFormat: 'wav',
        }

        v2t.startTranscriptionJob(params, (err, data) => {
            return (err) ? reject(err) : resolve(data);
        });

    });
}

async function createRecord(S3Uri, jobId) {
    return new V2T({ s3_uri: S3Uri,job_id: jobId }).save();
}


async function main() {
    let ret = null;
    let jobName = shortId.generate();
    let fileName = jobName + '.wav';
    let connector = mongoose.connect(process.env.MONGODB_ATLAS,  { useNewUrlParser: true , useCreateIndex: true, useUnifiedTopology: true });
    
    await connector
        .then(async () => {
            console.log('Connected to MongoDB Atlas in the Cloud!');
        })
        .catch((reason) => {
            console.log('Connection to MongoDB Atlas failed.');
            console.log(reason);
        })


    await downloadWav(targetUri, fileName)
        .then(() => console.log('WAV download complete.'))
        .catch((e) => {
            console.trace(e);
        })

    let S3Uri = null;

    await uploadFileToS3Bucket(fileName)
        .then((ret) => {
            S3Uri = ret.Location;
            console.log(`File moved to S3 bucket: ${S3Uri}`);
        })
        .catch((e) => {
            console.trace(e);
        })

    ret = await transcribeUri(S3Uri, jobName)
                .catch((e) => { console.log(e) });

    let jobId = ret.TranscriptionJob.TranscriptionJobName;

    if( !jobId ) {
        console.log('Failed to obtain TranscriptionJobName...');
    }
    else {
        let x = await createRecord(S3Uri, jobId);

        console.log(`Deleting local file ${fileName}.. closing MongoDB Atlas connection...`)

        mongoose.connection.close();

        fs.unlinkSync(fileName);
        
        console.log(x);

        console.log('We are done...');
    }

    // Note: This does not return the transcription results.
    //
    // Lamba Function created (in AWS) to wait for a CloudWatch event (this must also be set up)
    // When the transcription job is complete Transcribe issues an event that triggers our Lambda
    // function to send a callback to our server that the transcription is done (JobTitle included).
    // Using JobTitle we can continue to use AWS SDK to look up that JobTitle/ID and get results
    // for storage in our waiting web-hook. 
}

main();


/*
This is what the Lamba function sends to our https server on port 8051 for processing and clean-up

{ version: '0',                                 
  id: 'd7f6bbe2-ccec-7886-921c-588496e56151',   
  'detail-type': 'Transcribe Job State Change', 
  source: 'aws.transcribe',                     
  account: '329121181802',                      
  time: '2019-12-13T19:39:49Z',                 
  region: 'us-east-2',                          
  resources: [],                                
  detail:                                       
   { TranscriptionJobName: 'AmKzVG21',          
     TranscriptionJobStatus: 'COMPLETED' } }    

*/