import { useContext } from 'react';
import { StudentAuthContext } from '../context/studentAuthContext';

export function useStudentAuth() {
  const context = useContext(StudentAuthContext);
  if (!context) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider.');
  }
  return context;
}
