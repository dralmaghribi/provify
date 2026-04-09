import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OpenAI API key' });

  try {
    // Parse the multipart form data
    const form = formidable({ maxFileSize: 25 * 1024 * 1024 }); // 25MB max
    const [fields, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    if (!audioFile) return res.status(400).json({ error: 'No audio file provided' });

    // Send to OpenAI Whisper
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile.filepath), {
      filename: audioFile.originalFilename || 'audio.webm',
      contentType: audioFile.mimetype || 'audio/webm',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('prompt', 'Dental clinical case documentation. Terms include: RCT, root canal, obturation, irrigation, NaOCl, EDTA, pulpotomy, apicectomy, composite, amalgam, GIC, curvature, periapical, endodontics, restorative, extraction, impaction, anaesthesia, sutures, paediatric, prosthodontics, zirconia, crown, bridge, implant, FDI tooth numbering system.');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper error:', error);
      return res.status(500).json({ error: 'Transcription failed' });
    }

    const data = await response.json();

    // Clean up temp file
    try { fs.unlinkSync(audioFile.filepath); } catch(e) {}

    return res.status(200).json({ transcript: data.text || '' });

  } catch (error) {
    console.error('Whisper handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
