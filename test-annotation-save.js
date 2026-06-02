/**
 * 测试牌义注疏保存功能
 * 在浏览器控制台中运行此代码来测试
 */

function testCardAnnotationSave() {
  console.log('🧪 开始测试牌义注疏保存功能...\n');

  // 测试数据
  const testData = {
    cardId: 'ar01',
    numerology: '1 - 创造力',
    planet: '水星',
    zodiac: null,
    house: '第一宫',
    element: '风',
    uprightMeaning: '这是我的测试正位释义',
    reversedMeaning: '这是我的测试逆位释义',
    keywords: ['测试', '创造', '意志'],
    personalNotes: '这是我个人的测试注解'
  };

  // 模拟保存
  const key = 'tarot_user_annotations';
  const userId = localStorage.getItem('tarot_user_id') || 'user_' + Date.now();
  localStorage.setItem('tarot_user_id', userId);

  const existingData = localStorage.getItem(key);
  let annotations = existingData ? JSON.parse(existingData).annotations : {};
  
  // 保存测试数据
  annotations[testData.cardId] = {
    ...testData,
    userId: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saveData = {
    userId: userId,
    annotations: annotations,
    version: 1,
    lastUpdated: new Date().toISOString()
  };

  localStorage.setItem(key, JSON.stringify(saveData));

  console.log('✅ 数据已保存到 localStorage');
  console.log('📝 保存的数据:', saveData);

  // 验证读取
  const savedData = JSON.parse(localStorage.getItem(key));
  console.log('🔍 从 localStorage 读取的数据:', savedData);

  // 验证数据完整性
  const hasData = savedData.annotations[testData.cardId] !== undefined;
  console.log('\n📊 验证结果:', hasData ? '✅ 通过' : '❌ 失败');

  if (hasData) {
    const saved = savedData.annotations[testData.cardId];
    console.log('📋 保存的注解详情:');
    console.log('  - 牌ID:', saved.cardId);
    console.log('  - 数字命理学:', saved.numerology);
    console.log('  - 行星:', saved.planet);
    console.log('  - 正位释义:', saved.uprightMeaning);
    console.log('  - 个人注解:', saved.personalNotes);
    console.log('  - 关键词:', saved.keywords);
    console.log('  - 创建时间:', saved.createdAt);
    console.log('  - 更新时间:', saved.updatedAt);
  }

  console.log('\n🎉 测试完成！请刷新页面验证数据是否保留。');
  console.log('💡 提示: 打开 "牌义注疏" 页面，选择 "魔术师" 牌，应该能看到你修改的内容。');

  return hasData;
}

// 运行测试
testCardAnnotationSave();
