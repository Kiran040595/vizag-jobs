export const quickInputClass =
  "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:outline-2 focus:outline-blue-600";
export default function QuickFormFields({
  fields,
  answers,
  onChange,
  disabled = false,
  previewMode = false,
}) {
  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.id}>
          <label
            className="mb-2 block font-semibold text-slate-800"
            htmlFor={`quick-${field.id}`}
          >
            {field.label}
            {field.required ? " *" : " (optional)"}
          </label>
          {["radio", "checkbox"].includes(field.type) ? (
            <fieldset
              disabled={disabled}
              aria-label={field.label}
              className="flex flex-wrap gap-2"
            >
              {field.options.map((option) => (
                <label
                  key={option}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-300 px-4 py-3"
                >
                  <input
                    type={field.type}
                    name={field.id}
                    value={option}
                    checked={
                      field.type === "checkbox"
                        ? (answers[field.id] || []).includes(option)
                        : answers[field.id] === option
                    }
                    onChange={(e) =>
                      onChange(
                        field.id,
                        field.type === "checkbox"
                          ? e.target.checked
                            ? [...(answers[field.id] || []), option]
                            : (answers[field.id] || []).filter(
                                (v) => v !== option,
                              )
                          : option,
                      )
                    }
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ) : field.type === "select" ? (
            <select
              id={`quick-${field.id}`}
              className={quickInputClass}
              required={field.required && !previewMode}
              disabled={disabled}
              value={answers[field.id] || ""}
              onChange={(e) => onChange(field.id, e.target.value)}
            >
              <option value="">Choose an option</option>
              {field.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              id={`quick-${field.id}`}
              className={quickInputClass}
              required={field.required && !previewMode}
              disabled={disabled}
              maxLength={2000}
              value={answers[field.id] || ""}
              onChange={(e) => onChange(field.id, e.target.value)}
            />
          ) : (
            <input
              id={`quick-${field.id}`}
              className={quickInputClass}
              type={field.id === "phone" ? "tel" : field.type}
              inputMode={
                field.id === "phone"
                  ? "tel"
                  : field.type === "number"
                    ? "decimal"
                    : undefined
              }
              autoComplete={
                field.id === "full_name"
                  ? "name"
                  : field.id === "phone"
                    ? "tel"
                    : field.type === "email"
                      ? "email"
                      : undefined
              }
              required={field.required && !previewMode}
              disabled={disabled}
              maxLength={200}
              min={field.type === "number" ? 0 : undefined}
              value={answers[field.id] || ""}
              onChange={(e) => onChange(field.id, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
