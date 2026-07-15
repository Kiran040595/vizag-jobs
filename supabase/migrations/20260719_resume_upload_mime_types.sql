-- Allow common browser-reported MIME types for student resume uploads.
-- Client code normalizes Content-Type from file extension; this is a safety net.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-msword',
  'application/vnd.ms-word',
  'application/octet-stream'
]
where id = 'student-resumes';
