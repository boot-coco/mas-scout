import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('parsePrintTable', () => {
  let parsePrintTable;

  before(async () => {
    const mod = await import('./scraper.js');
    parsePrintTable = mod.parsePrintTable;
  });

  it('should extract institution details from FID print table HTML', () => {
    const html = `
      <table class="fid-print-table">
        <tr><th>No.</th><th>Name</th><th>Address</th><th>Phone</th><th>Website</th><th>Sector</th><th>Licence Type</th><th>Activity</th><th>Sub-Activity</th></tr>
        <tr>
          <td>1</td>
          <td>Test Corp Pte Ltd</td>
          <td>100 Robinson Road SINGAPORE 068902</td>
          <td>+65 61234567</td>
          <td>https://testcorp.com</td>
          <td>Capital Markets</td>
          <td>Capital Markets Services Licensee</td>
          <td>Dealing in Securities</td>
          <td>Securities</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Another Co Pte Ltd</td>
          <td>1 Raffles Place SINGAPORE 048616</td>
          <td>69876543</td>
          <td>https://another.co</td>
          <td>Payments</td>
          <td>Major Payment Institution</td>
          <td>Account Issuance</td>
          <td></td>
        </tr>
      </table>
    `;

    const result = parsePrintTable(html);

    assert.strictEqual(result.length, 2);

    assert.strictEqual(result[0].name, 'Test Corp Pte Ltd');
    assert.strictEqual(result[0].address, '100 Robinson Road SINGAPORE 068902');
    assert.strictEqual(result[0].phone, '+65 61234567');
    assert.strictEqual(result[0].website, 'https://testcorp.com');
    assert.strictEqual(result[0].sector, 'Capital Markets');
    assert.strictEqual(result[0].licenseType, 'Capital Markets Services Licensee');
    assert.strictEqual(result[0].activity, 'Dealing in Securities');

    assert.strictEqual(result[1].name, 'Another Co Pte Ltd');
    assert.strictEqual(result[1].sector, 'Payments');
    assert.strictEqual(result[1].licenseType, 'Major Payment Institution');
  });

  it('should return an empty array when no data rows exist', () => {
    const html = '<table class="fid-print-table"><tr><th>No.</th><th>Name</th></tr></table>';
    const result = parsePrintTable(html);
    assert.deepStrictEqual(result, []);
  });

  it('should skip rows with fewer than 8 columns', () => {
    const html = `
      <table class="fid-print-table">
        <tr><th>No.</th><th>Name</th></tr>
        <tr><td>1</td><td>Incomplete Row</td></tr>
      </table>
    `;
    const result = parsePrintTable(html);
    assert.deepStrictEqual(result, []);
  });

  it('should skip rows with empty names', () => {
    const html = `
      <table class="fid-print-table">
        <tr><th>No.</th></tr>
        <tr><td>1</td><td></td><td>addr</td><td>phone</td><td>web</td><td>sector</td><td>license</td><td>activity</td></tr>
      </table>
    `;
    const result = parsePrintTable(html);
    assert.deepStrictEqual(result, []);
  });
});

describe('mergeRows', () => {
  let mergeRows;

  before(async () => {
    const mod = await import('./scraper.js');
    mergeRows = mod.mergeRows;
  });

  it('should merge rows with the same company name', () => {
    const rows = [
      { name: 'Alpha Corp', address: '1 Test St', phone: '12345', website: 'https://alpha.com', sector: 'Capital Markets', licenseType: 'CMS Licensee', activity: 'Dealing' },
      { name: 'Alpha Corp', address: '1 Test St', phone: '12345', website: 'https://alpha.com', sector: 'Capital Markets', licenseType: 'CMS Licensee', activity: 'Advising' },
    ];

    const result = mergeRows(rows);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Alpha Corp');
    assert.deepStrictEqual(result[0].activities, ['Dealing', 'Advising']);
    assert.deepStrictEqual(result[0].licenseTypes, ['CMS Licensee']);
  });

  it('should merge different license types for the same company', () => {
    const rows = [
      { name: 'Beta Inc', address: 'addr', phone: '', website: '', sector: 'Capital Markets', licenseType: 'CMS Licensee', activity: 'Dealing' },
      { name: 'Beta Inc', address: 'addr', phone: '', website: '', sector: 'Payments', licenseType: 'Major Payment Institution', activity: 'Account Issuance' },
    ];

    const result = mergeRows(rows);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].licenseTypes, ['CMS Licensee', 'Major Payment Institution']);
    assert.deepStrictEqual(result[0].activities, ['Dealing', 'Account Issuance']);
  });

  it('should keep different companies separate', () => {
    const rows = [
      { name: 'Alpha Corp', address: 'a', phone: '', website: '', sector: 's', licenseType: 'L1', activity: 'A1' },
      { name: 'Beta Inc', address: 'b', phone: '', website: '', sector: 's', licenseType: 'L2', activity: 'A2' },
    ];

    const result = mergeRows(rows);
    assert.strictEqual(result.length, 2);
  });

  it('should handle empty input', () => {
    const result = mergeRows([]);
    assert.deepStrictEqual(result, []);
  });
});

