import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  STUDENT_AVAILABILITY_OPTIONS,
  STUDENT_JOB_CATEGORY_OPTIONS,
  STUDENT_PREFERRED_LOCATION_OPTIONS,
  STUDENT_ROLE_EXPERIENCE_OPTIONS,
  resolveTargetJobCategoryToken,
} from '../../lib/studentCareerPreferences';
import {
  STUDENT_BRANCH_OPTIONS,
  STUDENT_DEGREE_OPTIONS,
  STUDENT_GRADUATION_YEAR_OPTIONS,
  STUDENT_SKILL_OPTIONS,
  formatSkillLabel,
  resolveSkillToken,
} from '../../lib/studentProfileOptions';
import { isValidStudentPhone, normalizeStudentPhone } from '../../lib/studentPhoneAuth';
import { fetchLiveJobRoles } from '../../services/jobRoles';
import StudentRegistrationConsent from './StudentRegistrationConsent';
import {
  POPULAR_CERTIFICATIONS,
  POPULAR_VIZAG_ROLES,
  filterSuggestions,
  loadSavedCustomCertifications,
  loadSavedCustomRoles,
  loadSavedCustomSectors,
  loadSavedCustomSkills,
  saveCustomCertification,
  saveCustomRole,
  saveCustomSector,
  saveCustomSkill,
} from '../../lib/studentRegistrationSuggestions';

const TOP_VIZAG_COLLEGES = [
  'Andhra University',
  'GITAM University',
  'Gayatri Vidya Parishad (GVP)',
  'ANITS',
  'Raghu Engineering College',
  'MVGR College of Engineering',
  'Vignan Institute of Information Technology',
  'Dr. L. Bullayya College',
];

const POPULAR_SKILL_SUGGESTIONS = [
  'java',
  'python',
  'javascript',
  'react',
  'sql',
  'html css',
  'ms excel',
  'communication',
  'sales',
  'customer support',
  'tally',
  'digital marketing',
];

