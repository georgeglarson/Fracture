/**
 * Static (no-AI) fallback services
 *
 * When no VENICE_API_KEY is configured the VeniceService singleton is never
 * created. These singletons back the static-fallback experience in that mode:
 * template quests, stat-based newspaper headlines, and mad-libs thought
 * bubbles. Each underlying service treats a null VeniceClient as "AI disabled"
 * and serves its static path without making API calls.
 */

import { QuestService } from './quest.service';
import { NewsService } from './news.service';
import { ThoughtService } from './thought.service';
import { ProfileService } from './profile.service';

export interface StaticServices {
  quests: QuestService;
  news: NewsService;
  thoughts: ThoughtService;
}

let staticServices: StaticServices | null = null;

export function getStaticServices(): StaticServices {
  if (!staticServices) {
    const profiles = new ProfileService();
    staticServices = {
      quests: new QuestService(null, profiles),
      news: new NewsService(null),
      thoughts: new ThoughtService(null),
    };
  }
  return staticServices;
}
