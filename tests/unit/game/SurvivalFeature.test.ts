import { describe, it, expect, beforeEach } from 'vitest'
import { SurvivalFeature } from '../../../src/game/systems/SurvivalFeature'
import { Player, Hazard, Item } from '../../../src/game/entities'
import type { MutableWorld, InputSnapshot } from '../../../src/engine/types'
import { SURVIVAL } from '../../../src/data/tunables'

// テスト用の最小限のMutableWorldモック
function createMockWorld(overrideFeatures?: string[]): MutableWorld {
  const player = new Player(100, 500)
  const hazards: Hazard[] = []
  const items: Item[] = []
  const popups: unknown[] = []
  let shakeAmount = 0

  const featureSet = new Set(
    overrideFeatures ?? ['survival_hunger', 'survival_melee', 'survival_level'],
  )

  const world: MutableWorld = {
    player,
    hazards,
    items,
    cameraX: 0,
    distance: 0,
    rules: {
      features: featureSet,
      controls: { shoot: 'z' },
    },
    addParticle: () => {},
    addScorePopup: (_x: number, _y: number, _text: string, _color: string) => {
      popups.push({ _x, _y, _text, _color })
    },
    triggerShake: (amount: number) => {
      shakeAmount = amount
    },
    modifyPlayerHp: (delta: number) => {
      player.hp = Math.max(0, Math.min(player.maxHp, player.hp + delta))
    },
    addScoreVarsItemCollected: () => {},
    spawnItem: (item: Item) => {
      items.push(item)
    },
  } as unknown as MutableWorld

  return { world, popups, shakeAmount, player } as { world: MutableWorld; popups: unknown[]; shakeAmount: number; player: Player } as MutableWorld as any
}

function createTestWorld(): { world: MutableWorld; popups: { _x: number; _y: number; _text: string; _color: string }[]; player: Player } {
  const player = new Player(100, 500)
  const hazards: Hazard[] = []
  const items: Item[] = []
  const popups: { _x: number; _y: number; _text: string; _color: string }[] = []

  const world: MutableWorld = {
    player,
    hazards,
    items,
    cameraX: 0,
    distance: 0,
    rules: {
      features: new Set(['survival_hunger', 'survival_melee', 'survival_level', 'survival_item']),
      controls: { shoot: 'z' },
    },
    addParticle: () => {},
    addScorePopup: (x: number, y: number, text: string, color: string) => {
      popups.push({ _x: x, _y: y, _text: text, _color: color })
    },
    triggerShake: () => {},
    modifyPlayerHp: (delta: number) => {
      player.hp = Math.max(0, Math.min(player.maxHp, player.hp + delta))
    },
    addScoreVarsItemCollected: () => {},
    spawnItem: (item: Item) => {
      items.push(item)
    },
  } as unknown as MutableWorld

  return { world, popups, player }
}

function createMockInput(justPressed: Set<string> = new Set()): InputSnapshot {
  return {
    keys: new Set<string>(),
    justPressed,
    justReleased: new Set<string>(),
  } as InputSnapshot
}

