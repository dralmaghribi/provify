export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const { caseData, complexity } = body || {};
  if (!caseData) {
    return res.status(200).json({
      strength: 'Case data not received properly.',
      watch: 'Please try again.',
      tip: 'Contact support if this persists.'
    });
  }

  const spec = caseData.specialty;
  let details = `Specialty: ${spec}, Tooth: ${caseData.tooth_number}, Age: ${caseData.age_range}`;
  
  if (spec === 'endo') {
    details += `, Pulp: ${caseData.pulp_diagnosis}, Periapical: ${caseData.periapical_diagnosis}, Case type: ${caseData.case_type}, Canals: ${caseData.canals}, Curvature: ${caseData.curvature}, WL: ${caseData.working_length}mm, Apical size: ${caseData.apical_size}, Irrigation: ${caseData.irrigation}, Obturation: ${caseData.obturation}, Calcification: ${caseData.calcification}, Separated: ${caseData.separated}, Complexity: ${complexity}/10`;
  } else if (spec === 'restorative') {
    details += `, Class: ${caseData.cavity_class}, Surfaces: ${caseData.surfaces}, Material: ${caseData.material}, Isolation: ${caseData.isolation}, Complexity: ${complexity}/10`;
  } else {
    details += `, Procedure: ${caseData.procedure}, Impaction: ${caseData.impaction}, Complexity: ${complexity}/10`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `You are a senior dental specialist. Analyze this case and respond ONLY with a JSON object with keys "strength", "watch", "tip". Each value is 1-2 specific clinical sentences. Case: ${details}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    let parsed;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      parsed = { strength: text.slice(0, 100) || 'Good work.', watch: 'Continue refining.', tip: 'Keep documenting.' };
    }
    
    return res.status(200).json(parsed);
  } catch(error) {
    return res.status(200).json({
      strength: 'Case saved. AI temporarily unavailable.',
      watch: 'Your complexity score has been calculated.',
      tip: 'Keep logging cases consistently.'
    });
  }
}
