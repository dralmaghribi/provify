export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const body = req.body;
    const mode = body.mode || 'case_analysis';

    // ─── CLINICAL NOTE MODE ───
    if (mode === 'clinical_note') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 900,
          messages: [{ role: 'user', content: body.notePrompt }]
        })
      });

      const data = await response.json();
      const note = data.content?.[0]?.text || 'Unable to generate note.';
      return res.status(200).json({ note });
    }

    // ─── CASE ANALYSIS MODE (default) ───
    const { caseData: c, complexity } = body;
    const spec = c.specialty;
    let details = '';

    if (spec === 'endo') {
      details = `
Specialty: Endodontics
Tooth: ${c.tooth_number}, Age range: ${c.age_range}
Pulp diagnosis: ${c.pulp_diagnosis}, Periapical: ${c.periapical_diagnosis}
Case type: ${c.case_type}
Canals: ${c.canals}, Curvature: ${c.curvature}
Working length: ${c.working_length}, Apical size: ${c.apical_size}
Irrigation: ${c.irrigation}, Obturation: ${c.obturation}
Calcification: ${c.calcification}, Separated instrument: ${c.separated}
Post-op: ${c.post_op}, Difficulty rating: ${c.difficulty_rating}/5
Complexity score: ${complexity}/10`;
    } else if (spec === 'restorative') {
      details = `
Specialty: Restorative Dentistry
Tooth: ${c.tooth_number}, Class: ${c.cavity_class}
Surfaces: ${c.surfaces}, Material: ${c.material}
Isolation: ${c.isolation}, Post-op: ${c.post_op}
Complexity score: ${complexity}/10`;
    } else {
      details = `
Specialty: Oral Surgery
Tooth: ${c.tooth_number}, Procedure: ${c.procedure}
Impaction: ${c.impaction}, Anaesthesia: ${c.anaesthesia}
Sutures: ${c.sutures}, Post-op: ${c.post_op}
Complexity score: ${complexity}/10`;
    }

    const prompt = `You are a senior dental specialist reviewing a case logged by a dentist on Provify, a clinical case intelligence platform.

Case details:
${details}

Respond ONLY with a JSON object (no markdown, no preamble) with exactly these keys:
- "strength": One specific sentence praising what went well or acknowledging clinical complexity (be specific to the case data, not generic)
- "watch": One specific clinical tip or thing to consider next time (based on the actual case data)
- "tip": One advanced clinical pearl relevant to this specific case type and findings

Keep each field to 1-2 sentences max. Be specific, clinical, and genuinely useful. Sound like a senior specialist talking to a junior colleague.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Analysis failed', strength: 'Case logged successfully.', watch: 'Continue developing your technique.', tip: 'Review literature relevant to this case type.' });
  }
}
