export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { caseData, complexity } = req.body || {};

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ strength: 'API key missing.', watch: 'Check environment variables.', tip: 'Contact support.' });
  }

  if (!caseData) {
    return res.status(200).json({ strength: 'No case data received.', watch: 'Try again.', tip: 'Fill all fields.' });
  }

  const spec = caseData.specialty || 'unknown';
  const details = `Tooth ${caseData.tooth_number}, ${spec}, complexity ${complexity}/10, curvature: ${caseData.curvature}, canals: ${caseData.canals}, calcification: ${caseData.calcification}, case type: ${caseData.case_type}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Dental case: ${details}. Reply with ONLY a JSON object: {"strength":"...","watch":"...","tip":"..."}. Each value max 1 sentence.` }]
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    return res.status(200).json({ strength: `API error: ${data.error?.message || 'unknown'}`, watch: 'Check API key.', tip: 'Contact support.' });
  }

  const text = data.content?.[0]?.text || '{}';
  
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return res.status(200).json(parsed);
  } catch(e) {
    return res.status(200).json({ strength: text.slice(0, 150), watch: 'Keep logging.', tip: 'Consistency builds excellence.' });
  }
}
