import test from 'node:test';
import assert from 'node:assert/strict';

import { formatSkillLabel, normalizeSkillValue } from '../src/lib/studentProfileOptions.js';

test('normalizeSkillValue handles lowercase, whitespace, and special characters', () => {
  assert.equal(normalizeSkillValue('  React  '), 'react');
  assert.equal(normalizeSkillValue('PYTHON'), 'python');
  assert.equal(normalizeSkillValue('ms   excel'), 'ms excel');
  assert.equal(normalizeSkillValue(''), '');
});

test('Student filter logic correctly matches single and combined attributes', () => {
  const students = [
    {
      userId: 's1',
      fullName: 'Ananya Sharma',
      degree: 'B.Tech',
      branch: 'Computer Science (CSE)',
      graduationYear: 2025,
      isFresher: true,
      roleExperienceLevel: 'fresher',
      skills: ['react', 'python', 'sql'],
      targetJobCategories: ['it_software'],
      primaryTargetRole: 'Frontend Developer',
    },
    {
      userId: 's2',
      fullName: 'Rahul Varma',
      degree: 'B.Tech',
      branch: 'Mechanical Engineering',
      graduationYear: 2024,
      isFresher: false,
      roleExperienceLevel: '1_3',
      skills: ['autocad', 'solidworks', 'ms excel'],
      targetJobCategories: ['core_engineering'],
      primaryTargetRole: 'Design Engineer',
    },
    {
      userId: 's3',
      fullName: 'Priya Reddy',
      degree: 'MCA',
      branch: 'Computer Science (CSE)',
      graduationYear: 2025,
      isFresher: true,
      roleExperienceLevel: 'fresher',
      skills: ['java', 'spring boot', 'sql', 'react'],
      targetJobCategories: ['it_software'],
      primaryTargetRole: 'Java Developer',
    },
    {
      userId: 's4',
      fullName: 'Suresh Kumar',
      degree: 'B.Com',
      branch: 'Commerce',
      graduationYear: 2023,
      isFresher: false,
      roleExperienceLevel: '0_1',
      skills: ['tally', 'ms excel', 'accounting'],
      targetJobCategories: ['finance_accounts'],
      primaryTargetRole: 'Accountant',
    },
  ];

  // Helper matching the exact logic in AdminStudentsPage
  const filterStudents = (list, filters) => {
    return list.filter((student) => {
      if (filters.year && String(student.graduationYear) !== String(filters.year)) return false;
      if (filters.degree && student.degree.toLowerCase() !== filters.degree.toLowerCase()) return false;
      if (filters.branch && student.branch.toLowerCase() !== filters.branch.toLowerCase()) return false;
      if (filters.fresher) {
        if (filters.fresher === 'fresher' && !student.isFresher && student.roleExperienceLevel !== 'fresher') return false;
        if (filters.fresher === 'experienced' && student.isFresher && student.roleExperienceLevel === 'fresher') return false;
      }
      if (filters.skill) {
        const target = normalizeSkillValue(filters.skill);
        const has = student.skills.some((s) => normalizeSkillValue(s) === target);
        if (!has) return false;
      }
      return true;
    });
  };

  // 1. Batch filter: 2025
  const batch2025 = filterStudents(students, { year: '2025' });
  assert.equal(batch2025.length, 2);
  assert.deepEqual(batch2025.map((s) => s.userId).sort(), ['s1', 's3']);

  // 2. Degree filter: B.Tech
  const btech = filterStudents(students, { degree: 'B.Tech' });
  assert.equal(btech.length, 2);
  assert.deepEqual(btech.map((s) => s.userId).sort(), ['s1', 's2']);

  // 3. Branch filter: Mechanical Engineering
  const mech = filterStudents(students, { branch: 'Mechanical Engineering' });
  assert.equal(mech.length, 1);
  assert.equal(mech[0].fullName, 'Rahul Varma');

  // 4. Fresher vs Experienced
  const freshers = filterStudents(students, { fresher: 'fresher' });
  assert.equal(freshers.length, 2);
  const experienced = filterStudents(students, { fresher: 'experienced' });
  assert.equal(experienced.length, 2);

  // 5. Skill filter: React
  const reactDevs = filterStudents(students, { skill: 'react' });
  assert.equal(reactDevs.length, 2);
  assert.deepEqual(reactDevs.map((s) => s.userId).sort(), ['s1', 's3']);

  // 6. Skill filter: Tally
  const tallyUsers = filterStudents(students, { skill: 'Tally' });
  assert.equal(tallyUsers.length, 1);
  assert.equal(tallyUsers[0].fullName, 'Suresh Kumar');

  // 7. Combined filter: Batch 2025 + CSE + Fresher + React
  const targeted = filterStudents(students, {
    year: '2025',
    branch: 'Computer Science (CSE)',
    fresher: 'fresher',
    skill: 'react',
  });
  assert.equal(targeted.length, 2);
});
