import { parseCondition } from "../../shared/astro/rule-matcher";

const rule = { id: "TEST", rule_en: "", outcome: "", topic: "wealth", condition: "Dhanu Lagna, Saturn Dasha, Venus Bhukti, Venus (6th/11th lord) afflicted by Rahu and Amavasya Moon", planets_or_houses: ["Dhanu Lagna", "Saturn dasha", "Venus bhukti"] } as any;

const parsed = parseCondition(rule);
console.log(JSON.stringify(parsed, null, 2));
