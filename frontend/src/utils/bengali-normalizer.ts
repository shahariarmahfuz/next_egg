export const normalizeBengaliDigits = (value: string | number | readonly string[] | undefined): string => {
  if (typeof value !== "string") return String(value ?? "");
  
  const bengaliToEnglish: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  
  return value.replace(/[০-৯]/g, (match) => bengaliToEnglish[match]);
};
