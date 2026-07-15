import { buildStudentAuthPath } from './studentApplyRedirect';

export const APPLIED_JOBS_PATH = '/student/applied-jobs';

export const buildAppliedJobsLoginPath = () =>
  `/student/login${buildStudentAuthPath({ pathname: APPLIED_JOBS_PATH })}`;
