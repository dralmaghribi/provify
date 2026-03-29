export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { caseData, complexity } = req.body;
    const spec = caseData.specialty;
    let details = '';

    if (spec === 'endo') {
      details = `Specialty: Endodontics, Tooth: ${caseData.tooth_number}, Age: ${caseData.age_range}, Pulp: ${caseData.pulp_diagnosis}, Periapical: ${caseData.periapical_diagnosis}, Case type: ${caseData.case_type}, Canals: ${caseData.canals}, Curvature: ${caseData.curvature}, Working length: ${caseData.working_length}mm, Apical size: ${caseData.apical_size}, Irrigation: ${caseData.irrigation}, Obturation: ${caseData.obturation}, Calcification: ${caseData.calcification}, Separated instrument: ${caseData.separated}, Post-op: ${caseData.post_op}, Difficulty: ${caseData.difficulty_rating}/5, Complexity score: ${complexity}/10`;
    } else if (spec === 'restorative') {
      details = `Specialty: Restorative, Tooth: ${caseData.tooth_number}, Class: ${caseData.cavity_class}, Surfaces: ${caseData.surfaces}, Material: ${caseData.material}, Isolation: ${caseData.isolation}, Post-op: ${caseData.post_op}, Complexity: ${complexity}/10`;
    } else {
      details = `Specialty: Oral Surgery, Tooth: ${caseData.tooth_number}, Procedure: ${caseData.procedure}, Impaction: ${caseData.impaction}, Anaesthesia: ${caseData.anaesthesia}, Sutures: ${caseData.sutures}, Post-op: ${caseData.post_op}, Complexity: ${complexity}/10`;
    }

    const prompt = `You are a senior dental specialist reviewing a case on Provify, a clinical case intelligence platform.\n\nCase: ${details}\n\nRespond ONLY with a JSON object with exactly these keys:\n- "strength": One specific sentence about what went well (specific to the case data)\n- "watch": One specific clinical tip for next time (based on actual case data)\n- "tip": One advanced clinical pearl for this specific case\n\nKeep each 1-2 sentences. Be specific and clinical. Sound like a senior specialist to a junior colleague.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      parsed = { strength: 'Good clinical work.', watch: 'Keep refining your technique.', tip: 'Consistent documentation builds clinical excellence.' };
    }
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ strength: 'Case logged successfully.', watch: 'Continue building your record.', tip: 'Consistent documentation is the foundation of clinical excellence.' });
  }
}
