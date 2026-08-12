export interface RobotsRules {
  disallow: string[];
}

const EMPTY_RULES: RobotsRules = { disallow: [] };

export function parseRobotsTxt(text: string): RobotsRules {
  const disallow: string[] = [];
  let inWildcardGroup = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (/^user-agent:\s*\*/i.test(line)) {
      inWildcardGroup = true;
      continue;
    }
    if (/^user-agent:/i.test(line)) {
      inWildcardGroup = false;
      continue;
    }
    const match = inWildcardGroup ? /^disallow:\s*(.*)$/i.exec(line) : null;
    if (match && match[1]) disallow.push(match[1].trim());
  }

  return { disallow };
}

export function isDisallowed(url: string, rules: RobotsRules): boolean {
  const path = new URL(url).pathname;
  return rules.disallow.some((prefix) => prefix.length > 0 && path.startsWith(prefix));
}

export async function fetchRobotsRules(origin: string): Promise<RobotsRules> {
  try {
    const response = await fetch(`${origin}/robots.txt`);
    if (!response.ok) return EMPTY_RULES;
    return parseRobotsTxt(await response.text());
  } catch {
    return EMPTY_RULES;
  }
}
