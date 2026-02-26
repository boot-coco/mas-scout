import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('REGULATORY_HOOKS', () => {
  let REGULATORY_HOOKS;

  before(async () => {
    const mod = await import('./index.js');
    REGULATORY_HOOKS = mod.REGULATORY_HOOKS;
  });

  it('should have an entry for Capital Markets Services Licensee', () => {
    const entry = REGULATORY_HOOKS['Capital Markets Services Licensee'];
    assert.ok(entry, 'CMS Licensee entry should exist');
    assert.ok(typeof entry.obligation === 'string', 'obligation should be a string');
    assert.ok(entry.obligation.length > 0, 'obligation should not be empty');
    assert.ok(Array.isArray(entry.products), 'products should be an array');
    assert.ok(entry.products.length > 0, 'products should not be empty');
  });

  it('should have an entry for Major Payment Institution', () => {
    const entry = REGULATORY_HOOKS['Major Payment Institution'];
    assert.ok(entry, 'MPI entry should exist');
    assert.ok(typeof entry.obligation === 'string');
    assert.ok(Array.isArray(entry.products));
    assert.ok(entry.products.length > 0);
  });

  it('should have an entry for Standard Payment Institution', () => {
    const entry = REGULATORY_HOOKS['Standard Payment Institution'];
    assert.ok(entry, 'SPI entry should exist');
    assert.ok(typeof entry.obligation === 'string');
    assert.ok(Array.isArray(entry.products));
    assert.ok(entry.products.length > 0);
  });
});

describe('generateEmail', () => {
  let generateEmail;

  before(async () => {
    const mod = await import('./index.js');
    generateEmail = mod.generateEmail;
  });

  it('should return a string containing the company name', async () => {
    const prospect = {
      company: { name: 'Acme Payments Pte Ltd' },
      contact: { name: 'John Doe', title: 'CCO', email: 'john@acme.com' },
      licenseType: 'Major Payment Institution',
    };

    const email = await generateEmail(prospect);
    assert.ok(typeof email === 'string', 'generateEmail should return a string');
    assert.ok(email.includes('Acme Payments Pte Ltd'), 'email should contain the company name');
  });

  it('should handle unknown license types gracefully', async () => {
    const prospect = {
      company: { name: 'Unknown License Corp' },
      contact: { name: 'Jane Smith', title: 'Director' },
      licenseType: 'Some Unknown License',
    };

    const email = await generateEmail(prospect);
    assert.ok(typeof email === 'string', 'should still return a string');
    assert.ok(email.includes('Unknown License Corp'), 'email should contain the company name');
  });
});

describe('createSequence', () => {
  let createSequence;

  before(async () => {
    const mod = await import('./index.js');
    createSequence = mod.createSequence;
  });

  it('should return a 4-step sequence', async () => {
    const prospect = {
      company: { name: 'FinTech Co' },
      contact: { name: 'Alice Lee', title: 'Head of Compliance', email: 'alice@fintech.co' },
      licenseType: 'Capital Markets Services Licensee',
    };

    const sequence = await createSequence(prospect);
    assert.strictEqual(sequence.length, 4, 'sequence should have 4 steps');
  });

  it('should have the correct channel and day structure', async () => {
    const prospect = {
      company: { name: 'Pay Corp' },
      contact: { name: 'Bob', title: 'MLRO' },
      licenseType: 'Standard Payment Institution',
    };

    const sequence = await createSequence(prospect);

    // Step 1: email on day 1
    assert.strictEqual(sequence[0].channel, 'email');
    assert.strictEqual(sequence[0].day, 1);
    assert.ok(typeof sequence[0].content === 'string');

    // Step 2: linkedin on day 3
    assert.strictEqual(sequence[1].channel, 'linkedin');
    assert.strictEqual(sequence[1].day, 3);

    // Step 3: linkedin on day 7
    assert.strictEqual(sequence[2].channel, 'linkedin');
    assert.strictEqual(sequence[2].day, 7);

    // Step 4: email on day 10
    assert.strictEqual(sequence[3].channel, 'email');
    assert.strictEqual(sequence[3].day, 10);
  });

  it('should include email content with company name in first step', async () => {
    const prospect = {
      company: { name: 'Unique Name Corp' },
      contact: { name: 'Carol', title: 'CCO' },
      licenseType: 'Major Payment Institution',
    };

    const sequence = await createSequence(prospect);
    assert.ok(
      sequence[0].content.includes('Unique Name Corp'),
      'first step email content should contain company name'
    );
  });
});
