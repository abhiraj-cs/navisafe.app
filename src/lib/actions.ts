'use server';

import { generateRouteSafetyBriefing } from '@/ai/flows/generate-route-safety-briefing';
import type { BlackSpot } from './data';

export async function getSafetyBriefing(blackSpots: BlackSpot[]): Promise<string> {
  try {
    const briefingInput = {
      blackSpots: blackSpots.map(bs => ({
        lat: bs.lat,
        lng: bs.lng,
        risk_level: bs.risk_level,
        accident_history: bs.accident_history,
      })),
    };
    const result = await generateRouteSafetyBriefing(briefingInput);
    return result.safetyBriefing;
  } catch (error) {
    console.error('Error generating AI safety briefing:', error);

    // If there are no black spots detected and the AI fails, return a generic safe message.
    if (blackSpots.length === 0) {
        return 'This route appears to be clear of known high-risk areas. Enjoy your drive and stay safe!';
    }
    
    // Fallback to a simple, non-AI briefing if the AI call fails
    let fallbackBriefing = `An AI-powered summary could not be generated. Please proceed with extra caution.\n\nThis route passes near ${blackSpots.length} known accident-prone area(s):\n\n`;
    
    blackSpots.forEach(spot => {
        fallbackBriefing += `• A **${spot.risk_level} risk zone** with a history of: *${spot.accident_history}*.\n`;
    });

    return fallbackBriefing;
  }
}
