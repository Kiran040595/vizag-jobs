import { normalizeSkillValue } from './studentProfileOptions.js';

// Explicit equivalent spellings only. Do not merge related but different languages.
const SKILL_ALIASES = new Map([
  ['react.js', 'react'], ['reactjs', 'react'], ['react js', 'react'],
  ['node.js', 'nodejs'], ['node js', 'nodejs'],
  ['js', 'javascript'],
  ['.net', 'dotnet'], ['.net framework', 'dotnet'],
  ['excel', 'ms excel'], ['microsoft excel', 'ms excel'],
  ['html & css', 'html css'],
]);

export const skillMatchKey = value => {
  const normalized = normalizeSkillValue(value);
  return SKILL_ALIASES.get(normalized) || normalized;
};
