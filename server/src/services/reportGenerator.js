import { createObjectCsvStringifier } from 'csv-writer';
import ExcelJS from 'exceljs';
import { assetsDb } from './store.js';

export const generateCsvReport = async (jobId) => {
  const assets = assetsDb.get(jobId) || [];
  
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'pageUrl', title: 'Page URL' },
      { id: 'assetUrl', title: 'Asset URL' },
      { id: 'assetType', title: 'Asset Type' },
      { id: 'statusCode', title: 'Status Code' },
      { id: 'failureReason', title: 'Failure Reason' },
      { id: 'createdAt', title: 'Timestamp' }
    ]
  });

  const header = csvStringifier.getHeaderString();
  const records = csvStringifier.stringifyRecords(assets.map(a => ({
    ...a,
    createdAt: a.createdAt.toISOString()
  })));

  return header + records;
};

export const generateExcelReport = async (jobId) => {
  const assets = assetsDb.get(jobId) || [];
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Broken Assets');
  
  sheet.columns = [
    { header: 'Page URL', key: 'pageUrl', width: 40 },
    { header: 'Asset URL', key: 'assetUrl', width: 40 },
    { header: 'Asset Type', key: 'assetType', width: 15 },
    { header: 'Status Code', key: 'statusCode', width: 15 },
    { header: 'Failure Reason', key: 'failureReason', width: 20 },
    { header: 'Timestamp', key: 'createdAt', width: 25 }
  ];

  assets.forEach(asset => {
    sheet.addRow({
      ...asset,
      createdAt: asset.createdAt.toISOString()
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};
