// Validation rules used across all forms

export const rules = {
  required: (v) => (!v || !String(v).trim() ? 'This field is required.' : ''),

  minLength: (min) => (v) =>
    v && v.length < min ? `Must be at least ${min} characters.` : '',

  email: (v) =>
    v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter a valid email address.' : '',

  phone: (v) =>
    v && !/^\d{10}$/.test(v.replace(/\s/g, '')) ? 'Must be a 10-digit phone number.' : '',

  gst: (v) =>
    v && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v)
      ? 'Invalid GST format (e.g. 24AABCT1234D1Z5).'
      : '',

  pan: (v) =>
    v && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v)
      ? 'Invalid PAN format (e.g. ABCDE1234F).'
      : '',

  aadhar: (v) =>
    v && !/^\d{12}$/.test(v.replace(/\s/g, ''))
      ? 'Must be a 12-digit Aadhar number.'
      : '',

  password: (v) =>
    v && v.length < 8 ? 'Password must be at least 8 characters.' : '',

  futureDate: (v) =>
    v && new Date(v) < new Date(new Date().toDateString()) ? 'Deadline cannot be in the past.' : '',

  selectRequired: (v) => (!v ? 'Please select an option.' : ''),
};

// Compose multiple rules: returns first error message found
export const validate = (value, ...fns) => {
  for (const fn of fns) {
    const err = fn(value);
    if (err) return err;
  }
  return '';
};

// Validate an entire form object given a schema
// schema: { fieldName: [rule1, rule2, ...] }
// Returns { fieldName: 'error message' | '' }
export const validateForm = (values, schema) => {
  const errors = {};
  for (const [field, ruleFns] of Object.entries(schema)) {
    errors[field] = validate(values[field], ...ruleFns);
  }
  return errors;
};

// Returns true if no errors
export const isValid = (errors) => Object.values(errors).every(e => !e);
