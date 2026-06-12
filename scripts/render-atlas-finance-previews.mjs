import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbookPath = 'outputs/atlas_finance_v3_database/Atlas_Finance_v3_database.xlsx';
const previewDir = 'outputs/atlas_finance_v3_database/previews';
const sheets = [
  'README',
  'Settings',
  'Accounts',
  'IncomeSchedule',
  'BudgetGroups',
  'Categories',
  'Obligations',
  'Goals',
  'Transactions',
  'MonthlyReview',
  'NormalizationRules',
  'Dashboard',
  'Checks',
];

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);
await fs.mkdir(previewDir, { recursive: true });

for (const sheetName of sheets) {
  const blob = await workbook.render({ sheetName, range: 'A1:J30', scale: 1 });
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(path.join(previewDir, `${sheetName}.png`), buffer);
  console.log(`${sheetName}: ${buffer.length} bytes`);
}
