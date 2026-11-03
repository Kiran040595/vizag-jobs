export function isMissingSchemaColumn(error, tableName, columnName) {
  if (!error || !tableName || !columnName) {
    return false;
  }

  const errorText = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    (error.code === 'PGRST204' || errorText.includes('schema cache')) &&
    errorText.includes(String(tableName).toLowerCase()) &&
    errorText.includes(String(columnName).toLowerCase())
  );
}
