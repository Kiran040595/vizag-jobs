import { Link } from 'react-router-dom';
import { SITE_LEGAL_NAME } from '../../lib/siteLegal';

const CHECKBOX_CLASS = 'mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500';

export default function StudentRegistrationConsent({ values, onChange, idPrefix = 'student-consent' }) {
  const setChecked = (key) => (event) => {
    onChange({ ...values, [key]: event.target.checked });
  };

  return (
    <fieldset className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">Agreements required to register *</legend>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          id={`${idPrefix}-terms`}
          type="checkbox"
          checked={Boolean(values.terms)}
          onChange={setChecked('terms')}
          required
          className={CHECKBOX_CLASS}
        />
        <span>
          I agree to the{' '}
          <Link to="/terms-of-service" className="font-semibold text-indigo-600 hover:text-indigo-700" target="_blank">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy-policy" className="font-semibold text-indigo-600 hover:text-indigo-700" target="_blank">
            Privacy Policy
          </Link>{' '}
          of {SITE_LEGAL_NAME}.
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          id={`${idPrefix}-share`}
          type="checkbox"
          checked={Boolean(values.shareWithEmployers)}
          onChange={setChecked('shareWithEmployers')}
          required
          className={CHECKBOX_CLASS}
        />
        <span>
          I agree that {SITE_LEGAL_NAME} may share my profile information (name, college, degree, branch,
          skills, certifications, graduation year, phone, and email) with employers and recruiters in
          Visakhapatnam when my profile matches their job requirements.
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          id={`${idPrefix}-accurate`}
          type="checkbox"
          checked={Boolean(values.accurateInfo)}
          onChange={setChecked('accurateInfo')}
          required
          className={CHECKBOX_CLASS}
        />
        <span>
          I confirm that the information I provide is true and accurate to the best of my knowledge, and I
          understand it may be used for recruitment and shortlisting.
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          id={`${idPrefix}-age`}
          type="checkbox"
          checked={Boolean(values.age18)}
          onChange={setChecked('age18')}
          required
          className={CHECKBOX_CLASS}
        />
        <span>I confirm that I am 18 years of age or older.</span>
      </label>

      <p className="text-xs leading-5 text-slate-500">
        We do not sell your personal data. You can request account deactivation by contacting us through the{' '}
        <Link to="/contact" className="font-semibold text-slate-600 hover:text-indigo-600">
          Contact page
        </Link>
        . {SITE_LEGAL_NAME} is a job listing platform — employers make their own hiring decisions.
      </p>
    </fieldset>
  );
}
