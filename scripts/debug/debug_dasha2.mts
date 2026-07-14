import { parseCondition, buildFactTags, conditionMatches } from "../../shared/astro/rule-matcher";

const rule = { id: "DB-GEN-647", rule_en: "", outcome: "", topic: "general", condition: "Dhanu Lagna native running Dasha or Bhukti of Saturn, Mercury, Ketu, or Venus.", planets_or_houses: ["Dhanu Lagna"] } as any;

const parsed = parseCondition(rule);
console.log(JSON.stringify(parsed, null, 2));
