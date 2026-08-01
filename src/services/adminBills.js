import { supabase } from '../lib/supabaseClient';
import {
  computeBillTotals,
  computeLineAmount,
  getServiceCatalogItem,
} from '../lib/adminBillCatalog';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const mapBillLineItemRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    billId: row.bill_id,
    serviceKey: row.service_key || 'custom',
    description: row.description || '',
    quantity: toNumber(row.quantity, 1),
    unitPrice: toNumber(row.unit_price, 0),
    amount: toNumber(row.amount, 0),
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
  };
};

export const mapBillRow = (row, lineItems = []) => {
  if (!row) return null;

  const items = (lineItems || [])
    .map(mapBillLineItemRow)
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: row.id,
    billNumber: row.bill_number,
    companyName: row.company_name || '',
    employerUserId: row.employer_user_id || null,
    contactName: row.contact_name || '',
    contactEmail: row.contact_email || '',
    contactPhone: row.contact_phone || '',
    companyAddress: row.company_address || '',
    companyGstin: row.company_gstin || '',
    billDate: row.bill_date,
    dueDate: row.due_date || null,
    status: row.status || 'issued',
    notes: row.notes || '',
    subtotal: toNumber(row.subtotal, 0),
    taxPercent: toNumber(row.tax_percent, 0),
    taxAmount: toNumber(row.tax_amount, 0),
    totalAmount: toNumber(row.total_amount, 0),
    paymentStatus: row.payment_status || 'unpaid',
    paymentNotes: row.payment_notes || '',
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineItems: items,
  };
};

const allocateBillNumber = async () => {
  const { data, error } = await supabase.rpc('next_bill_number');
  if (error) {
    throw mapError(error, 'Could not allocate bill number.');
  }
  if (!data || typeof data !== 'string') {
    throw new Error('Bill number was not returned by the database.');
  }
  return data;
};

export const fetchAdminBills = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw mapError(error, 'Could not load bills.');
  }

  return (data || []).map((row) => mapBillRow(row));
};

export const fetchAdminBillById = async (billId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  if (!billId) {
    throw new Error('Bill id is required.');
  }

  const [billResult, itemsResult] = await Promise.all([
    supabase.from('bills').select('*').eq('id', billId).maybeSingle(),
    supabase
      .from('bill_line_items')
      .select('*')
      .eq('bill_id', billId)
      .order('sort_order', { ascending: true }),
  ]);

  if (billResult.error) {
    throw mapError(billResult.error, 'Could not load bill.');
  }
  if (!billResult.data) {
    throw new Error('Bill not found.');
  }
  if (itemsResult.error) {
    throw mapError(itemsResult.error, 'Could not load bill line items.');
  }

  return mapBillRow(billResult.data, itemsResult.data || []);
};

/**
 * @param {{
 *   companyName: string,
 *   employerUserId?: string|null,
 *   contactName?: string,
 *   contactEmail?: string,
 *   contactPhone?: string,
 *   companyAddress?: string,
 *   companyGstin?: string,
 *   billDate: string,
 *   dueDate?: string|null,
 *   status?: string,
 *   notes?: string,
 *   taxPercent?: number,
 *   paymentStatus?: string,
 *   paymentNotes?: string,
 *   lineItems: Array<{ serviceKey?: string, description: string, quantity: number, unitPrice: number }>,
 * }} payload
 */
export const createAdminBill = async (payload) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const companyName = String(payload.companyName || '').trim();
  if (companyName.length < 2) {
    throw new Error('Company name is required.');
  }

  const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems : [];
  if (lineItems.length === 0) {
    throw new Error('Add at least one service line item.');
  }

  const preparedItems = lineItems.map((item, index) => {
    const serviceKey = item.serviceKey || 'custom';
    const catalog = getServiceCatalogItem(serviceKey);
    const description = String(item.description || catalog.description || catalog.label || '').trim();
    if (description.length < 2) {
      throw new Error(`Line item ${index + 1} needs a description.`);
    }
    const quantity = toNumber(item.quantity, 1);
    const unitPrice = toNumber(item.unitPrice, 0);
    if (quantity <= 0) {
      throw new Error(`Line item ${index + 1} quantity must be greater than zero.`);
    }
    if (unitPrice < 0) {
      throw new Error(`Line item ${index + 1} unit price cannot be negative.`);
    }
    return {
      service_key: serviceKey,
      description,
      quantity,
      unit_price: unitPrice,
      amount: computeLineAmount(quantity, unitPrice),
      sort_order: index,
    };
  });

  const taxPercent = toNumber(payload.taxPercent, 0);
  const totals = computeBillTotals(
    preparedItems.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
    taxPercent,
  );

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw mapError(sessionError, 'Could not read admin session.');
  }

  const billNumber = await allocateBillNumber();

  const billInsert = {
    bill_number: billNumber,
    company_name: companyName,
    employer_user_id: payload.employerUserId || null,
    contact_name: String(payload.contactName || '').trim() || null,
    contact_email: String(payload.contactEmail || '').trim() || null,
    contact_phone: String(payload.contactPhone || '').trim() || null,
    company_address: String(payload.companyAddress || '').trim() || null,
    company_gstin: String(payload.companyGstin || '').trim() || null,
    bill_date: payload.billDate,
    due_date: payload.dueDate || null,
    status: payload.status || 'issued',
    notes: String(payload.notes || '').trim() || null,
    subtotal: totals.subtotal,
    tax_percent: taxPercent,
    tax_amount: totals.taxAmount,
    total_amount: totals.totalAmount,
    payment_status: payload.paymentStatus || 'unpaid',
    payment_notes: String(payload.paymentNotes || '').trim() || null,
    created_by: session?.user?.id || null,
  };

  const { data: billRow, error: billError } = await supabase
    .from('bills')
    .insert(billInsert)
    .select('*')
    .single();

  if (billError) {
    throw mapError(billError, 'Could not create bill.');
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('bill_line_items')
    .insert(preparedItems.map((item) => ({ ...item, bill_id: billRow.id })))
    .select('*');

  if (itemsError) {
    // Best-effort cleanup so a half-created bill does not linger.
    await supabase.from('bills').delete().eq('id', billRow.id);
    throw mapError(itemsError, 'Could not save bill line items.');
  }

  return mapBillRow(billRow, itemRows || []);
};

export const updateAdminBillPayment = async ({ billId, paymentStatus, paymentNotes, status }) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  if (!billId) {
    throw new Error('Bill id is required.');
  }

  const updates = {
    payment_status: paymentStatus,
    payment_notes: String(paymentNotes || '').trim() || null,
  };

  if (status) {
    updates.status = status;
  } else if (paymentStatus === 'paid') {
    updates.status = 'paid';
  }

  const { data, error } = await supabase
    .from('bills')
    .update(updates)
    .eq('id', billId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update bill payment status.');
  }

  return mapBillRow(data);
};

export const deleteAdminBill = async (billId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  if (!billId) {
    throw new Error('Bill id is required.');
  }

  const { error } = await supabase.from('bills').delete().eq('id', billId);
  if (error) {
    throw mapError(error, 'Could not delete bill.');
  }
};
