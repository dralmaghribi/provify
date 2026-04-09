export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OpenAI API key' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No boundary found' });
    const boundary = boundaryMatch[1];

    const boundaryBuf = Buffer.from(`--${boundary}`);
    const parts = splitBuffer(rawBody, boundaryBuf);

    let audioBuffer = null;
    let audioFilename = 'audio.webm';
    let audioMime = 'audio/webm';

    for (const part of parts) {
      const headerEnd = indexOfSequence(part, Buffer.from('\r\n\r\n'));
      if (headerEnd === -1) continue;
      const headerStr = part.slice(0, headerEnd).toString();
      if (!headerStr.includes('name="audio"')) continue;
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);
      if (filenameMatch) audioFilename = filenameMatch[1];
      const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
      if (ctMatch) audioMime = ctMatch[1].trim();
      audioBuffer = part.slice(headerEnd + 4, part.length - 2);
      break;
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'No audio data found' });
    }

    const formBoundary = '----WhisperBoundary' + Date.now();
    const CRLF = '\r\n';

    const fileHeader = `--${formBoundary}\r\nContent-Disposition: form-data; name="file"; filename="${audioFilename}"\r\nContent-Type: ${audioMime}\r\n\r\n`;
    const modelPart = `\r\n--${formBoundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1`;
    const langPart = `\r\n--${formBoundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nen`;
    const promptPart = `\r\n--${formBoundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nDental clinical case. Terms: RCT, root canal, obturation, NaOCl, EDTA, pulpotomy, composite, extraction, impaction, anaesthesia, endodontics, restorative, paediatric, prosthodontics, FDI tooth numbering.`;
    const closing = `\r\n--${formBoundary}--\r\n`;

    const formBody = Buffer.concat([
      Buffer.from(fileHeader),
      audioBuffer,
      Buffer.from(modelPart + langPart + promptPart + closing),
    ]);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${formBoundary}`,
      },
      body: formBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Whisper API error:', errText);
      return res.status(500).json({ error: 'Transcription failed' });
    }

    const data = await response.json();
    return res.status(200).json({ transcript: data.text || '' });

  } catch (error) {
    console.error('Whisper handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function splitBuffer(buf, sep) {
  const parts = [];
  let start = 0;
  let idx = indexOfSequence(buf, sep, start);
  while (idx !== -1) {
    parts.push(buf.slice(start, idx));
    start = idx + sep.length;
    if (buf[start] === 13 && buf[start + 1] === 10) start += 2;
    idx = indexOfSequence(buf, sep, start);
  }
  if (start < buf.length) parts.push(buf.slice(start));
  return parts.filter(p => p.length > 4);
}

function indexOfSequence(buf, seq, offset = 0) {
  outer: for (let i = offset; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (buf[i + j] !== seq[j]) continue outer;
    }
    return i;
  }
  return -1;
}
