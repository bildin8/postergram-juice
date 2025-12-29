import request from 'request';
import md5 from 'md5';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const manifest = require('./manifest.json');

const URL = 'https://platform.joinposter.com/api/application.uploadPOSPlatformBundle?format=json';
const FILENAME = 'bundle.js';

(function () {
    console.log('Uploading bundle to Poster POS Platform...');
    console.log(`Application ID: ${manifest.applicationId}`);

    fs.readFile(FILENAME, (err, buf) => {
        if (!err) {
            const fileMd5 = md5(buf);
            const signParts = [
                manifest.applicationId,
                fileMd5,
                manifest.applicationSecret,
            ];
            const sign = md5(signParts.join(':'));

            console.log(`Bundle MD5: ${fileMd5}`);
            console.log(`Signature: ${sign}`);

            const formData = {
                application_id: manifest.applicationId,
                sign,
                bundle: fs.createReadStream(`./${FILENAME}`),
            };

            request.post({
                url: URL,
                formData,
            }, (err, response, body) => {
                if (!err) {
                    try {
                        body = JSON.parse(body);

                        if (body.error) {
                            console.error('Error from Poster:', JSON.stringify(body, null, 2));
                            throw new Error(JSON.stringify(body));
                        }

                        console.log('✅ Bundle successfully uploaded to Poster POS Platform!');
                        console.log('Response:', JSON.stringify(body, null, 2));
                    } catch (e) {
                        console.error('❌ Error while uploading bundle to Poster...');
                        console.error(e);
                    }
                } else {
                    console.error('❌ Network error while uploading bundle...');
                    console.error(err);
                }
            });
        } else {
            console.error(`❌ Error while reading ${FILENAME}`);
            console.error('Run "npm run build" first to create the bundle.');
            console.error(err);
        }
    });
}());
