import { createObjectCsvStringifier } from 'csv-writer';
import ExcelJS from 'exceljs';
import Asset from '../models/Asset.js';

export const generateCsvReport = async (jobId) => {
  const assets = await Asset.find({ jobId, assetType: { $ne: 'Tag Issue' } });
  
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'pageUrl', title: 'Page URL' },
      { id: 'assetUrl', title: 'Asset URL' },
      { id: 'assetType', title: 'Asset Type' },
      { id: 'statusCode', title: 'Status Code' },
      { id: 'failureReason', title: 'Failure Reason' },
      { id: 'is404', title: 'Is 404' },
      { id: 'createdAt', title: 'Timestamp' }
    ]
  });

  const header = csvStringifier.getHeaderString();
  const records = csvStringifier.stringifyRecords(assets.map(a => ({
    pageUrl: a.pageUrl,
    assetUrl: a.assetUrl,
    assetType: a.assetType,
    statusCode: a.statusCode,
    failureReason: a.failureReason,
    is404: a.is404 ? 'Yes' : 'No',
    createdAt: a.createdAt.toISOString()
  })));

  return header + records;
};

export const generateExcelReport = async (jobId) => {
  const assets = await Asset.find({ jobId, assetType: { $ne: 'Tag Issue' } });
  const tagIssues = await Asset.find({ jobId, assetType: 'Tag Issue' });
  
  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Broken Assets (404)
  const brokenSheet = workbook.addWorksheet('Broken Assets (404)');
  brokenSheet.columns = [
    { header: 'Page URL', key: 'pageUrl', width: 40 },
    { header: 'Asset URL', key: 'assetUrl', width: 40 },
    { header: 'Asset Type', key: 'assetType', width: 15 },
    { header: 'Status Code', key: 'statusCode', width: 15 },
    { header: 'Failure Reason', key: 'failureReason', width: 20 },
    { header: 'Timestamp', key: 'createdAt', width: 25 }
  ];

  // Sheet 2: Other Errors (non-404)
  const errorSheet = workbook.addWorksheet('Other Errors');
  errorSheet.columns = [
    { header: 'Page URL', key: 'pageUrl', width: 40 },
    { header: 'Asset URL', key: 'assetUrl', width: 40 },
    { header: 'Asset Type', key: 'assetType', width: 15 },
    { header: 'Status Code', key: 'statusCode', width: 15 },
    { header: 'Failure Reason', key: 'failureReason', width: 20 },
    { header: 'Timestamp', key: 'createdAt', width: 25 }
  ];

  // Sheet 3: Tag Issues
  const tagSheet = workbook.addWorksheet('Tag Issues');
  tagSheet.columns = [
    { header: 'Page URL', key: 'pageUrl', width: 60 },
    { header: 'Issue Type', key: 'tagIssueType', width: 15 },
    { header: 'Detail', key: 'failureReason', width: 60 },
    { header: 'Timestamp', key: 'createdAt', width: 25 }
  ];

  assets.forEach(asset => {
    const row = {
      pageUrl: asset.pageUrl,
      assetUrl: asset.assetUrl,
      assetType: asset.assetType,
      statusCode: asset.statusCode,
      failureReason: asset.failureReason,
      createdAt: asset.createdAt.toISOString()
    };
    if (asset.is404) {
      brokenSheet.addRow(row);
    } else {
      errorSheet.addRow(row);
    }
  });

  tagIssues.forEach(ti => {
    tagSheet.addRow({
      pageUrl: ti.pageUrl,
      tagIssueType: ti.tagIssueType || '',
      failureReason: ti.failureReason,
      createdAt: ti.createdAt.toISOString()
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};
