function callHref(phone){
  const mainNumber = String(phone || '').split(/\s*(?:ext\.?|x)\s*/i, 1)[0];
  const cleaned = mainNumber.replace(/[^\d+]/g, '');
  return 'tel:' + (/^\d{10}$/.test(cleaned) ? '+1' + cleaned : cleaned);
}
