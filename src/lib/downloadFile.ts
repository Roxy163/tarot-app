export const downloadBlobFile = (filename: string, blob: Blob) => {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadTextFile = (filename: string, content: string, type: string) => {
  downloadBlobFile(filename, new Blob([content], { type }));
};
