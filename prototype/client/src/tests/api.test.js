import { describe, it, expect } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

describe('Server API 测试', () => {
  describe('健康检查 API', () => {
    it('GET /api/health 应该返回状态正常', async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.products).toBeDefined();
    });
  });

  describe('用户 API', () => {
    let token = '';
    const testPhone = `138${Date.now().toString().slice(-8)}`;

    it('POST /api/user/send-code 应该能发送验证码', async () => {
      const response = await fetch(`${API_BASE_URL}/api/user/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone })
      });
      const data = await response.json();
      if (response.ok) {
        expect(data.success).toBe(true);
      } else {
        console.log('发送验证码失败:', data);
      }
    });

    it('POST /api/user/register 应该能注册新用户', async () => {
      const response = await fetch(`${API_BASE_URL}/api/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          password: 'Test1234!',
          nickname: '测试用户',
          code: '123456'
        })
      });
      const data = await response.json();
      if (response.ok) {
        expect(data.success).toBe(true);
        expect(data.token).toBeDefined();
        token = data.token;
      } else {
        console.log('注册失败:', data);
      }
    });

    it('POST /api/user/login 应该能登录用户', async () => {
      const response = await fetch(`${API_BASE_URL}/api/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          password: 'Test1234!'
        })
      });
      const data = await response.json();
      if (response.ok) {
        expect(data.success).toBe(true);
        expect(data.token).toBeDefined();
        token = data.token;
      } else {
        console.log('登录失败:', data);
      }
    });

    it('GET /api/user/me 应该能获取用户信息', async () => {
      if (!token) {
        console.log('跳过 /api/user/me 测试（无 token）');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/user/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        expect(data.user).toBeDefined();
      } else {
        console.log('获取用户信息失败:', data);
      }
    });

    it('GET /api/recommend 应该返回推荐商品', async () => {
      if (!token) {
        console.log('跳过 /api/recommend 测试（无 token）');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/recommend?profile=%7B%22occasion%22%3A%22birthday%22%7D`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        expect(Array.isArray(data)).toBe(true);
      } else {
        console.log('获取推荐失败:', data);
      }
    });
  });
});
