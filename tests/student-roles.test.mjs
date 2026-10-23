import test from 'node:test';
import assert from 'node:assert/strict';
import { countStudentRoles, roleKey, studentMatchesRole, studentRoleLabels } from '../src/lib/studentRoles.js';
import { mapStudentProfileRow } from '../src/lib/adminStudentProfile.js';
import { buildStudentExportRows } from '../src/lib/studentExport.js';

const students = [
  mapStudentProfileRow({ user_id: 'one', primary_target_role: '  Robotics   Technician ', interested_roles: ['robotics technician', 'C++ Developer'], is_active: true }),
  mapStudentProfileRow({ user_id: 'two', primary_target_role: 'Accountant', interested_roles: [' ROBOTICS  TECHNICIAN ', 'C# Developer'], is_active: false }),
];

test('role filters and counts include primary and secondary roles once per candidate', () => {
  assert.deepEqual(studentRoleLabels(students[0]), ['Robotics Technician', 'C++ Developer']);
  const counts = countStudentRoles(students);
  assert.equal(counts.find(item => roleKey(item.value) === 'robotics technician').count, 2);
  assert.equal(counts.length, 4);
  assert.equal(students.filter(student => studentMatchesRole(student, ' ROBOTICS   technician ')).length, 2);
  assert.equal(students.filter(student => studentMatchesRole(student, 'C++ Developer')).length, 1);
  assert.equal(studentMatchesRole(students[1], 'C++ Developer'), false);
  assert.equal(studentMatchesRole(students[1], ''), true);
});

test('rare roles beyond the top twelve remain available for filtering and exporting', () => {
  const candidates = Array.from({ length: 30 }, (_, i) => ({ primaryTargetRole: `Role ${i}`, interestedRoles: [] }));
  const options = countStudentRoles(candidates);
  assert.equal(options.length, 30);
  const rare = options[29].value;
  assert.equal(candidates.filter(student => studentMatchesRole(student, rare)).length, 1);
});

test('role exports retain candidates matching through secondary roles', () => {
  const filtered = students.filter(student => studentMatchesRole(student, 'Robotics Technician'));
  assert.equal(filtered.length, 2);
  const { rows, columns } = buildStudentExportRows(filtered, ['primaryTargetRole', 'interestedRoles']);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][columns.findIndex(column => column.id === 'primaryTargetRole')], 'Accountant');
  assert.match(rows[1][columns.findIndex(column => column.id === 'interestedRoles')], /ROBOTICS/);
});
