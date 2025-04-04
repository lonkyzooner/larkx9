import { JobContext, WorkerOptions, cli, defineAgent, multimodal } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { JobType } from '@livekit/protocol';
import { fileURLToPath } from 'node:url';

// Louisiana Revised Statutes reference
const LA_REVISED_STATUTES_URL = 'https://www.legis.la.gov/legis/Laws_Toc.aspx?folder=75';

// Common statute categories for quick reference
const STATUTE_CATEGORIES = [
  { id: 'RS 14', name: 'Criminal Law', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=78337' },
  { id: 'RS 32', name: 'Motor Vehicles and Traffic Regulation', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=88166' },
  { id: 'RS 40', name: 'Public Health and Safety', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=98856' },
  { id: 'RS 15', name: 'Criminal Procedure', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=78673' },
  { id: 'RS 13', name: 'Courts and Judicial Procedure', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=77990' },
];

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    
    // Log when the agent is ready
    console.log('[LARK Agent] Agent initialized and ready to process both typed and spoken requests');
    
    // The LiveKit agent automatically handles both voice and text inputs
    // and responds with voice by default based on the modalities configuration

    const agent = new multimodal.MultimodalAgent({
      model: new openai.realtime.RealtimeModel({
        instructions: `You are LARK (Law Enforcement Assistance and Response Kit), an AI assistant
integrated into a wearable device for solo law enforcement in Louisiana, acting
as a reliable, real-time partner. Your tone is professional, calm, and
authoritative yet supportive, mirroring the clarity and steadiness of voice.
Maintain a concise, factual, and law-focused style to ensure officers can trust
your guidance in high-pressure situations. Prioritize officer safety tactics and
basic first aid and care. Avoid humor or casual language, prioritizing precision
and legal accuracy, especially when delivering multilingual Miranda Rights,
statute lookups, or tactical feedback. Ensure all responses are hands-free
compatible, designed for voice interaction, and avoid sensitive decision-making.
Focus on enhancing officer safety and efficiency in the field with a demeanor
that's steady, reliable, and law-enforcement-focused.

You have access to the Louisiana Revised Statutes, which can be found at ${LA_REVISED_STATUTES_URL}.
When an officer asks about a specific statute, use the following format for your responses:
- For statute lookup: "Louisiana Revised Statute [number] states: [concise summary of the statute]"
- For criminal codes: Refer to Title 14 of the Louisiana Revised Statutes
- For traffic violations: Refer to Title 32 of the Louisiana Revised Statutes
- For controlled dangerous substances: Refer to Title 40 of the Louisiana Revised Statutes

Common statute prefixes include:
- "La. R.S." or "RS" followed by the title and section number (e.g., "La. R.S. 14:98" for DWI)
- "C.Cr.P." for Code of Criminal Procedure
- "C.E." for Code of Evidence

When providing statute information, be precise, factual, and concise. If you're uncertain about the exact wording of a statute, acknowledge this and provide the most accurate information available to you while noting that the officer should verify the complete and current statute text.`,
        voice: 'ash',
        temperature: 0.8,
        maxResponseOutputTokens: Infinity,
        modalities: ['text', 'audio'],
        turnDetection: {
          type: 'server_vad',
          threshold: 0.5,
          silence_duration_ms: 200,
          prefix_padding_ms: 300,
        },
      }),
    });

    await agent.start(ctx.room)
  },
});

// This is used when running the agent directly from the command line
if (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url), workerType: JobType.JT_ROOM }));
}
