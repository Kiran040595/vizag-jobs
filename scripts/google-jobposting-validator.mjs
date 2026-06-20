// Google JobPosting structured data validator.
// Spec: https://developers.google.com/search/docs/appearance/structured-data/job-posting

const VALID_EMPLOYMENT_TYPES = new Set([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACTOR',
  'TEMPORARY',
  'INTERN',
  'VOLUNTEER',
  'PER_DIEM',
  'OTHER',
]);

const VALID_JOB_LOCATION_TYPES = new Set(['TELECOMMUTE']);

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isIsoDate = (value) => {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const collectIssues = (schema) => {
  const errors = [];
  const warnings = [];
  const passes = [];

  const must = (label, condition, detail) => {
    if (condition) {
      passes.push(label);
    } else {
      errors.push(`${label}${detail ? ` -- ${detail}` : ''}`);
    }
  };

  const should = (label, condition, detail) => {
    if (condition) {
      passes.push(label);
    } else {
      warnings.push(`${label}${detail ? ` -- ${detail}` : ''}`);
    }
  };

  if (!isObject(schema)) {
    errors.push('Schema is not a plain object');
    return { errors, warnings, passes };
  }

  // ---- @context / @type ----
  must(
    '@context is schema.org',
    typeof schema['@context'] === 'string' &&
      /^https?:\/\/schema\.org\/?$/.test(schema['@context']),
    `got: ${JSON.stringify(schema['@context'])}`,
  );
  must('@type is JobPosting', schema['@type'] === 'JobPosting');

  // ---- title (REQUIRED) ----
  must(
    'title is non-empty string',
    typeof schema.title === 'string' && schema.title.trim().length > 0,
  );
  should(
    'title is under 110 chars (Google guideline)',
    typeof schema.title === 'string' && schema.title.length <= 110,
    `length: ${schema.title?.length}`,
  );

  // ---- description (REQUIRED, must be HTML, >=50 chars) ----
  const description = schema.description;
  must(
    'description is non-empty string',
    typeof description === 'string' && description.trim().length > 0,
  );
  must(
    'description is at least 50 chars',
    typeof description === 'string' && description.trim().length >= 50,
    `length: ${description?.length}`,
  );
  should(
    'description contains HTML tags (Google requires HTML)',
    typeof description === 'string' && /<\/?[a-z][^>]*>/i.test(description),
    'no <p>, <ul>, <br>, etc. detected',
  );

  // ---- datePosted (REQUIRED) ----
  must('datePosted is valid ISO 8601 date', isIsoDate(schema.datePosted));

  // ---- validThrough (RECOMMENDED) ----
  if (schema.validThrough !== undefined) {
    must('validThrough is valid ISO 8601 date', isIsoDate(schema.validThrough));
    if (isIsoDate(schema.validThrough)) {
      const validThrough = new Date(schema.validThrough);
      should(
        'validThrough is in the future (job not expired)',
        validThrough.getTime() > Date.now(),
        `validThrough: ${schema.validThrough}`,
      );
    }
  } else {
    warnings.push('validThrough is missing (recommended)');
  }

  // ---- employmentType (RECOMMENDED) ----
  if (schema.employmentType !== undefined) {
    const types = Array.isArray(schema.employmentType)
      ? schema.employmentType
      : [schema.employmentType];
    const allValid = types.every((t) => VALID_EMPLOYMENT_TYPES.has(t));
    must(
      `employmentType uses valid enum (${[...VALID_EMPLOYMENT_TYPES].join(', ')})`,
      allValid,
      `got: ${JSON.stringify(schema.employmentType)}`,
    );
  } else {
    warnings.push('employmentType is missing (recommended)');
  }

  // ---- hiringOrganization (REQUIRED) ----
  must('hiringOrganization is object', isObject(schema.hiringOrganization));
  if (isObject(schema.hiringOrganization)) {
    must(
      'hiringOrganization.@type is Organization',
      schema.hiringOrganization['@type'] === 'Organization',
    );
    must(
      'hiringOrganization.name is non-empty string',
      typeof schema.hiringOrganization.name === 'string' &&
        schema.hiringOrganization.name.trim().length > 0,
    );
    if (schema.hiringOrganization.logo !== undefined) {
      should(
        'hiringOrganization.logo is absolute URL',
        typeof schema.hiringOrganization.logo === 'string' &&
          /^https?:\/\//i.test(schema.hiringOrganization.logo),
      );
    }
  }

  // ---- jobLocation OR jobLocationType=TELECOMMUTE (REQUIRED) ----
  const isRemote = schema.jobLocationType === 'TELECOMMUTE';
  if (isRemote) {
    must(
      'jobLocationType is TELECOMMUTE (valid value)',
      VALID_JOB_LOCATION_TYPES.has(schema.jobLocationType),
    );
    must(
      'remote job requires applicantLocationRequirements',
      isObject(schema.applicantLocationRequirements),
    );
  } else {
    must('jobLocation is object', isObject(schema.jobLocation));
    if (isObject(schema.jobLocation)) {
      must(
        'jobLocation.@type is Place',
        schema.jobLocation['@type'] === 'Place',
      );
      must('jobLocation.address is object', isObject(schema.jobLocation.address));
      if (isObject(schema.jobLocation.address)) {
        must(
          'jobLocation.address.@type is PostalAddress',
          schema.jobLocation.address['@type'] === 'PostalAddress',
        );
        must(
          'jobLocation.address.addressCountry is set',
          typeof schema.jobLocation.address.addressCountry === 'string' &&
            schema.jobLocation.address.addressCountry.length > 0,
        );
        should(
          'jobLocation.address.addressLocality is set',
          typeof schema.jobLocation.address.addressLocality === 'string' &&
            schema.jobLocation.address.addressLocality.length > 0,
        );
        should(
          'jobLocation.address.addressRegion is set',
          typeof schema.jobLocation.address.addressRegion === 'string' &&
            schema.jobLocation.address.addressRegion.length > 0,
        );
        should(
          'jobLocation.address.postalCode is set',
          typeof schema.jobLocation.address.postalCode === 'string' &&
            /^\d{6}$/.test(schema.jobLocation.address.postalCode),
        );
      }
    }
  }

  // ---- baseSalary (RECOMMENDED) ----
  if (schema.baseSalary !== undefined) {
    must(
      'baseSalary.@type is MonetaryAmount',
      isObject(schema.baseSalary) && schema.baseSalary['@type'] === 'MonetaryAmount',
    );
    if (isObject(schema.baseSalary)) {
      must(
        'baseSalary.currency is set',
        typeof schema.baseSalary.currency === 'string' &&
          /^[A-Z]{3}$/.test(schema.baseSalary.currency),
      );
      must('baseSalary.value is object', isObject(schema.baseSalary.value));
      if (isObject(schema.baseSalary.value)) {
        must(
          'baseSalary.value.@type is QuantitativeValue',
          schema.baseSalary.value['@type'] === 'QuantitativeValue',
        );
        const hasValue =
          typeof schema.baseSalary.value.value === 'number' ||
          (typeof schema.baseSalary.value.minValue === 'number' &&
            typeof schema.baseSalary.value.maxValue === 'number');
        must('baseSalary.value has value or minValue+maxValue', hasValue);
        must(
          'baseSalary.value.unitText is HOUR/DAY/WEEK/MONTH/YEAR',
          ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'].includes(
            schema.baseSalary.value.unitText,
          ),
        );
      }
    }
  } else {
    warnings.push('baseSalary is missing (recommended)');
  }

  // ---- identifier (RECOMMENDED) ----
  if (schema.identifier !== undefined) {
    must(
      'identifier.@type is PropertyValue',
      isObject(schema.identifier) && schema.identifier['@type'] === 'PropertyValue',
    );
    if (isObject(schema.identifier)) {
      must(
        'identifier.name is non-empty string',
        typeof schema.identifier.name === 'string' && schema.identifier.name.length > 0,
      );
      must(
        'identifier.value is non-empty',
        schema.identifier.value !== undefined &&
          schema.identifier.value !== null &&
          String(schema.identifier.value).length > 0,
      );
    }
  } else {
    warnings.push('identifier is missing (recommended)');
  }

  // ---- directApply (RECOMMENDED in 2024+) ----
  if (schema.directApply !== undefined) {
    must('directApply is boolean', typeof schema.directApply === 'boolean');
  } else {
    warnings.push('directApply is missing (recommended for newer Google rules)');
  }

  return { errors, warnings, passes };
};

export const validateJobPostingSchema = (schema) => {
  const { errors, warnings, passes } = collectIssues(schema);
  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    passCount: passes.length,
    errors,
    warnings,
    passes,
  };
};

export const printValidationReport = (label, result) => {
  const status = result.valid ? 'VALID' : 'INVALID';
  console.log(`\n  [${status}] ${label}`);
  console.log(
    `    ${result.passCount} checks pass, ${result.errorCount} errors, ${result.warningCount} warnings`,
  );
  if (result.errors.length > 0) {
    console.log('    ERRORS:');
    for (const err of result.errors) console.log(`      - ${err}`);
  }
  if (result.warnings.length > 0) {
    console.log('    WARNINGS:');
    for (const w of result.warnings) console.log(`      - ${w}`);
  }
};
