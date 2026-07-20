/**
 * Static (no-AI) fallback services
 *
 * When no VENICE_API_KEY is configured the VeniceService singleton is never
 * created. These singletons back the static-fallback experience in that mode:
 * template quests with kill/area progress tracking, stat-based newspaper
 * headlines, mad-libs thought bubbles, and static companion hints. Each
 * underlying service treats a null VeniceClient as "AI disabled" and serves
 * its static path without making API calls.
 */

import { QuestService } from './quest.service';
import { NewsService } from './news.service';
import { ThoughtService } from './thought.service';
import { CompanionService } from './companion.service';
import { ProfileService } from './profile.service';

export interface StaticServices {
  quests: QuestService;
  news: NewsService;
  thoughts: ThoughtService;
  companion: CompanionService;
  profiles: ProfileService;
}

let staticServices: StaticServices | null = null;

export function getStaticServices(): StaticServices {
  if (!staticServices) {
    const profiles = new ProfileService();
    staticServices = {
      quests: new QuestService(null, profiles),
      news: new NewsService(null),
      thoughts: new ThoughtService(null),
      companion: new CompanionService(null, profiles),
      profiles,
    };
  }
  return staticServices;
}

/** Test-only: drop the singletons so each test gets fresh static services. */
export function resetStaticServices(): void {
  staticServices = null;
}
