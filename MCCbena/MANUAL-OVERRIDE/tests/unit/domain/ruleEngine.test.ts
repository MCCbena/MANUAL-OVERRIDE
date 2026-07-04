import { describe, it, expect } from 'vitest';
import { ruleEngine } from '../../src/domain/ruleEngine';
import type { Rule } from '../../src/domain/types';

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'test-rule',
    name: 'Test Rule',
    condition: 'always',
    effect: 'noop',
    priority: 0,
    ...overrides,
  } as Rule;
}

describe('ruleEngine', () => {
  it('should initialize with empty rules', () => {
    expect(ruleEngine.getRules()).toHaveLength(0);
  });

  it('should add a rule', () => {
    const rule = makeRule({ id: 'rule-1' });
    ruleEngine.addRule(rule);
    expect(ruleEngine.getRules()).toHaveLength(1);
  });

  it('should remove a rule by id', () => {
    const rule = makeRule({ id: 'rule-to-remove' });
    ruleEngine.addRule(rule);
    ruleEngine.removeRule('rule-to-remove');
    expect(ruleEngine.getRules()).toHaveLength(0);
  });

  it('should evaluate rules in priority order', () => {
    const highPriorityRule = makeRule({
      id: 'high',
      priority: 10,
      condition: 'always',
      effect: 'high-effect',
    });
    const lowPriorityRule = makeRule({
      id: 'low',
      priority: 1,
      condition: 'always',
      effect: 'low-effect',
    });

    ruleEngine.addRule(highPriorityRule);
    ruleEngine.addRule(lowPriorityRule);

    const results = ruleEngine.evaluate({ score: 100 });
    expect(results).toHaveLength(2);
    expect(results[0].ruleId).toBe('high');
    expect(results[1].ruleId).toBe('low');
  });

  it('should skip rules with unmet conditions', () => {
    const matchingRule = makeRule({
      id: 'match',
      condition: 'score > 50',
      effect: 'matched',
    });
    const nonMatchingRule = makeRule({
      id: 'no-match',
      condition: 'score > 200',
      effect: 'no-match-effect',
    });

    ruleEngine.addRule(matchingRule);
    ruleEngine.addRule(nonMatchingRule);

    const results = ruleEngine.evaluate({ score: 100 });
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe('match');
  });

  it('should handle rule removal gracefully', () => {
    expect(() => ruleEngine.removeRule('non-existent')).not.toThrow();
  });

  it('should clear all rules', () => {
    ruleEngine.addRule(makeRule({ id: 'rule-1' }));
    ruleEngine.addRule(makeRule({ id: 'rule-2' }));
    ruleEngine.clear();
    expect(ruleEngine.getRules()).toHaveLength(0);
  });

  it('should return empty results for no rules', () => {
    const results = ruleEngine.evaluate({ score: 0 });
    expect(results).toHaveLength(0);
  });

  it('should handle multiple rules with same priority', () => {
    const rule1 = makeRule({ id: 'rule-a', priority: 5, condition: 'always', effect: 'a' });
    const rule2 = makeRule({ id: 'rule-b', priority: 5, condition: 'always', effect: 'b' });

    ruleEngine.addRule(rule1);
    ruleEngine.addRule(rule2);

    const results = ruleEngine.evaluate({ score: 50 });
    expect(results).toHaveLength(2);
  });

  it('should update rule priority', () => {
    const rule = makeRule({ id: 'priority-rule', priority: 1 });
    ruleEngine.addRule(rule);
    
    ruleEngine.updateRulePriority('priority-rule', 100);
    
    const results = ruleEngine.evaluate({ score: 100 });
    expect(results[0].ruleId).toBe('priority-rule');
  });

  it('should handle complex conditions', () => {
    const complexRule = makeRule({
      id: 'complex',
      condition: 'score > 50 && combo > 3',
      effect: 'complex-effect',
    });

    ruleEngine.addRule(complexRule);

    const passResults = ruleEngine.evaluate({ score: 100, combo: 5 });
    expect(passResults).toHaveLength(1);

    const failResults = ruleEngine.evaluate({ score: 100, combo: 1 });
    expect(failResults).toHaveLength(0);
  });

  it('should not duplicate rules with same id', () => {
    const rule1 = makeRule({ id: 'duplicate' });
    const rule2 = makeRule({ id: 'duplicate' });

    ruleEngine.addRule(rule1);
    ruleEngine.addRule(rule2);

    expect(ruleEngine.getRules()).toHaveLength(1);
  });

  it('should evaluate with various score values', () => {
    const thresholdRule = makeRule({
      id: 'threshold',
      condition: 'score >= 100',
      effect: 'threshold-hit',
    });

    ruleEngine.addRule(thresholdRule);

    expect(ruleEngine.evaluate({ score: 99 })).toHaveLength(0);
    expect(ruleEngine.evaluate({ score: 100 })).toHaveLength(1);
    expect(ruleEngine.evaluate({ score: 101 })).toHaveLength(1);
  });

  it('should support rule tagging', () => {
    const taggedRule = makeRule({
      id: 'tagged-rule',
      tags: ['performance', 'scoring'],
      condition: 'always',
      effect: 'tagged-effect',
    });

    ruleEngine.addRule(taggedRule);
    
    const results = ruleEngine.evaluate({ score: 50 });
    expect(results).toHaveLength(1);
    expect(results[0].tags).toContain('performance');
  });

  it('should handle rule execution order stability', () => {
    const rules = Array.from({ length: 10 }, (_, i) =>
      makeRule({ id: `rule-${i}`, priority: i, condition: 'always', effect: `effect-${i}` })
    );

    rules.forEach(rule => ruleEngine.addRule(rule));

    const results = ruleEngine.evaluate({ score: 50 });
    expect(results).toHaveLength(10);
    
    for (let i = 0; i < 10; i++) {
      expect(results[i].ruleId).toBe(`rule-${9 - i}`);
    }
  });

  it('should handle edge case: zero score', () => {
    const rule = makeRule({
      id: 'zero-test',
      condition: 'score >= 0',
      effect: 'zero-hit',
    });

    ruleEngine.addRule(rule);
    expect(ruleEngine.evaluate({ score: 0 })).toHaveLength(1);
  });

  it('should handle edge case: negative score', () => {
    const rule = makeRule({
      id: 'negative-test',
      condition: 'score > -100',
      effect: 'negative-hit',
    });

    ruleEngine.addRule(rule);
    expect(ruleEngine.evaluate({ score: -50 })).toHaveLength(1);
    expect(ruleEngine.evaluate({ score: -150 })).toHaveLength(0);
  });
});