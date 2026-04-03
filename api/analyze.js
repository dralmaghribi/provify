export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, caseData, complexity, notePrompt, careerPrompt, memoryPrompt, simPrompt, simAnswer, gradingPrompt } = req.body;

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Missing API key' });

  const callClaude = async (prompt, maxTokens = 1000) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await response.json();
    return data.content?.[0]?.text || '';
  };

  try {
    // ─── AI CASE REPORT ───
    if (mode === 'report' || (!mode && caseData)) {
      const c = caseData;
      const spec = c.specialty;
      let details = '';

      if (spec === 'endo') {
        details = `Specialty: Endodontics
Tooth: ${c.tooth_number}, Age: ${c.age_range}, Complaint: ${c.complaint}
Pulp Diagnosis: ${c.pulp_diagnosis || 'Not recorded'}
Periapical Diagnosis: ${c.periapical_diagnosis || 'Not recorded'}
Case Type: ${c.case_type || 'Not recorded'}
Number of Canals: ${c.canals || 'Not recorded'}
Working Length: ${c.working_length || 'Not recorded'}
Curvature: ${c.curvature || 'Not recorded'}
Apical Size: ${c.apical_size || 'Not recorded'}
Irrigation: ${c.irrigation || 'Not recorded'}
Obturation: ${c.obturation || 'Not recorded'}
Calcification: ${c.calcification || 'Not recorded'}
Separated Instrument: ${c.separated || 'No'}
Post-op: ${c.post_op || 'None reported'}
Complexity score: ${complexity}/10`;
      } else if (spec === 'restorative') {
        details = `Specialty: Restorative Dentistry
Tooth: ${c.tooth_number}, Age: ${c.age_range}, Complaint: ${c.complaint}
Cavity Classification: ${c.cavity_class || 'Not recorded'}
Surfaces: ${c.surfaces || 'Not recorded'}
Material: ${c.material || 'Not recorded'}
Isolation: ${c.isolation || 'Not recorded'}
Post-op: ${c.post_op || 'None reported'}
Complexity score: ${complexity}/10`;
      } else if (spec === 'paeds') {
        details = `Specialty: Paediatric Dentistry
Tooth: ${c.tooth_number}, Age: ${c.age_range}, Complaint: ${c.complaint}
Dentition: ${c.cavity_class || 'Not recorded'}
Procedure: ${c.procedure || 'Not recorded'}
Material: ${c.material || 'Not recorded'}
Pulp Status: ${c.pulp_diagnosis || 'Not recorded'}
Behaviour Management: ${c.isolation || 'Not recorded'}
Child Cooperation: ${c.surfaces || 'Not recorded'}
Space Maintainer: ${c.impaction || 'Not required'}
Post-op: ${c.post_op || 'None reported'}
Complexity score: ${complexity}/10`;
      } else {
        details = `Specialty: Oral Surgery
Tooth: ${c.tooth_number}, Age: ${c.age_range}, Complaint: ${c.complaint}
Procedure: ${c.procedure || 'Not recorded'}
Impaction Level: ${c.impaction || 'Not recorded'}
Anaesthesia: ${c.anaesthesia || 'Not recorded'}
Sutures: ${c.sutures || 'Not recorded'}
Post-op: ${c.post_op || 'None reported'}
Complexity score: ${complexity}/10`;
      }

      const prompt = `You are a senior dental specialist reviewing a case logged by a dentist on Provify.

Case details:
${details}

Respond ONLY with a JSON object (no markdown, no preamble) with exactly these keys:
- "strength": One specific sentence praising what went well or acknowledging clinical complexity (specific to the case data)
- "watch": One specific clinical tip or thing to consider next time (based on actual case data)
- "tip": One advanced clinical pearl relevant to this specific case

Keep each field to 1-2 sentences max. Be specific, clinical, and genuinely useful. Sound like a senior specialist talking to a junior colleague.`;

      const text = await callClaude(prompt, 400);
      let parsed = {};
      try {
        const clean = text.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch(e) {
        parsed = { strength: text, watch: '', tip: '' };
      }
      return res.status(200).json(parsed);
    }

    // ─── CLINICAL NOTE ───
    if (mode === 'clinical_note') {
      const text = await callClaude(notePrompt, 600);
      return res.status(200).json({ note: text });
    }

    // ─── CAREER ASSISTANT ───
    if (mode === 'career') {
      const text = await callClaude(careerPrompt, 700);
      return res.status(200).json({ career: text });
    }

    // ─── PROVIFY MEMORY ───
    if (mode === 'memory') {
      const text = await callClaude(memoryPrompt, 300);
      return res.status(200).json({ memory: text });
    }

    // ─── SIMULATION ───
    if (mode === 'simulation') {
      const text = await callClaude(simPrompt, 500);
      return res.status(200).json({ scenario: text });
    }

    // ─── SIMULATION GRADING ───
    if (mode === 'grading') {
      const text = await callClaude(gradingPrompt, 400);
      return res.status(200).json({ grading: text });
    }

    return res.status(400).json({ error: 'Unknown mode' });

  } catch (error) {
    console.error('Analyze error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