describe('saveSnapshot and loadLatestSnapshot', () => {
  let saveSnapshot;
  let loadLatestSnapshot;

  before(async () => {
    const snapshotMod = await import('./snapshot.js');
    saveSnapshot = snapshotMod.saveSnapshot;
    loadLatestSnapshot = snapshotMod.loadLatestSnapshot;
  });

  it('should save and load a snapshot with roundtrip fidelity', () => {
    const mockInstitutions = [
      {
        name: 'Test Bank Pte Ltd',
        address: '1 Test Street SINGAPORE 123456',
        phone: '61112222',
        website: 'https://testbank.com',
        sector: 'Payments',
        licenseTypes: ['Major Payment Institution'],
        activities: ['Account Issuance'],
      },
      {
        name: 'Demo Corp',
        address: '2 Demo Avenue SINGAPORE 654321',
        phone: '63334444',
        website: 'https://democorp.sg',
        sector: 'Capital Markets',
        licenseTypes: ['Capital Markets Services Licensee'],
        activities: ['Dealing in Securities'],
      },
    ];

    const filepath = saveSnapshot(mockInstitutions);
    assert.ok(filepath, 'saveSnapshot should return a file path');
    assert.ok(existsSync(filepath), 'snapshot file should exist on disk');

    const loaded = loadLatestSnapshot();
    assert.ok(loaded, 'loadLatestSnapshot should return data');
    assert.strictEqual(loaded.count, 2);
    assert.strictEqual(loaded.institutions.length, 2);
    assert.strictEqual(loaded.institutions[0].name, 'Test Bank Pte Ltd');
    assert.deepStrictEqual(loaded.institutions[0].licenseTypes, ['Major Payment Institution']);
    assert.strictEqual(loaded.institutions[1].name, 'Demo Corp');
    assert.ok(loaded.timestamp, 'snapshot should have a timestamp');
  });
});

describe('diffSnapshots', () => {
  let diffSnapshots;

  before(async () => {
    const mod = await import('./snapshot.js');
    diffSnapshots = mod.diffSnapshots;
  });

  it('should detect added institutions', () => {
    const previous = [{ name: 'Alpha Corp' }];
    const current = [{ name: 'Alpha Corp' }, { name: 'Beta Inc' }];

    const diff = diffSnapshots(current, previous);
    assert.strictEqual(diff.added.length, 1);
    assert.strictEqual(diff.added[0].name, 'Beta Inc');
    assert.strictEqual(diff.removed.length, 0);
  });

  it('should detect removed institutions', () => {
    const previous = [{ name: 'Alpha Corp' }, { name: 'Beta Inc' }];
    const current = [{ name: 'Alpha Corp' }];

    const diff = diffSnapshots(current, previous);
    assert.strictEqual(diff.added.length, 0);
    assert.strictEqual(diff.removed.length, 1);
    assert.strictEqual(diff.removed[0].name, 'Beta Inc');
  });

  it('should detect both added and removed institutions', () => {
    const previous = [{ name: 'Alpha Corp' }, { name: 'Gamma LLC' }];
    const current = [{ name: 'Alpha Corp' }, { name: 'Delta Pte' }];

    const diff = diffSnapshots(current, previous);
    assert.strictEqual(diff.added.length, 1);
    assert.strictEqual(diff.added[0].name, 'Delta Pte');
    assert.strictEqual(diff.removed.length, 1);
    assert.strictEqual(diff.removed[0].name, 'Gamma LLC');
  });

  it('should return empty arrays when snapshots are identical', () => {
    const data = [{ name: 'Alpha Corp' }];
    const diff = diffSnapshots(data, data);
    assert.strictEqual(diff.added.length, 0);
    assert.strictEqual(diff.removed.length, 0);
  });
});
