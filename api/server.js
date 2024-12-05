// backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const formidable = require('formidable');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

app.post('/api/upload', (req, res) => {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing form data:', err);
      return res.status(500).json({ error: 'Error parsing form data' });
    }

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    try {
      const fileData = fs.readFileSync(file.filepath);

      const formData = new FormData();
      formData.append('file', fileData, file.originalFilename);

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          headers: {
            ...formData.getHeaders(),
            pinata_api_key: process.env.PINATA_API_KEY,
            pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
          },
        }
      );

      res.status(200).json({ cid: response.data.IpfsHash });
    } catch (uploadError) {
      console.error('Failed to upload to Pinata:', uploadError.message);
      res.status(500).json({
        error: 'Failed to upload to Pinata',
        details: uploadError.message,
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
