require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const express = require('express');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');


//Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {

        // Uploads is the Upload_folder_name
        cb(null, "uploads")
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});

const upload = multer({
    storage: storage
});

const app = express();
app.use(bodyParser.json());

// If modifying these scopes, delete token.json.
const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
// const REFRESH_TOKEN = "1//0gejMGxvZ8OCnCgYIARAAGBASNwF-L9Irn9DTuEADEAuJANxZr1m7F-8UX9fOea_ja99xcfFcftzRSx9jEGSop1ldSk0F2E47e4A";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const REDIRECT_URI = process.env.REDIRECT_URI;

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback,res) {
  const {client_secret, client_id, redirect_uris} = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback,res);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client,res);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback,res) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client,res);
    });
  });
}

// function listFiles(auth,res) {
//   const drive = google.drive({version: 'v3', auth});
//   drive.files.list({
//     pageSize: 10,
//     fields: 'nextPageToken, files(id, name)',
//   }, (err, res) => {
//     if (err) return console.log('The API returned an error: ' + err);
//     const files = res.data.files;
//     if (files.length) {
//       console.log('Files:');
//       files.map((file) => {
//         console.log(`${file.name} (${file.id})`);
//       });
//     } else {
//       console.log('No files found.');
//     }
//   });
// }

//Function for getting a maximum of 10 file names.
async function listFiles(auth,res) {
    try{
        const drive = google.drive({version: 'v3', auth});
        const response = await drive.files.list({
            pageSize: 10,
            fields: 'nextPageToken, files(name)',
          });
        console.log(response.data);
        const files = {}
        response.data.files.map((file,index) => files[index] = file.name);
        JSON.stringify(files);
        res.status(200).send(files);
    }
    catch(error){
        console.log(error);
    }
};

//Function for uploading a file
async function uploadFile(auth, data, res) {
    try {
        var fileMetadata = {
            'name': data.fileName
        };

        var media = {
            mimeType: 'text/plain',
            body: fs.createReadStream(data.path)
        };

        const drive = google.drive({ version: 'v3', auth });
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        });
        // report the response from the request
        console.log(response.data);

        return res.status(200).json({'message': 'File uploaded successfully', 'file ID': response.data.id});
    } catch (error) {
        //report the error message
        console.log(error.message);
        return res.status(503).json({message: 'An error occured while uploading file'});

    }
}

//Function for deleting a file
async function deleteFile(auth,id,res){
    try {
        const drive = google.drive({ version: 'v3', auth });
        const response = await drive.files.delete({
            fileId: id
        });
        // console.log(response.data, response.status);
        return res.status(200).json({'message': 'File deleted successfully'});
    }
    catch (error) {
        console.log(error.message);
        return res.status(503).json({message: 'An error occured while deleting file'});
    }
}

//ROUTES

//List files
app.get('/listFiles', async (req,res) => {

    const oAuth2Client = new google.auth.OAuth2(
        CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    await oAuth2Client.getAccessToken();

    listFiles(oAuth2Client,res);


    // fs.readFile('credentials.json', (err, content) => {
    //     if (err) return console.log('Error loading client secret file:', err);
    //     // Authorize a client with credentials, then call the Gmail API.
    //     authorize(JSON.parse(content), listFiles,res);
    // });
});

//Upload a file
app.post('/uploadFile', upload.single('file') ,async (req, res) => {

    const oAuth2Client = new google.auth.OAuth2(
        CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    await oAuth2Client.getAccessToken();

    const data = {
        fileName: req.file.originalname,
        path: req.file.path,
    }

    uploadFile(oAuth2Client,data,res);


    //code below works as well but filename and path hardcoded/predefined
    // fs.readFile('credentials.json', (err, content) => {
    //     if (err) return console.log('Error loading client secret file:', err);
    //     // Authorize a client with credentials, then call the Gmail API.
    //     authorize(JSON.parse(content), uploadFile,res);
    // });
});


//Delete a file
app.post('/deleteFile', async(req,res) => {
    const oAuth2Client = new google.auth.OAuth2(
        CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    await oAuth2Client.getAccessToken();

    const {id} = req.body;

    deleteFile(oAuth2Client,id,res);
});

app.listen(3001, () => console.log('Server listening on port 3001'));