describe('SurvivalFeature', () => {
  let feature: SurvivalFeature
  let tw: ReturnType<typeof createTestWorld>

  beforeEach(() => {
    feature = new SurvivalFeature()
    tw = createTestWorld()
    feature.onInit(tw.world)
  })

  describe('onInit', () => {
    it('sets maxHp to survival config value', () => {
      const maxHp = SURVIVAL.maxPlayerHp
      expect(tw.player.maxHp).toBe(maxHp)
      expect(tw.player.hp).toBe(maxHp)
    })

    it('initializes hunger/level/weaponDamage', () => {
      expect(tw.player.hunger).toBe(SURVIVAL.maxHunger)
      expect(tw.player.level).toBe(1)
      expect(tw.player.weaponDamage).toBe(SURVIVAL.meleeDamage)
    })

    it('initializes currentLevelXp and nextLevelXp', () => {
      expect(tw.player.currentLevelXp).toBe(0)
      expect(tw.player.nextLevelXp).toBe(SURVIVAL.xpPerLevel)
    })
  })

  describe('hunger decay', () => {
    it('decays hunger over time', () => {
      const initialHunger = tw.player.hunger
      feature.update(tw.world, createMockInput(), 1) // 1 second
      expect(tw.player.hunger).toBeCloseTo(initialHunger - SURVIVAL.hungerDecayRate)
    })

    it('clamps hunger at 0', () => {
      tw.player.hunger = 1
      feature.update(tw.world, createMockInput(), 1)
      expect(tw.player.hunger).toBeGreaterThanOrEqual(0)
    })

    it('deals HP damage when below critical threshold', () => {
      tw.player.hunger = SURVIVAL.hungerCriticalThreshold - 1
      feature.update(tw.world, createMockInput(), SURVIVAL.hungerDamageInterval)
      expect(tw.player.hp).toBeLessThan(SURVIVAL.maxPlayerHp)
    })

    it('does not deal damage when above critical threshold', () => {
      const initialHp = tw.player.hp
      tw.player.hunger = SURVIVAL.maxHunger
      feature.update(tw.world, createMockInput(), SURVIVAL.hungerDamageInterval * 2)
      expect(tw.player.hp).toBe(initialHp)
    })
  })

  describe('melee attack', () => {
    it('triggers melee on Z key press', () => {
      const input = createMockInput(new Set(['z']))
      feature.update(tw.world, input, 0)
    })

    it('prevents attack during cooldown', () => {
      const input1 = createMockInput(new Set(['z']))
      feature.update(tw.world, input1, 0)
      const input2 = createMockInput(new Set(['z']))
      feature.update(tw.world, input2, 0)
      // Second attack should not trigger (cooldown active)
      // Verify by checking meleeCooldown is still > 0 (second press was consumed but did not reset)
      expect((feature as any).state.meleeCooldown).toBeGreaterThan(0)
      expect((feature as any).state.meleeActive).toBeGreaterThan(0)
    })

    it('deals damage to enemies in range', () => {
      const hazard = new Hazard(
        tw.player.x + tw.player.w + 10,
        tw.player.y,
        30, 40, 'red', '#ff0000', 'rect', 3, false, 0, 'right',
      )
      tw.world.hazards.push(hazard)

      // Z押下 + meleeActive > 0 でダメージ判定が走るので、1フレームに1回だけ呼ぶ
      const input = createMockInput(new Set(['z']))
      feature.update(tw.world, input, 0)

      expect(hazard.hp).toBe(3 - SURVIVAL.meleeDamage)
    })

    it('does not damage safe hazards', () => {
      const hazard = new Hazard(
        tw.player.x + tw.player.w + 10,
        tw.player.y,
        30, 40, 'green', '#00ff00', 'rect', 3, true, 0, 'right',
      )
      tw.world.hazards.push(hazard)

      const input = createMockInput(new Set(['z']))
      feature.update(tw.world, input, 0)
      feature.update(tw.world, createMockInput(), 0)

      expect(hazard.hp).toBe(3)
    })
  })

  describe('XP / level system', () => {
    it('gains XP on enemy kill', () => {
      const hazard = new Hazard(
        tw.player.x + tw.player.w + 10,
        tw.player.y,
        30, 40, 'red', '#ff0000', 'rect', 1, false, 0, 'right',
      )
      tw.world.hazards.push(hazard)

      const input = createMockInput(new Set(['z']))
      feature.update(tw.world, input, 0)
      feature.update(tw.world, createMockInput(), 0)

      expect(tw.player.exp).toBe(SURVIVAL.xpPerKill)
      expect(tw.player.currentLevelXp).toBe(SURVIVAL.xpPerKill)
    })

    it('levels up when XP threshold is met', () => {
      const enemiesNeeded = Math.ceil(SURVIVAL.xpPerLevel / SURVIVAL.xpPerKill)
      for (let i = 0; i < enemiesNeeded; i++) {
        const hazard = new Hazard(
          tw.player.x + tw.player.w + 10,
          tw.player.y,
          30, 40, 'red', '#ff0000', 'rect', 1, false, 0, 'right',
        )
        tw.world.hazards.push(hazard)

        const input = createMockInput(new Set(['z']))
        feature.update(tw.world, input, SURVIVAL.meleeCooldown + 0.01)
        feature.update(tw.world, createMockInput(), 0)
      }

      expect(tw.player.level).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Item pickup', () => {
    it('restores hunger from food item', () => {
      tw.player.hunger = 10
      const food = new Item(tw.player.x, tw.player.y, 'food')
      tw.world.items.push(food)

      feature.update(tw.world, createMockInput(), 0)

      expect(tw.player.hunger).toBeGreaterThan(10)
      expect(food.alive).toBe(false)
    })

    it('increases weaponDamage from weapon item', () => {
      const initialDmg = tw.player.weaponDamage
      const weapon = new Item(tw.player.x, tw.player.y, 'weapon')
      tw.world.items.push(weapon)

      feature.update(tw.world, createMockInput(), 0)

      expect(tw.player.weaponDamage).toBeGreaterThan(initialDmg)
      expect(weapon.alive).toBe(false)
    })

    it('restores HP from hp item', () => {
      tw.player.hp = 3
      const hpItem = new Item(tw.player.x, tw.player.y, 'hp')
      tw.world.items.push(hpItem)

      feature.update(tw.world, createMockInput(), 0)

      const heal = SURVIVAL.hpRestore
      expect(tw.player.hp).toBe(Math.min(3 + heal, tw.player.maxHp))
      expect(hpItem.alive).toBe(false)
    })

    it('does not restore HP when already at maxHp (item still consumed)', () => {
      tw.player.hp = tw.player.maxHp
      const hpItem = new Item(tw.player.x, tw.player.y, 'hp')
      tw.world.items.push(hpItem)

      feature.update(tw.world, createMockInput(), 0)

      expect(tw.player.hp).toBe(tw.player.maxHp)
      expect(hpItem.alive).toBe(false) // consumed even if no heal applied (consistent with RpgFeature)
    })

    it('does not process exp items', () => {
      const expItem = new Item(tw.player.x, tw.player.y, 'exp')
      tw.world.items.push(expItem)

      feature.update(tw.world, createMockInput(), 0)

      expect(expItem.alive).toBe(true)
    })
  })

  describe('onManualUpdated', () => {
    it('resets state and player stats', () => {
      tw.player.hunger = 10
      tw.player.hp = 1
      tw.player.maxHp = 1
      tw.player.level = 5
      tw.player.weaponDamage = 10

      feature.onManualUpdated(tw.world, 'test-v1')

      const maxHp = SURVIVAL.maxPlayerHp
      expect(tw.player.maxHp).toBe(maxHp)
      expect(tw.player.hp).toBe(maxHp)
      expect(tw.player.hunger).toBe(SURVIVAL.maxHunger)
      expect(tw.player.level).toBe(1)
      expect(tw.player.weaponDamage).toBe(SURVIVAL.meleeDamage)
    })
  })

  describe('onDisable', () => {
    it('resets state and player stats', () => {
      tw.player.hunger = 10
      tw.player.level = 5
      tw.player.weaponDamage = 10

      feature.onDisable?.(tw.world)

      expect(tw.player.hunger).toBe(SURVIVAL.maxHunger)
      expect(tw.player.level).toBe(1)
      expect(tw.player.weaponDamage).toBe(SURVIVAL.meleeDamage)
    })
  })
})
