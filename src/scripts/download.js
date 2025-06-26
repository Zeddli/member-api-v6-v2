const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const BASE_URL = config.apiUrl;
const OUTPUT_DIR = config.fileLocation;
const DELAY_BETWEEN_REQUESTS = 500;
const MAX_RETRIES = 3;

const handleList = config.handleList;

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchMemberData(handle, retryCount = 0) {
  const url = `${BASE_URL}?page=1&perPage=10&handle=${encodeURIComponent(handle)}`;
  
  return new Promise((resolve, reject) => {
    console.log(`Fetching data for handle: ${handle}`);

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        if (retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Rate limited. Retrying handle ${handle} in ${delay}ms...`);
          setTimeout(() => {
            fetchMemberData(handle, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, delay);
          return;
        }
        reject(new Error(`Failed to fetch handle ${handle}. Status code: ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Error fetching handle ${handle}. Retrying in ${delay}ms...`);
        setTimeout(() => {
          fetchMemberData(handle, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, delay);
      } else {
        reject(err);
      }
    });
  });
}

function saveMemberData(handle, data) {
  const filename = path.join(OUTPUT_DIR, `${handle}.json`);
  const content = JSON.stringify(data, null, 2);
  
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, content, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Saved data for ${handle} to ${filename}`);
        resolve();
      }
    });
  });
}

async function processHandleList() {
  for (const handle of handleList) {
    try {
      const memberData = await fetchMemberData(handle);
      
      await saveMemberData(handle, memberData);
      
      if (handle !== handleList[handleList.length - 1]) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    } catch (err) {
      console.error(`Error processing handle ${handle}:`, err.message);
    }
  }
  console.log('All handles processed!');
}

processHandleList();
