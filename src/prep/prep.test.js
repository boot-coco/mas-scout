import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('classifyReply', () => {
  let classifyReply;

  before(async () => {
    const mod = await import('./index.js');
    classifyReply = mod.classifyReply;
  });

  it('should classify "interested in a demo" as positive', async () => {
    const result = await classifyReply('I am interested in a demo');
    assert.strictEqual(result, 'positive');
  });

  it('should classify "schedule a call" as positive', async () => {
    const result = await classifyReply('Can we schedule a call next week?');
    assert.strictEqual(result, 'positive');
  });

  it('should classify "not interested" as negative', async () => {
    const result = await classifyReply('We are not interested at this time');
    assert.strictEqual(result, 'negative');
  });

  it('should classify "please unsubscribe me" as negative', async () => {
    const result = await classifyReply('Please unsubscribe me from this list');
    assert.strictEqual(result, 'negative');
  });

  it('should classify "please remove me" as negative', async () => {
    const result = await classifyReply('Please remove me from your mailing list');
    assert.strictEqual(result, 'negative');
  });

  it('should classify "already have a solution" as objection', async () => {
    const result = await classifyReply('We already have a solution in place');
    assert.strictEqual(result, 'objection');
  });

  it('should classify "no budget right now" as objection', async () => {
    const result = await classifyReply('We have no budget for this right now');
    assert.strictEqual(result, 'objection');
  });

  it('should classify "maybe later" as objection', async () => {
    const result = await classifyReply('Maybe later this quarter');
    assert.strictEqual(result, 'objection');
  });

  it('should classify "thanks for reaching out" as neutral', async () => {
    const result = await classifyReply('Thanks for reaching out');
    assert.strictEqual(result, 'neutral');
  });

  it('should classify ambiguous text as neutral', async () => {
    const result = await classifyReply('Received your message, will review.');
    assert.strictEqual(result, 'neutral');
  });
});

describe('generateBrief', () => {
  let generateBrief;

  before(async () => {
    const mod = await import('./index.js');
    generateBrief = mod.generateBrief;
  });

  it('should contain the company name in the brief', async () => {
    const prospect = {
      company: { name: 'TestBank Pte Ltd', address: '1 Marina Blvd', website: 'https://testbank.sg' },
      contact: { name: 'John Tan', title: 'CCO' },
      licenseType: 'Major Payment Institution',
      enrichedData: {},
    };

    const brief = await generateBrief(prospect);
    assert.ok(typeof brief === 'string', 'generateBrief should return a string');
    assert.ok(brief.includes('TestBank Pte Ltd'), 'brief should contain the company name');
  });

  it('should contain the contact name in the brief', async () => {
    const prospect = {
      company: { name: 'Alpha Corp' },
      contact: { name: 'Sarah Chen', title: 'MLRO' },
      licenseType: 'Capital Markets Services Licensee',
      enrichedData: {},
    };

    const brief = await generateBrief(prospect);
    assert.ok(brief.includes('Sarah Chen'), 'brief should contain the contact name');
  });

  it('should contain the license type in the brief', async () => {
    const prospect = {
      company: { name: 'Beta Ltd' },
      contact: { name: 'Tom Lee', title: 'Head of Compliance' },
      licenseType: 'Standard Payment Institution',
      enrichedData: {},
    };

    const brief = await generateBrief(prospect);
    assert.ok(
      brief.includes('Standard Payment Institution'),
      'brief should contain the license type'
    );
  });

  it('should handle missing address and website gracefully', async () => {
    const prospect = {
      company: { name: 'Minimal Corp' },
      contact: { name: 'No Info', title: 'Director' },
      licenseType: 'Major Payment Institution',
      enrichedData: {},
    };

    const brief = await generateBrief(prospect);
    assert.ok(typeof brief === 'string', 'should still return a string');
    assert.ok(brief.includes('Minimal Corp'), 'brief should contain the company name');
  });
});
