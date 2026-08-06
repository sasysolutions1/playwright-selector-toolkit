import type { Frame, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { captureSanitizedHtml, summarizeSanitizedHtml } from '../src/core/snapshot/html.js';
import type { SanitizedHtmlFrameCapture } from '../src/types/snapshot.js';

function fakeFrame(name: string, url: string, children: Frame[] = []): Frame {
  return {
    name: vi.fn(() => name),
    url: vi.fn(() => url),
    childFrames: vi.fn(() => children),
  } as unknown as Frame;
}

function frameCapture(
  overrides: Partial<SanitizedHtmlFrameCapture> = {},
): SanitizedHtmlFrameCapture {
  return {
    framePath: 'main',
    parentFramePath: null,
    depth: 0,
    index: 0,
    name: null,
    url: 'https://example.test/',
    title: 'Fixture',
    html: '<!doctype html><html></html>',
    hash: 'abc',
    stats: {
      visitedNodeCount: 4,
      serializedElementCount: 2,
      shadowRootCount: 1,
      omittedNodeCount: 1,
      omittedAttributeCount: 2,
      redactionCount: 3,
      truncated: false,
    },
    ...overrides,
  };
}

describe('sanitized HTML capture', () => {
  it('traverses child frames and hashes each HTML document', async () => {
    const child = fakeFrame('checkout', 'https://pay.example.test/frame');
    const main = fakeFrame('', 'https://example.test/', [child]);
    const page = {
      mainFrame: () => main,
      url: () => 'https://example.test/',
      title: async () => 'Fixture',
    } as unknown as Page;
    const inspectFrame = vi.fn(async (frame: Frame) => ({
      title: frame === main ? 'Main' : 'Child',
      html: frame === main ? '<html>Main</html>' : '<html>Child</html>',
      stats: frameCapture().stats,
    }));
    const capture = await captureSanitizedHtml(
      page,
      'https://example.test/',
      {},
      {
        inspectFrame,
        now: () => new Date('2026-07-18T00:00:00.000Z'),
        toolkitVersion: () => '0.8.0-test',
      },
    );
    expect(capture.frames).toHaveLength(2);
    expect(capture.frames[1]?.framePath).toBe('main/frame[0]:checkout');
    expect(capture.frames[0]?.hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(capture.summary.frameCount).toBe(2);
    expect(capture.toolkitVersion).toBe('0.8.0-test');
  });

  it('isolates child-frame failures', async () => {
    const child = fakeFrame('broken', 'https://broken.example.test/');
    const main = fakeFrame('', 'https://example.test/', [child]);
    const page = {
      mainFrame: () => main,
      url: () => 'https://example.test/',
      title: async () => 'Fixture',
    } as unknown as Page;
    const capture = await captureSanitizedHtml(
      page,
      'https://example.test/',
      {},
      {
        inspectFrame: async (frame) => {
          if (frame === child) throw new Error('detached');
          return { title: 'Main', html: '<html></html>', stats: frameCapture().stats };
        },
      },
    );
    expect(capture.frames).toHaveLength(1);
    expect(capture.failures[0]).toMatchObject({ framePath: 'main/frame[0]:broken' });
  });

  it('summarizes frame statistics', () => {
    expect(summarizeSanitizedHtml([frameCapture(), frameCapture()], [])).toEqual({
      frameCount: 2,
      failedFrameCount: 0,
      visitedNodeCount: 8,
      serializedElementCount: 4,
      shadowRootCount: 2,
      omittedNodeCount: 2,
      omittedAttributeCount: 4,
      redactionCount: 6,
      truncatedFrameCount: 0,
    });
  });
});
