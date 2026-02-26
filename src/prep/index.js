/**
 * MAS Scout Prep — 回复处理与会前准备
 *
 * 输入：潜在客户的回复
 * 输出：回复分类 + 会议预约 + 会前简报
 *
 * 职责：
 * 1. 回复分类（积极 / 中性 / 异议 / 拒绝）
 * 2. 积极回复自动预约会议
 * 3. 会前简报自动生成
 *
 * TODO: Jessie 实现
 */

/**
 * 回复分类
 * @param {string} replyText
 * @returns {Promise<'positive' | 'neutral' | 'objection' | 'negative'>}
 */
async function classifyReply(replyText) {
  // TODO: LLM 分类
  // 简单关键词匹配作为 fallback
  const text = replyText.toLowerCase();

  // Check negative before positive — "not interested" contains "interested"
  if (text.includes('not interested') || text.includes('unsubscribe') || text.includes('remove')) {
    return 'negative';
  }
  if (text.includes('interested') || text.includes('schedule') || text.includes('call') || text.includes('demo')) {
    return 'positive';
  }
  if (text.includes('already have') || text.includes('budget') || text.includes('later')) {
    return 'objection';
  }
  return 'neutral';
}

/**
 * 生成会前简报
 * @param {{ company: object, contact: object, licenseType: string, enrichedData: object }} prospect
 * @returns {Promise<string>}
 */
async function generateBrief(prospect) {
  // TODO: LLM 生成详细简报
  console.log(`[prep] 生成会前简报: ${prospect.company.name}`);

  const sections = [
    `# 会前简报 — ${prospect.company.name}`,
    '',
    `## 公司概况`,
    `- 公司名：${prospect.company.name}`,
    `- 牌照类型：${prospect.licenseType}`,
    `- 地址：${prospect.company.address || '未知'}`,
    `- 网站：${prospect.company.website || '未知'}`,
    '',
    `## 联系人`,
    `- 姓名：${prospect.contact.name}`,
    `- 职位：${prospect.contact.title}`,
    '',
    `## 监管要求`,
    `- 根据 ${prospect.licenseType} 牌照，该公司需要：`,
    `  - 客户尽职调查 (CDD)`,
    `  - 交易监控 (TM)`,
    `  - 可疑交易报告 (STR)`,
    '',
    `## 推荐产品`,
    `- Artemis — KYC 自动化`,
    `- Athena — 交易监控`,
    '',
    `## 谈话要点`,
    `- 恭喜获得牌照，了解其合规体系搭建进度`,
    `- 分享同类牌照客户案例`,
    `- 演示 Cynopsis 如何帮助加速合规建设`,
  ];

  return sections.join('\n');
}

export { classifyReply, generateBrief };
