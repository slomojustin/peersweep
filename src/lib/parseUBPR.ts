export interface ParsedBank {
  rssd: string;
  reportDate: string;
  bankName?: string;
  metrics: Record<string, number | string>;
  sourceConcepts: Record<string, number | string>;
}

export function parseXBRL(xmlContent: string): ParsedBank[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  if (!doc || doc.querySelector('parsererror')) return [];

  const banks = new Map<string, ParsedBank>();
  const contextMap = new Map<string, { rssd: string; date: string }>();

  const contexts = doc.querySelectorAll('context');
  contexts.forEach((ctx) => {
    const id = ctx.getAttribute('id') || '';
    const identifier = ctx.querySelector('identifier');
    const instant = ctx.querySelector('instant');
    const endDate = ctx.querySelector('endDate');
    if (identifier) {
      const rssd = identifier.textContent?.trim() || '';
      const date = instant?.textContent?.trim() || endDate?.textContent?.trim() || '';
      if (rssd && date) contextMap.set(id, { rssd, date });
    }
  });

  const root = doc.documentElement;
  if (!root) return [];

  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    const tagName = el.tagName || '';
    const contextRef = el.getAttribute('contextRef') || '';
    const value = el.textContent?.trim() || '';
    if (!contextRef || !value) continue;

    const ctxInfo = contextMap.get(contextRef);
    if (!ctxInfo) continue;

    const key = `${ctxInfo.rssd}_${ctxInfo.date}`;
    if (!banks.has(key)) {
      banks.set(key, { rssd: ctxInfo.rssd, reportDate: ctxInfo.date, metrics: {}, sourceConcepts: {} });
    }

    const bank = banks.get(key)!;
    const conceptName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
    if (!conceptName || ['schemaRef', 'context', 'unit'].some((s) => tagName.includes(s))) continue;

    const unitRef = el.getAttribute('unitRef') || '';
    let parsedValue: number | string = value;
    if (unitRef === 'USD' || unitRef === 'PURE') {
      const num = parseFloat(value);
      if (!isNaN(num)) parsedValue = num;
    }

    if (conceptName.startsWith('UBPR')) bank.metrics[conceptName] = parsedValue;
    else if (conceptName.startsWith('RCON') || conceptName.startsWith('RIAD'))
      bank.sourceConcepts[conceptName] = parsedValue;
  }

  return Array.from(banks.values());
}

export function parseTabDelimited(content: string): ParsedBank[] {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map((h) => h.trim());
  const rssdIdx = headers.findIndex((h) => /rssd|idrssd|id_rssd/i.test(h));
  const dateIdx = headers.findIndex((h) => /date|repdte|report.*date/i.test(h));
  const nameIdx = headers.findIndex((h) => /name|bank.*name|inst.*name/i.test(h));
  if (rssdIdx === -1) return [];

  const banks = new Map<string, ParsedBank>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const rssd = cols[rssdIdx]?.trim();
    if (!rssd) continue;
    const reportDate = dateIdx >= 0 ? cols[dateIdx]?.trim() || 'unknown' : 'unknown';
    const bankName = nameIdx >= 0 ? cols[nameIdx]?.trim() : undefined;
    const key = `${rssd}_${reportDate}`;

    if (!banks.has(key)) {
      banks.set(key, { rssd, reportDate, bankName, metrics: {}, sourceConcepts: {} });
    }

    const bank = banks.get(key)!;
    if (bankName && !bank.bankName) bank.bankName = bankName;

    for (let j = 0; j < headers.length; j++) {
      if (j === rssdIdx || j === dateIdx || j === nameIdx) continue;
      const header = headers[j];
      const val = cols[j]?.trim();
      if (!header || !val) continue;
      const num = parseFloat(val);
      const parsedVal = isNaN(num) ? val : num;
      if (header.startsWith('UBPR')) bank.metrics[header] = parsedVal;
      else if (header.startsWith('RCON') || header.startsWith('RIAD'))
        bank.sourceConcepts[header] = parsedVal;
      else bank.metrics[header] = parsedVal;
    }
  }

  return Array.from(banks.values());
}

export function detectAndParse(content: string): ParsedBank[] {
  if (content.includes('<?xml') || content.includes('<xbrl')) {
    return parseXBRL(content);
  }
  if (content.includes('\t')) {
    return parseTabDelimited(content);
  }
  return [];
}
