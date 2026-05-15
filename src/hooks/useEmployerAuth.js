import { useContext } from 'react';
import { EmployerAuthContext } from '../context/employerAuthContext';

export function useEmployerAuth() {
  const context = useContext(EmployerAuthContext);

  if (!context) {
    throw new Error('useEmployerAuth must be used within an EmployerAuthProvider.');
  }

  return context;
}
