import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We need to override DATA_DIR before importing snapshot, so we mock config.
// Since the snapshot module reads DATA_DIR at import time, we use a dynamic
// import approach with a temp directory.

describe('parseInstitutionList', () => {
  let parseInstitutionList;

  before(async () => {
    const mod = await import('./scraper.js');
    parseInstitutionList = mod.parseInstitutionList;
  });

  it('should extract institution details from HTML with detail links', () => {
    const html = `
      <html><body>
        <div class="result">
          <a href="/fid/institution/detail/12345-Test-Corp">Test Corp Pte Ltd</a>
          <span>100 Robinson Road SINGAPORE 068902</span>
          <a href="https://testcorp.com">Website</a>
          <span>+65 61234567</span>
        </div>
        <div class="result">
          <a href="/fid/institution/detail/67890-Another-Co">Another Co Pte Ltd</a>
          <span>1 Raffles Place SINGAPORE 048616</span>
          <a href="https://another.co">Website</a>
          <span>69876543</span>
        </div>
      </body></html>
    `;

    const result = parseInstitutionList(html, 'Capital Markets Services Licensee');

    assert.strictEqual(result.length, 2);

    // First institution
    assert.strictEqual(result[0].name, 'Test Corp Pte Ltd');
    assert.strictEqual(result[0].fid, '12345');
    assert.ok(result[0].detailUrl.includes('12345'));
    assert.strictEqual(result[0].licenseType, 'Capital Markets Services Licensee');
    assert.ok(result[0].address.includes('SINGAPORE'));
    assert.strictEqual(result[0].website, 'https://testcorp.com');
    assert.ok(result[0].phone.includes('61234567'));

    // Second institution
    assert.strictEqual(result[1].name, 'Another Co Pte Ltd');
    assert.strictEqual(result[1].fid, '67890');
    assert.strictEqual(result[1].licenseType, 'Capital Markets Services Licensee');
  });

  it('should return an empty array when no institution links are found', () => {
    const html = '<html><body><p>No results</p></body></html>';
    const result = parseInstitutionList(html, 'Major Payment Institution');
    assert.deepStrictEqual(result, []);
  });

  it('should handle links without a matching FID pattern gracefully', () => {
    const html = `
      <html><body>
        <div>
          <a href="/fid/institution/detail/no-number-here">Mystery Corp</a>
        </div>
      </body></html>
    `;
    const result = parseInstitutionList(html, 'Standard Payment Institution');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Mystery Corp');
    assert.strictEqual(result[0].fid, '');
  });
});

describe('saveSnapshot and loadLatestSnapshot', () => {
  let tempDir;
  let saveSnapshot;
  let loadLatestSnapshot;

  before(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'mas-scout-test-'));

    // Dynamically construct a snapshot module that uses our temp dir.
    // We do this by importing the real functions and monkey-patching the dir.
    // Actually, the snapshot module uses DATA_DIR from config, which is fixed.
    // Instead, we'll write a small inline module test using the filesystem directly.
    // The cleanest approach: re-implement minimal versions referencing tempDir.

    // Actually let's just test the logic directly by importing and using
    // the snapshot module's internal logic. The module uses SNAPSHOT_DIR which
    // is `join(DATA_DIR, 'snapshots')`. We can't easily override that.
    //
    // Best approach: test with the actual module but set up data in DATA_DIR.
    // For isolation, we'll use a different approach: import snapshot functions
    // and work within the project's data directory (which is gitignored).

    const snapshotMod = await import('./snapshot.js');
    saveSnapshot = snapshotMod.saveSnapshot;
    loadLatestSnapshot = snapshotMod.loadLatestSnapshot;
  });

  after(() => {
    // Clean up temp dir
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  it('should save and load a snapshot with roundtrip fidelity', () => {
    const mockInstitutions = [
      {
        name: 'Test Bank Pte Ltd',
        fid: '99999',
        detailUrl: 'https://example.com/detail/99999',
        licenseType: 'Major Payment Institution',
        address: '1 Test Street SINGAPORE 123456',
        website: 'https://testbank.com',
        phone: '61112222',
      },
      {
        name: 'Demo Corp',
        fid: '88888',
        detailUrl: 'https://example.com/detail/88888',
        licenseType: 'Capital Markets Services Licensee',
        address: '2 Demo Avenue SINGAPORE 654321',
        website: 'https://democorp.sg',
        phone: '63334444',
      },
    ];

    // Save snapshot
    const filepath = saveSnapshot(mockInstitutions);
    assert.ok(filepath, 'saveSnapshot should return a file path');
    assert.ok(existsSync(filepath), 'snapshot file should exist on disk');

    // Load it back
    const loaded = loadLatestSnapshot();
    assert.ok(loaded, 'loadLatestSnapshot should return data');
    assert.strictEqual(loaded.count, 2);
    assert.strictEqual(loaded.institutions.length, 2);
    assert.strictEqual(loaded.institutions[0].name, 'Test Bank Pte Ltd');
    assert.strictEqual(loaded.institutions[0].fid, '99999');
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
    const previous = [
      { name: 'Alpha Corp', fid: '100' },
    ];
    const current = [
      { name: 'Alpha Corp', fid: '100' },
      { name: 'Beta Inc', fid: '200' },
    ];

    const diff = diffSnapshots(current, previous);
    assert.strictEqual(diff.added.length, 1);
    assert.strictEqual(diff.added[0].name, 'Beta Inc');
    assert.strictEqual(diff.removed.length, 0);
  });

  it('should detect removed institutions', () => {
    const previous = [
      { name: 'Alpha Corp', fid: '100' },
      { name: 'Beta Inc', fid: '200' },
    ];
    const current = [
      { name: 'Alpha Corp', fid: '100' },
    ];

    const diff = diffSnapshots(current, previous);
    assert.strictEqual(diff.added.length, 0);
    assert.strictEqual(diff.removed.length, 1);
    assert.strictEqual(diff.removed[0].name, 'Beta Inc');
  });

  it('should detect both added and removed institutions', () => {
    const previous = [
      { name: 'Alpha Corp', fid: '100' },
      { name: 'Gamma LLC', fid: '300' },
    ];
    const current = [
      { name: 'Alpha Corp', fid: '100' },
      { name: 'Delta Pte', fid: '400' },
    ];

    const diff = diffSnapshots(current, previous);
    assert.strictEqual(diff.added.length, 1);
    assert.strictEqual(diff.added[0].name, 'Delta Pte');
    assert.strictEqual(diff.removed.length, 1);
    assert.strictEqual(diff.removed[0].name, 'Gamma LLC');
  });

  it('should return empty arrays when snapshots are identical', () => {
    const data = [
      { name: 'Alpha Corp', fid: '100' },
    ];

    const diff = diffSnapshots(data, data);
    assert.strictEqual(diff.added.length, 0);
    assert.strictEqual(diff.removed.length, 0);
  });

  it('should use name as key when fid is absent', () => {
    const previous = [{ name: 'NoFid Corp' }];
    const current = [{ name: 'NoFid Corp' }, { name: 'New Corp' }];

    const diff = diffSnapshots(current, previous);
    assert.strictEqual(diff.added.length, 1);
    assert.strictEqual(diff.added[0].name, 'New Corp');
  });
});