export default function StudentRegisterWizard({
  form,
  password,
  onFormChange,
  onFresherChange,
  onPasswordChange,
  onToggleSkill,
  onAddSkill,
  onToggleTargetCategory,
  onAddTargetCategory,
  onTogglePreferredLocation,
  consents,
  onConsentsChange,
  onSubmit,
  isSubmitting,
  submitError,
  loginPath,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Errors, setStep1Errors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [customCategoryDraft, setCustomCategoryDraft] = useState('');
  const [customSkillDraft, setCustomSkillDraft] = useState('');
  const [liveRoles, setLiveRoles] = useState([]);

  // Persistence and autocomplete states
  const [savedCustomSectors, setSavedCustomSectors] = useState([]);
  const [sectorLimitWarning, setSectorLimitWarning] = useState('');

  const [savedCustomSkills, setSavedCustomSkills] = useState([]);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);

  const [savedCustomRoles, setSavedCustomRoles] = useState([]);
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);

  const [savedCustomCerts, setSavedCustomCerts] = useState([]);
  const [showCertSuggestions, setShowCertSuggestions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLiveJobRoles(60).then((roles) => {
      if (!cancelled) setLiveRoles(roles);
    });

    setSavedCustomSectors(loadSavedCustomSectors());
    setSavedCustomSkills(loadSavedCustomSkills());
    setSavedCustomRoles(loadSavedCustomRoles());
    setSavedCustomCerts(loadSavedCustomCertifications());

    return () => {
      cancelled = true;
    };
  }, []);

  const validateStep1 = () => {
    const errors = {};
    if (!String(form.full_name || '').trim()) {
      errors.full_name = 'Please enter your full name.';
    }

    const cleanPhone = normalizeStudentPhone(form.phone);
    if (!cleanPhone || !isValidStudentPhone(cleanPhone)) {
      errors.phone = 'Please enter a valid 10-digit Indian mobile number.';
    }

    const email = String(form.contact_email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.contact_email = 'Please enter a valid email address.';
    }

    if (!password || password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStep1Continue = (e) => {
    e.preventDefault();
    if (validateStep1()) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCollegePillClick = (collegeName) => {
    onFormChange({ target: { name: 'college', value: collegeName } });
  };

  // --- SECTOR MANAGEMENT (MAX 3) ---
  const allSectorOptions = useMemo(() => {
    const list = [...STUDENT_JOB_CATEGORY_OPTIONS];
    for (const item of savedCustomSectors) {
      if (!list.some((o) => o.value === item.value)) {
        list.push(item);
      }
    }
    return list;
  }, [savedCustomSectors]);

  const handleToggleSector = (catValue) => {
    const isSelected = form.target_job_categories.includes(catValue);
    if (isSelected) {
      setSectorLimitWarning('');
      onToggleTargetCategory(catValue);
    } else {
      if (form.target_job_categories.length >= 3) {
        setSectorLimitWarning('You can select a maximum of 3 target sectors.');
        return;
      }
      setSectorLimitWarning('');
      onToggleTargetCategory(catValue);
    }
  };

  const handleAddCustomCategory = () => {
    const raw = customCategoryDraft.trim();
    if (!raw) return;
    const token = resolveTargetJobCategoryToken(raw, allSectorOptions);
    if (!token) return;

    // Save so future students see this chip
    const updated = saveCustomSector(raw);
    setSavedCustomSectors(updated);

    if (form.target_job_categories.includes(token)) {
      setCustomCategoryDraft('');
      return;
    }

    if (form.target_job_categories.length >= 3) {
      setSectorLimitWarning(`Added "${raw}" to sectors list! (Maximum 3 can be selected)`);
    } else {
      if (onAddTargetCategory) {
        onAddTargetCategory(token);
      } else {
        onToggleTargetCategory(token);
      }
      setSectorLimitWarning('');
    }
    setCustomCategoryDraft('');
  };

  // --- SKILLS MANAGEMENT & DYNAMIC AUTOCOMPLETE ---
  const allSkillPills = useMemo(() => {
    const list = [...POPULAR_SKILL_SUGGESTIONS];
    for (const s of savedCustomSkills) {
      if (!list.includes(s)) {
        list.push(s);
      }
    }
    return list;
  }, [savedCustomSkills]);

  const skillSuggestions = useMemo(() => {
    if (!customSkillDraft.trim()) return [];
    const candidates = [
      ...STUDENT_SKILL_OPTIONS.map((o) => o.label),
      ...savedCustomSkills.map((s) => formatSkillLabel(s)),
    ];
    return filterSuggestions(customSkillDraft, candidates, 6);
  }, [customSkillDraft, savedCustomSkills]);

  const handleSelectSkill = (skillText) => {
    const token = resolveSkillToken(skillText);
    if (token) {
      const updated = saveCustomSkill(skillText);
      setSavedCustomSkills(updated);
      if (onAddSkill) {
        onAddSkill(token);
      } else {
        onToggleSkill(token);
      }
      setCustomSkillDraft('');
      setShowSkillSuggestions(false);
    }
  };

  const handleAddCustomSkill = () => {
    handleSelectSkill(customSkillDraft);
  };

  // --- PRIMARY TARGET ROLE AUTOCOMPLETE ---
  const roleSuggestions = useMemo(() => {
    const val = form.primary_target_role;
    if (!val || val.length < 1) return [];
    const candidates = [
      ...liveRoles.map((r) => r.role),
      ...POPULAR_VIZAG_ROLES,
      ...savedCustomRoles,
    ];
    return filterSuggestions(val, candidates, 6);
  }, [form.primary_target_role, liveRoles, savedCustomRoles]);

  const handleSelectRole = (roleText) => {
    onFormChange({ target: { name: 'primary_target_role', value: roleText } });
    const updated = saveCustomRole(roleText);
    setSavedCustomRoles(updated);
    setShowRoleSuggestions(false);
  };

  // --- CERTIFICATIONS CHIPS & AUTOCOMPLETE ---
  const popularCertChips = useMemo(() => {
    const list = [...POPULAR_CERTIFICATIONS];
    for (const c of savedCustomCerts) {
      if (!list.includes(c)) {
        list.push(c);
      }
    }
    return list.slice(0, 10);
  }, [savedCustomCerts]);

  const certSuggestions = useMemo(() => {
    const val = form.certifications === 'None' ? '' : form.certifications;
    if (!val || val.length < 1) return [];
    const candidates = [...POPULAR_CERTIFICATIONS, ...savedCustomCerts];
    return filterSuggestions(val, candidates, 6);
  }, [form.certifications, savedCustomCerts]);

  const handleToggleCertChip = (certName) => {
    const current = (form.certifications === 'None' ? '' : form.certifications || '').trim();
    const parts = current ? current.split(',').map((p) => p.trim()).filter(Boolean) : [];
    const exists = parts.some((p) => p.toLowerCase() === certName.toLowerCase());
    let next;
    if (exists) {
      next = parts.filter((p) => p.toLowerCase() !== certName.toLowerCase()).join(', ');
    } else {
      next = parts.length > 0 ? `${current}, ${certName}` : certName;
    }
    onFormChange({ target: { name: 'certifications', value: next } });
    const updated = saveCustomCertification(certName);
    setSavedCustomCerts(updated);
  };

  const handleSelectCertSuggestion = (certName) => {
    handleToggleCertChip(certName);
    setShowCertSuggestions(false);
  };

  // --- GRADUATION YEARS (2010–2030) ---
  const popularGraduationYears = useMemo(() => {
    return ['2027', '2026', '2025', '2024', '2023', '2022'];
  }, []);

  const handleFinalSubmit = (e) => {
    if (form.primary_target_role) {
      saveCustomRole(form.primary_target_role);
    }
    if (form.certifications && form.certifications !== 'None') {
      saveCustomCertification(form.certifications);
    }
    onSubmit(e);
  };

  return (
    <div>
      {/* Visual Stepper Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={currentStep === 2 ? handleBackToStep1 : undefined}
            className={`flex items-center gap-2 text-left transition ${
              currentStep === 1
                ? 'text-indigo-600'
                : 'text-emerald-600 hover:text-emerald-700'
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm ${
                currentStep === 1
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {currentStep > 1 ? '✓' : '1'}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Step 1</p>
              <p className="text-sm font-bold text-slate-900">Account Credentials</p>
            </div>
          </button>

          <div className="mx-4 h-1 flex-1 rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                currentStep === 1 ? 'w-1/2 bg-indigo-500' : 'w-full bg-emerald-500'
              }`}
            />
          </div>

          <div
            className={`flex items-center gap-2 text-left ${
              currentStep === 2 ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm ${
                currentStep === 2
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                  : 'border border-slate-200 bg-white text-slate-400'
              }`}
            >
              2
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Step 2</p>
              <p
                className={`text-sm font-bold ${
                  currentStep === 2 ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                Education & Skills
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-xs font-medium text-slate-500">
          {currentStep === 1
            ? 'Step 1 of 2 · Basic credentials (takes ~20 seconds)'
            : 'Step 2 of 2 · Education & career preferences (almost done!)'}
        </p>
      </div>

      {/* STEP 1: ACCOUNT CREDENTIALS */}
      {currentStep === 1 ? (
        <form onSubmit={handleStep1Continue} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Full Name *
            </label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={(e) => {
                onFormChange(e);
                if (step1Errors.full_name) setStep1Errors((prev) => ({ ...prev, full_name: '' }));
              }}
              placeholder="e.g. Ramesh Kumar"
              autoComplete="name"
              className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                step1Errors.full_name
                  ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-100'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
              }`}
            />
            {step1Errors.full_name ? (
              <p className="mt-1.5 text-xs text-rose-600">{step1Errors.full_name}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Mobile Number *
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <span className="text-sm font-semibold text-slate-500">+91</span>
              </div>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={(e) => {
                  onFormChange(e);
                  if (step1Errors.phone) setStep1Errors((prev) => ({ ...prev, phone: '' }));
                }}
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                autoComplete="tel"
                className={`h-12 w-full rounded-2xl border pl-14 pr-4 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                  step1Errors.phone
                    ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
                }`}
              />
            </div>
            {step1Errors.phone ? (
              <p className="mt-1.5 text-xs text-rose-600">{step1Errors.phone}</p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                Employers in Vizag will contact you directly on this number.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Email Address *
            </label>
            <input
              type="email"
              name="contact_email"
              value={form.contact_email}
              onChange={(e) => {
                onFormChange(e);
                if (step1Errors.contact_email) {
                  setStep1Errors((prev) => ({ ...prev, contact_email: '' }));
                }
              }}
              placeholder="you@gmail.com"
              autoComplete="email"
              className={`mt-2 h-12 w-full rounded-2xl border px-4 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                step1Errors.contact_email
                  ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-100'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
              }`}
            />
            {step1Errors.contact_email ? (
              <p className="mt-1.5 text-xs text-rose-600">{step1Errors.contact_email}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Password *
            </label>
            <div className="relative mt-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  onPasswordChange(e.target.value);
                  if (step1Errors.password) setStep1Errors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Choose a secure password (min 6 characters)"
                autoComplete="new-password"
                className={`h-12 w-full rounded-2xl border px-4 pr-12 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                  step1Errors.password
                    ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {step1Errors.password ? (
              <p className="mt-1.5 text-xs text-rose-600">{step1Errors.password}</p>
            ) : null}
          </div>

          <div>
            <span className="block text-sm font-semibold text-slate-700">
              Experience Level *
            </span>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onFresherChange('yes')}
                className={`flex flex-col items-center justify-center rounded-2xl border p-3.5 text-center transition ${
                  form.is_fresher === true
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-xl">🎓</span>
                <span className="mt-1 text-sm font-bold text-slate-900">Fresher</span>
                <span className="text-xs text-slate-500">Student or 0-1 yr exp</span>
              </button>
              <button
                type="button"
                onClick={() => onFresherChange('no')}
                className={`flex flex-col items-center justify-center rounded-2xl border p-3.5 text-center transition ${
                  form.is_fresher === false
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-xl">💼</span>
                <span className="mt-1 text-sm font-bold text-slate-900">Experienced</span>
                <span className="text-xs text-slate-500">1+ years experience</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            <span>Continue to Step 2: Education & Skills</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </form>
      ) : (
        /* STEP 2: EDUCATION & CAREER PROFILE */
        <form onSubmit={handleFinalSubmit} className="space-y-6">
          {/* Top Back Button */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <button
              type="button"
              onClick={handleBackToStep1}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Account Info
            </button>
            <span className="text-xs font-semibold text-slate-500">
              Registered for: <strong className="text-slate-800">{form.contact_email}</strong>
            </span>
          </div>

          {/* College with Quick Vizag Badges */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              College / University *
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Click a Vizag college badge to auto-fill, or type your college name below:
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {TOP_VIZAG_COLLEGES.map((college) => {
                const isSelected = form.college === college;
                return (
                  <button
                    key={college}
                    type="button"
                    onClick={() => handleCollegePillClick(college)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-white'
                    }`}
                  >
                    {college}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              name="college"
              value={form.college}
              onChange={onFormChange}
              required
              placeholder="Or type your college / institute name"
              className="mt-2.5 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          {/* Degree & Branch (Includes ITI) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Degree / Qualification *
              </label>
              <select
                name="degree"
                value={form.degree}
                onChange={onFormChange}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="">Select Degree / Course</option>
                {STUDENT_DEGREE_OPTIONS.map((deg) => (
                  <option key={deg} value={deg}>
                    {deg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Branch / Stream / Trade *
              </label>
              <select
                name="branch"
                value={form.branch}
                onChange={onFormChange}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="">Select Branch / Trade</option>
                {STUDENT_BRANCH_OPTIONS.map((br) => (
                  <option key={br} value={br}>
                    {br}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Graduation Year (2010 to 2030) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-700">
                Graduation Year *
              </label>
              <span className="text-xs font-medium text-slate-400">
                Class of 2010 to 2030
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {popularGraduationYears.map((yr) => {
                const isSelected = String(form.graduation_year) === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() =>
                      onFormChange({ target: { name: 'graduation_year', value: yr } })
                    }
                    className={`rounded-2xl border px-3.5 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}

              {/* Full range dropdown for 2010–2030 */}
              <select
                name="graduation_year"
                value={form.graduation_year}
                onChange={onFormChange}
                required
                className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="">Or select all years (2010 – 2030)</option>
                {STUDENT_GRADUATION_YEAR_OPTIONS.map((yr) => (
                  <option key={yr} value={yr}>
                    Class of {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Job Categories (Max 3, saved for future students) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-700">
                Which sectors are you targeting? *
              </label>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  form.target_job_categories.length >= 3
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-indigo-50 text-indigo-700'
                }`}
              >
                {form.target_job_categories.length} / 3 selected
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Select up to 3 sectors to receive matching job alerts in Vizag:
            </p>

            {sectorLimitWarning ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                ⚠️ {sectorLimitWarning}
              </div>
            ) : null}

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {allSectorOptions.map((cat) => {
                const isSelected = form.target_job_categories.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleToggleSector(cat.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={customCategoryDraft}
                onChange={(e) => setCustomCategoryDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomCategory();
                  }
                }}
                placeholder="Or type custom sector (e.g. Hotel Management, Marine Engineering)"
                className="h-10 flex-1 rounded-2xl border border-slate-200 px-3.5 text-xs text-slate-900 outline-none transition focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddCustomCategory}
                className="shrink-0 rounded-2xl border border-indigo-200 bg-indigo-50 px-3.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                + Add Sector
              </button>
            </div>
          </div>

          {/* Primary Target Role with Live Suggestions */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-700">
              Primary Target Role *
            </label>
            <input
              type="text"
              name="primary_target_role"
              value={form.primary_target_role}
              onChange={(e) => {
                onFormChange(e);
                setShowRoleSuggestions(true);
              }}
              onFocus={() => setShowRoleSuggestions(true)}
              onBlur={() => {
                // Short timeout to allow clicking a suggestion
                setTimeout(() => setShowRoleSuggestions(false), 200);
              }}
              required
              placeholder="e.g. Java Developer, Site Engineer, Telecaller, Accountant"
              autoComplete="off"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
            {showRoleSuggestions && form.primary_target_role.trim().length > 0 && roleSuggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Suggested Roles in Vizag
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRoleSuggestions(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    ✕ Close
                  </button>
                </div>
                {roleSuggestions.map((roleText) => (
                  <button
                    key={roleText}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectRole(roleText)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-800 transition hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <span>{roleText}</span>
                    <span className="text-[10px] text-slate-400">Select ↵</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Skills with Chips and Typing Suggestions */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-700">
              Your Top Skills *
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Pick skills employers look for or add your own:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allSkillPills.map((skillKey) => {
                const isSelected = form.skills.includes(skillKey);
                return (
                  <button
                    key={skillKey}
                    type="button"
                    onClick={() => onToggleSkill(skillKey)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200'
                    }`}
                  >
                    {formatSkillLabel(skillKey)}
                  </button>
                );
              })}
            </div>

            <div className="relative mt-2.5 flex gap-2">
              <input
                type="text"
                value={customSkillDraft}
                onChange={(e) => {
                  setCustomSkillDraft(e.target.value);
                  setShowSkillSuggestions(true);
                }}
                onFocus={() => setShowSkillSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowSkillSuggestions(false), 200);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomSkill();
                  }
                }}
                placeholder="Type skill to see suggestions or add custom (e.g. Docker, AutoCAD, Photoshop)"
                className="h-10 flex-1 rounded-2xl border border-slate-200 px-3.5 text-xs text-slate-900 outline-none transition focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddCustomSkill}
                className="shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                + Add Skill
              </button>
            </div>

            {showSkillSuggestions && customSkillDraft.trim().length > 0 && skillSuggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Matching Skills ({skillSuggestions.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSkillSuggestions(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    ✕ Close
                  </button>
                </div>
                {skillSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSkill(sug)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-xs font-medium text-slate-800 transition hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <span>{sug}</span>
                    <span className="text-[10px] text-slate-400">+ Add</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Preferred Locations */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Preferred Work Locations *
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STUDENT_PREFERRED_LOCATION_OPTIONS.map((loc) => {
                const isSelected = form.preferred_locations.includes(loc);
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => onTogglePreferredLocation(loc)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      isSelected
                        ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200'
                    }`}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Experience level if not fresher */}
          {form.is_fresher === false ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Experience in this role *
              </label>
              <select
                name="role_experience_level"
                value={form.role_experience_level}
                onChange={onFormChange}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              >
                {STUDENT_ROLE_EXPERIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Joining Availability */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Joining Availability *
            </label>
            <select
              name="availability"
              value={form.availability}
              onChange={onFormChange}
              required
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            >
              {STUDENT_AVAILABILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Certifications or Courses with Chips & Suggestions */}
          <div className="relative">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-700">
                Certifications or Courses
              </label>
              <span className="text-xs text-slate-400">Optional</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Click a popular certification badge or type your own:
            </p>

            {/* Popular certification chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {popularCertChips.map((certName) => {
                const current = form.certifications === 'None' ? '' : form.certifications || '';
                const isSelected = current.toLowerCase().includes(certName.toLowerCase());
                return (
                  <button
                    key={certName}
                    type="button"
                    onClick={() => handleToggleCertChip(certName)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-white'
                    }`}
                  >
                    {certName}
                  </button>
                );
              })}
            </div>

            <div className="relative mt-2">
              <input
                type="text"
                name="certifications"
                value={form.certifications === 'None' ? '' : form.certifications}
                onChange={(e) => {
                  onFormChange(e);
                  setShowCertSuggestions(true);
                }}
                onFocus={() => setShowCertSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowCertSuggestions(false), 200);
                }}
                placeholder="e.g. AWS Certified, Full Stack Java, Digital Marketing, Tally Prime"
                autoComplete="off"
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />

              {showCertSuggestions && form.certifications && form.certifications !== 'None' && certSuggestions.length > 0 ? (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Suggested Certifications ({certSuggestions.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCertSuggestions(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600"
                    >
                      ✕ Close
                    </button>
                  </div>
                  {certSuggestions.map((cert) => (
                    <button
                      key={cert}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectCertSuggestion(cert)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-xs font-medium text-slate-800 transition hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <span>{cert}</span>
                      <span className="text-[10px] text-slate-400">+ Add</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Consents Component */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <StudentRegistrationConsent values={consents} onChange={onConsentsChange} />
          </div>

          {submitError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <p className="font-semibold">Unable to register:</p>
              <p className="mt-1">{submitError}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleBackToStep1}
              className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Complete Registration & Apply →</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Footer Switch to Sign In */}
      <div className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
        Already have a student account?{' '}
        <Link to={loginPath} className="font-bold text-indigo-600 hover:underline">
          Sign in here
        </Link>
      </div>
    </div>
  );
}
