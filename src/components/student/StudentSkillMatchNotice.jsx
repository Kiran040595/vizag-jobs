export default function StudentSkillMatchNotice({ className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-950 ${className}`}
    >
      <p className="font-semibold">How we help you get hired</p>
      <p className="mt-1 text-indigo-900">
        Mention your skills, degree, and certifications in your profile. When a company in Vizag posts a
        role that matches your profile (for example Java developer, frontend developer, or delivery
        executive), we can share your details with that employer for recruitment.
      </p>
    </div>
  );
}
