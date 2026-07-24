import assert from 'assert';
import { describe, it } from 'node:test';

import {
  TOTAL_WIDTH_PT,
  MIN_WIDTH_PT,
  MAX_WIDTH_PT,
  DXA_PER_PT,
  measureMaxLineWidth,
  computeP90,
  computeColumnWidthsDxa,
} from '../src/utils/docx-column-width.ts';

const MIN_DXA = Math.round(MIN_WIDTH_PT * DXA_PER_PT);
const MAX_DXA = Math.round(Math.round(MAX_WIDTH_PT * 10) / 10 * DXA_PER_PT);
const TOTAL_DXA = Math.round(TOTAL_WIDTH_PT * DXA_PER_PT);

describe('docx-column-width', () => {
  describe('measureMaxLineWidth', () => {
    it('returns 0 for empty string', () => {
      assert.strictEqual(measureMaxLineWidth(''), 0);
    });

    it('counts pure ASCII as 1 unit per char', () => {
      assert.strictEqual(measureMaxLineWidth('hello'), 5);
    });

    it('counts pure CJK as 2 units per char', () => {
      assert.strictEqual(measureMaxLineWidth('中文'), 4);
    });

    it('handles mixed ASCII and CJK', () => {
      assert.strictEqual(measureMaxLineWidth('A中'), 3);
    });

    it('uses the longest line for multiline text', () => {
      assert.strictEqual(measureMaxLineWidth('short\nmuch-longer-line'), 16);
    });

    it('counts fullwidth characters as wide', () => {
      assert.strictEqual(measureMaxLineWidth('Ａ'), 2);
    });
  });

  describe('computeP90', () => {
    it('returns 0 for empty array', () => {
      assert.strictEqual(computeP90([]), 0);
    });

    it('returns the only element for single-element array', () => {
      assert.strictEqual(computeP90([42]), 42);
    });

    it('returns the smaller index value for two elements (p90 index 0)', () => {
      assert.strictEqual(computeP90([1, 10]), 1);
    });

    it('returns the 90th percentile for ten elements', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      assert.strictEqual(computeP90(values), 9);
    });

    it('returns any value when all elements are equal', () => {
      assert.strictEqual(computeP90([5, 5, 5, 5]), 5);
    });
  });

  describe('computeColumnWidthsDxa', () => {
    it('returns empty array for empty matrix', () => {
      assert.deepStrictEqual(computeColumnWidthsDxa([]), []);
    });

    it('clamps a single column to MAX', () => {
      const result = computeColumnWidthsDxa([
        ['Short header'],
        ['A very long column of content that should dominate the weight calculation'],
      ]);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], MAX_DXA);
    });

    it('falls back to equal division when all weights are zero', () => {
      const result = computeColumnWidthsDxa([
        ['', ''],
        ['', ''],
      ]);
      assert.strictEqual(result.length, 2);
      assert.ok(Math.abs(result[0] - result[1]) <= 2);
      const sum = result.reduce((acc, w) => acc + w, 0);
      assert.ok(Math.abs(sum - TOTAL_DXA) <= 2);
    });

    it('falls back to equal division when numCols × MIN exceeds total width', () => {
      const matrix = Array.from({ length: 2 }, () => Array(8).fill(''));
      const result = computeColumnWidthsDxa(matrix);
      assert.strictEqual(result.length, 8);

      const expectedPt = Math.round((TOTAL_WIDTH_PT / 8) * 10) / 10;
      const expectedDxa = Math.round(expectedPt * DXA_PER_PT);
      for (const width of result) {
        assert.ok(Math.abs(width - expectedDxa) <= 6);
      }

      const sum = result.reduce((acc, w) => acc + w, 0);
      assert.ok(Math.abs(sum - TOTAL_DXA) <= result.length);
    });

    it('returns three bounded columns for a typical 3-column table', () => {
      const result = computeColumnWidthsDxa([
        ['Name', 'Description', 'Qty'],
        ['Apple', 'A red fruit', '3'],
        ['Banana', 'A yellow fruit', '5'],
      ]);
      assert.strictEqual(result.length, 3);
      for (const width of result) {
        assert.ok(width >= MIN_DXA);
        assert.ok(width <= MAX_DXA);
      }
      const sum = result.reduce((acc, w) => acc + w, 0);
      assert.ok(Math.abs(sum - TOTAL_DXA) <= 3);
    });

    it('assigns MAX to a very wide first column and remainder to the second', () => {
      const result = computeColumnWidthsDxa([
        ['This column has much more content than the narrow identifier column ever could', 'ID'],
        ['Still a lot of text in the first column here', '1'],
        ['And even more in row three', '2'],
      ]);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0], MAX_DXA);
      assert.ok(result[1] >= MIN_DXA);
      assert.ok(result[1] < MAX_DXA);
    });

    it('keeps DXA total close to the table width invariant', () => {
      const result = computeColumnWidthsDxa([
        ['A', 'B', 'C', 'D'],
        ['one', 'two', 'three', 'four'],
        ['alpha', 'beta', 'gamma', 'delta'],
      ]);
      const sum = result.reduce((acc, w) => acc + w, 0);
      assert.ok(Math.abs(sum - TOTAL_DXA) <= result.length);
    });

    it('clamps CJK-heavy single column content to MAX', () => {
      const result = computeColumnWidthsDxa([
        ['标题'],
        ['这是一段非常长的中文内容用于测试列宽算法'],
      ]);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], MAX_DXA);
    });
  });
});
