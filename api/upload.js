// api/upload.js

import formidable from 'formidable';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import os from 'os';

export const config = {
  api: {
    bodyParser: false, // Disable default body parser
  },
};

export default async function handler(req, res) {
  console.log('Request received:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });

  // Set CORS headers (if necessary)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust as needed for security
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.error('Method not allowed:', req.method);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Log environment variable availability
  console.log('PINATA_API_KEY is set:', !!process.env.PINATA_API_KEY);
  console.log('PINATA_SECRET_API_KEY is set:', !!process.env.PINATA_SECRET_API_KEY);

  const form = formidable({
    multiples: false,
    uploadDir: os.tmpdir(), // Temporary directory for uploaded files
    keepExtensions: true,
  });

  console.log('Parsing form data...');

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing form data:', err);
      res.status(500).json({ error: 'Error parsing form data', details: err.message });
      return;
    }

    console.log('Fields:', fields);
    console.log('Files:', files);

    if (!files || !files.file) {
      console.error('No file found in the request.');
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    let file = files.file;

    // If file is an array, take the first element
    if (Array.isArray(file)) {
      file = file[0];
    }

    console.log('Received file:', {
      filepath: file.filepath,
      originalFilename: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size,
    });

    // Read the uploaded file using a stream
    let fileStream;
    try {
      fileStream = fs.createReadStream(file.filepath);
      console.log('File stream created:', file.filepath);
    } catch (fileReadError) {
      console.error('Error reading uploaded file:', fileReadError);
      res.status(500).json({ error: 'Error reading uploaded file', details: fileReadError.message });
      return;
    }

    // Prepare form data for Pinata
    const formData = new FormData();
    formData.append('file', fileStream, file.originalFilename);

    // Log formData headers
    console.log('FormData headers:', formData.getHeaders());

    // Upload the file to Pinata IPFS
    try {
      console.log('Uploading file to Pinata...');
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
      console.log('Pinata response:', response.data);
      res.status(200).json({ cid: response.data.IpfsHash });
    } catch (uploadError) {
      console.error('Failed to upload to Pinata:', uploadError.response?.data || uploadError.message);
      res.status(500).json({
        error: 'Failed to upload to Pinata',
        details: uploadError.response?.data || uploadError.message,
      });
    }
  });
}
