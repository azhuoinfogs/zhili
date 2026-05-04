/** 年龄段顺序，用于相邻档 */
const AGE_ORDER = ['under18', '18-25', '26-35', '36-45', '46plus'];

/** 用户预算档位 → [min, max] 元，用于预算分 */
const BUDGET_RANGE = {
  lt100: [0, 100],
  '100-300': [100, 300],
  '300-500': [300, 500],
  '500-1000': [500, 1000],
  '1000+': [1000, 1e9]
};

const OCCASION_LABEL = {
  birthday: '生日',
  anniversary: '纪念日',
  festival: '节日',
  thanks: '感谢',
  apology: '道歉',
  casual: '无理由'
};

function interestScore(userInterests, productInterests) {
  const u = userInterests || [];
  if (u.length === 0) return 5;
  const p = productInterests || [];
  let n = 0;
  for (const x of u) if (p.includes(x)) n++;
  if (n >= 3) return 10;
  if (n === 2) return 7;
  if (n === 1) return 4;
  return 0;
}

function occasionSub(userOccasion, productOccasions) {
  const po = productOccasions || [];
  if (po.includes(userOccasion)) return 6;
  if (po.includes('universal')) return 4;
  return 0;
}

/** PRD 4.3：风格 完全4 / 部分2 / 冲突0（道歉+搞怪视为冲突） */
function styleSub(userStyle, productStyles, userOccasion) {
  const ps = productStyles || [];
  if (userOccasion === 'apology' && ps.includes('quirky')) return 0;
  if (!userStyle) return ps.length === 0 ? 2 : 2;
  if (ps.includes(userStyle)) return 4;
  if (ps.length === 0) return 2;
  return 2;
}

function situationScore(profile, product) {
  const occ = occasionSub(profile.occasion, product.occasions);
  const sty = styleSub(profile.style, product.styles, profile.occasion);
  return occ + sty;
}

function genderSub(userGender, productGender) {
  if (!userGender || userGender === 'unknown') return 3;
  if (productGender === 'any' || productGender === 'unknown' || productGender === userGender) return 4;
  return 0;
}

function ageSub(userBand, productBands) {
  const pb = productBands || [];
  if (!userBand) return 1;
  if (pb.includes(userBand)) return 3;
  const ui = AGE_ORDER.indexOf(userBand);
  for (const b of pb) {
    const bi = AGE_ORDER.indexOf(b);
    if (bi >= 0 && Math.abs(bi - ui) === 1) return 1;
  }
  return 0;
}

function budgetSub(price, budgetKey) {
  const [lo, hi] = BUDGET_RANGE[budgetKey] || [0, 1e9];
  if (price >= lo && price <= hi) return 3;
  if (price <= hi * 1.2) return 1;
  return 0;
}

function basicScore(profile, product) {
  let s = 0;
  s += genderSub(profile.gender, product.gender || 'any');
  s += ageSub(profile.ageBand, product.ageBands);
  s += budgetSub(Number(product.price) || 0, profile.budget);
  const taboos = profile.taboos || [];
  const avoid = product.taboosAvoid || [];
  if (taboos.length && taboos.every((t) => avoid.includes(t))) s += 1;
  return s;
}

export function computeScore(product, profile) {
  const i = interestScore(profile.interests, product.interests);
  const sit = situationScore(profile, product);
  const bas = basicScore(profile, product);
  return 0.5 * i + 0.3 * sit + 0.2 * bas;
}

/** 因子分用于解释性文案（PRD 4.4） */
export function factorBreakdown(product, profile) {
  const interests = profile.interests || [];
  const overlap = interests.filter((x) => (product.interests || []).includes(x));
  const occ = occasionSub(profile.occasion, product.occasions);
  const sty = styleSub(profile.style, product.styles, profile.occasion);
  const g = genderSub(profile.gender, product.gender || 'any');
  const a = ageSub(profile.ageBand, product.ageBands);
  const b = budgetSub(Number(product.price) || 0, profile.budget);
  const taboos = profile.taboos || [];
  const avoid = product.taboosAvoid || [];
  const tabooOk = taboos.length && taboos.every((t) => avoid.includes(t));
  return {
    interest: { score: interestScore(interests, product.interests), overlap },
    situation: { occasion: occ, style: sty },
    basic: { gender: g, age: a, budget: b, tabooBonus: tabooOk ? 1 : 0 }
  };
}

const STYLE_LABEL = {
  practical: '实用',
  ritual: '仪式',
  quirky: '搞怪',
  warm: '温情'
};

const INTEREST_LABEL = {
  tech: '科技数码',
  art: '文艺生活',
  outdoor: '户外运动',
  beauty: '美妆护肤',
  home: '居家宅人',
  fashion: '时尚穿搭',
  food: '美食美酒',
  health: '健康养生',
  office: '职场办公',
  parent: '母婴亲子'
};

const BUDGET_LABEL = {
  lt100: '100元以内',
  '100-300': '100–300元',
  '300-500': '300–500元',
  '500-1000': '500–1000元',
  '1000+': '1000元以上'
};

export function buildReasonLines(product, profile) {
  const fb = factorBreakdown(product, profile);
  const candidates = [];
  if (fb.interest.overlap.length) {
    const ring = fb.interest.overlap.map((k) => INTEREST_LABEL[k] || k).join('、');
    candidates.push({
      w: fb.interest.score * 0.5,
      text: `因为ta喜欢${ring}，${product.sellPoint || '这份礼物很贴切'}.`,
      icon: '🎯'
    });
  }
  const occName = OCCASION_LABEL[profile.occasion] || profile.occasion;
  candidates.push({
    w: fb.situation.occasion * 0.3,
    text: `${occName}选它，${product.occasionKeyword || '分寸感刚好'}.`,
    icon: '🎂'
  });
  if (profile.style && fb.situation.style >= 2) {
    candidates.push({
      w: fb.situation.style * 0.3,
      text: `${STYLE_LABEL[profile.style] || profile.style}之选，表达心意恰到好处.`,
      icon: '❤️'
    });
  }
  candidates.push({
    w: fb.basic.budget * 0.2,
    text: `刚好在${BUDGET_LABEL[profile.budget] || '预算'}内，性价比不错.`,
    icon: '💰'
  });
  const taboos = profile.taboos || [];
  if (taboos.length && taboos.every((t) => (product.taboosAvoid || []).includes(t))) {
    candidates.push({
      w: 2,
      text: `特意避开${taboos.map((t) => (t === 'smell' ? '气味敏感' : t === 'religion' ? '宗教禁忌' : t))}，这份礼物更安心.`,
      icon: '🚫'
    });
  }
  candidates.sort((a, b) => b.w - a.w);
  const top = candidates.slice(0, 2);
  return top.map((c) => ({ icon: c.icon, text: c.text }));
}
