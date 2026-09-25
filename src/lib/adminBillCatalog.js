/** Preset services sold to companies (job post, Instagram reel, etc.). */

export const BILL_SERVICE_CATALOG = [
  {
    key: 'website_job_post',
    label: 'Website job post',
    description: 'Job listing published on JobsInVizag.in',
    defaultUnitPrice: 499,
  },
  {
    key: 'instagram_reel',
    label: 'Instagram reel post',
    description: 'Instagram reel / story promotion for the job opening',
    defaultUnitPrice: 999,
  },
  {
    key: 'featured_listing',
    label: 'Featured job listing',
    description: 'Featured placement on the JobsInVizag.in home and jobs pages',
    defaultUnitPrice: 799,
  },
  {
    key: 'youtube_short',
    label: 'YouTube Short promotion',
    description: 'YouTube Short video promotion for the job opening',
    defaultUnitPrice: 1499,
  },
  {
    key: 'job_bundle',
    label: 'Job + Instagram bundle',
    description: 'Website job post with Instagram reel promotion',
    defaultUnitPrice: 1299,
  },
  {
    key: 'custom',
    label: 'Custom service',
    description: '',
    defaultUnitPrice: 0,
  },
];

export const getServiceCatalogItem = (key) =>
  BILL_SERVICE_CATALOG.find((item) => item.key === key) || BILL_SERVICE_CATALOG[BILL_SERVICE_CATALOG.length - 1];

export const createEmptyLineItem = (serviceKey = 'website_job_post') => {
  const service = getServiceCatalogItem(serviceKey);
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    serviceKey: service.key,
    description: service.description || service.label,
    quantity: 1,
    unitPrice: service.defaultUnitPrice,
  };
};

export const computeLineAmount = (quantity, unitPrice) => {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  return Math.round(qty * price * 100) / 100;
};

export const computeBillTotals = (lineItems = [], taxPercent = 0) => {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + computeLineAmount(item.quantity, item.unitPrice),
    0,
  );
  const tax = Math.round(subtotal * (Number(taxPercent) || 0) * 100) / 10000;
  const taxAmount = Math.round(tax * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount,
    totalAmount,
  };
};

export const formatBillMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatBillDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const todayIsoDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
};
