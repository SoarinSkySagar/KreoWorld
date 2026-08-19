import * as Phaser from "phaser";
import { IDLE_FRAME } from "../constants";
import { applyCameraZoom } from "../camera";
import { gameStore } from "@/lib/store/gameStore";
import { gameService } from "@/lib/services";
import type { BattleOutcome, Element, EnemySpec, InventoryItem } from "@/lib/services/types";
import {
  createBattleState,
  makePlayerCombatant,
  resolveRound,
  SUPER_EFFECTIVE,
} from "../combat/engine";
import type { BattleEvent, BattleState, PlayerAction } from "../combat/types";
import { HealthPanel } from "../ui/battle/HealthPanel";
import { OptionGrid, type GridOption } from "../ui/battle/OptionGrid";
import { BattleMessage } from "../ui/battle/BattleMessage";

export interface BattleSceneData {
  spec: EnemySpec;
  /** Scene key to resume when the fight ends. */
  returnTo: string;
  /** Identifies the overworld sprite to retire on a win. */
  instanceId: string;
}

/** Element tints, matching the loadout panel so a weapon reads the same in both places. */
const ELEMENT_COLOR: Record<Element, string> = {
  fire: "#e0653f",
  water: "#4aa3d8",
  earth: "#8a9b52",
  air: "#b9c6d6",
  void: "#a06bd0",
};

type MenuMode = "root" | "moves" | "items";

/**
 * The battle screen. A separate scene launched over a paused overworld, drawn
 * in game pixels at the same camera zoom as the world, so it reads as the same
 * game rather than as a UI panel bolted on top.
 *
 * All rules live in `combat/engine.ts` — this class renders state and collects
 * input. Nothing here decides what a hit is worth, and nothing here decides what
 * the fight paid out: the outcome goes back through `gameService.resolveBattle`,
 * which owns the numbers (CLAUDE.md §12).
 */
export class BattleScene extends Phaser.Scene {
  /** Named `battleData` because `Scene.data` is Phaser's own DataManager. */
  private battleData!: BattleSceneData;
  private state!: BattleState;

  private enemySprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private enemyPanel!: HealthPanel;
  private playerPanel!: HealthPanel;
  private message!: BattleMessage;
  private menu?: OptionGrid;
  private menuMode: MenuMode = "root";

  private inventory: InventoryItem[] = [];
  /** True while a round is animating; input is ignored so turns can't be double-submitted. */
  private busy = true;
  private finished = false;

  private vw = 0;
  private vh = 0;
  /** Text area of the message panel, in game pixels. */
  private messageBox = { x: 0, y: 0, w: 0 };
  /** Drawable area of the menu panel, in game pixels. */
  private menuBox = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    super("BattleScene");
  }

  init(data: BattleSceneData): void {
    this.battleData = data;
    gameStore.getState().setInBattle(true);
    this.busy = true;
    this.finished = false;
    this.menuMode = "root";
    this.menu = undefined;
  }

  async create(): Promise<void> {
    // Match the overworld's zoom so sprites and 8px text are the same size here
    // as they are out there, then anchor world (0,0) to the top-left of the view.
    applyCameraZoom(this);
    const cam = this.cameras.main;
    this.vw = Math.round(cam.width / cam.zoom);
    this.vh = Math.round(cam.height / cam.zoom);
    cam.centerOn(this.vw / 2, this.vh / 2);

    this.buildBackground();
    // The whole screen is laid out once against this zoom. Re-zooming mid-fight
    // would leave every panel at a stale position, so a resize keeps the battle
    // at the size it opened at and just re-centres it; the next battle picks up
    // the new window size.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.recentre, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.recentre, this),
    );

    const [loadout, inventory, player] = await Promise.all([
      gameService.getLoadout(),
      gameService.getInventory(),
      gameService.getPlayer(),
    ]);
    // A scene can be shut down while those awaits are in flight (the player
    // closed the tab, or a resize restarted things); bail rather than building
    // UI onto a dead scene.
    if (!this.scene.isActive()) return;

    this.inventory = inventory.filter((item) => item.battleUse && item.count > 0);

    const combatant = makePlayerCombatant(player.name, player.level, loadout.slots);
    this.state = createBattleState(combatant, this.battleData.spec);

    this.buildCombatants();
    this.buildPanels();
    this.buildMessageBox();
    this.bindKeys();

    await this.playIntro();
    this.openRootMenu();
  }

  private recentre = (): void => {
    this.cameras.main.setZoom(this.cameras.main.zoom);
    this.cameras.main.centerOn(this.vw / 2, this.vh / 2);
  };

  // --- construction -----------------------------------------------------------

  private buildBackground(): void {
    const { vw, vh } = this;
    const horizon = Math.round(vh * 0.46);

    // Sky, then ground. Two flat bands rather than a gradient: it stays crisp at
    // any zoom and matches the flat-colour palette of the tile art.
    this.add.rectangle(0, 0, vw, horizon, 0x1b2545).setOrigin(0, 0).setDepth(-100);
    this.add.rectangle(0, horizon, vw, vh - horizon, 0x2a3350).setOrigin(0, 0).setDepth(-100);

    // A few slashes of light so the sky is not a dead rectangle.
    const streaks = this.add.graphics().setDepth(-99);
    streaks.fillStyle(0x2b3766, 0.7);
    for (let i = 0; i < 5; i += 1) {
      const y = 6 + i * 7;
      streaks.fillRect(vw * 0.1 + i * 9, y, vw * 0.55 - i * 14, 2);
    }

    // The two platforms the combatants stand on.
    const platforms = this.add.graphics().setDepth(-90);
    const drawPlatform = (cx: number, cy: number, rx: number, ry: number) => {
      platforms.fillStyle(0x3a4570, 1);
      platforms.fillEllipse(cx, cy, rx * 2, ry * 2);
      platforms.fillStyle(0x4b578a, 1);
      platforms.fillEllipse(cx, cy - 1.5, rx * 2 - 4, ry * 2 - 3);
    };
    drawPlatform(vw * 0.72, vh * 0.42, vw * 0.15, vh * 0.045);
    drawPlatform(vw * 0.26, vh * 0.66, vw * 0.19, vh * 0.055);
  }

  private buildCombatants(): void {
    const { vw, vh } = this;

    const enemyGroundY = Math.round(vh * 0.42);
    this.enemySprite = this.add
      .image(vw * 0.72, enemyGroundY, this.battleData.spec.spriteKey)
      .setOrigin(0.5, 1)
      .setDepth(100);
    // Sprites are trimmed to their art, so height is a real size signal: scale
    // against a reference so a Null Engine looms and a Cinderchick doesn't,
    // clamped so neither leaves the platform or vanishes into it.
    const refScale = (vh * 0.28) / 48;
    const targetH = Phaser.Math.Clamp(this.enemySprite.height * refScale, vh * 0.16, vh * 0.44);
    this.enemySprite.setScale(targetH / this.enemySprite.height);
    // Slide in from off-screen right.
    this.enemySprite.x = vw + this.enemySprite.displayWidth;

    const playerGroundY = Math.round(vh * 0.66);
    this.playerSprite = this.add
      .sprite(vw * 0.26, playerGroundY, "adam", IDLE_FRAME.up)
      .setOrigin(0.5, 1)
      .setDepth(100)
      // The player is shown from behind, as in the genre — `up` is the back view.
      .setScale(Math.max(2, Math.round((vh * 0.26) / 32)));
    this.playerSprite.x = -this.playerSprite.displayWidth;
  }

  private buildPanels(): void {
    const { vw, vh } = this;
    const panelW = Math.min(132, Math.round(vw * 0.38));

    this.enemyPanel = new HealthPanel(
      this,
      8,
      10,
      this.state.enemy.name,
      this.state.enemy.title,
      this.state.enemy.level,
      this.state.enemy.maxHp,
      { showNumbers: false, width: panelW },
    );
    this.playerPanel = new HealthPanel(
      this,
      vw - panelW - 8,
      Math.round(vh * 0.47),
      this.state.player.name,
      "your universe",
      this.state.player.level,
      this.state.player.maxHp,
      { showNumbers: true, width: panelW },
    );
    this.enemyPanel.setVisible(false);
    this.playerPanel.setVisible(false);
  }

  /**
   * The bottom band: a message panel on the left and a menu panel on the right,
   * as in the genre. Two boxes rather than one keeps the narration from
   * reflowing around the cursor when the menu changes shape.
   */
  private buildMessageBox(): void {
    const { vw, vh } = this;
    const boxH = 52;
    const boxY = vh - boxH - 4;
    const msgW = Math.round(vw * 0.48);
    const menuX = 4 + msgW + 4;

    const panel = (x: number, w: number) =>
      this.add
        .rectangle(x, boxY, w, boxH, 0x0b1020, 0.94)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x6ee7ff)
        .setDepth(400000);

    panel(4, msgW);
    panel(menuX, vw - menuX - 4);

    this.messageBox = { x: 10, y: boxY + 6, w: msgW - 12 };
    this.menuBox = { x: menuX + 8, y: boxY + 6, w: vw - menuX - 16, h: boxH - 12 };
    this.message = new BattleMessage(this, this.messageBox.x, this.messageBox.y, this.messageBox.w);
  }

  // --- input ------------------------------------------------------------------

  private bindKeys(): void {
    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.menu?.move(0, -1));
    kb.on("keydown-DOWN", () => this.menu?.move(0, 1));
    kb.on("keydown-LEFT", () => this.menu?.move(-1, 0));
    kb.on("keydown-RIGHT", () => this.menu?.move(1, 0));
    kb.on("keydown-W", () => this.menu?.move(0, -1));
    kb.on("keydown-S", () => this.menu?.move(0, 1));
    kb.on("keydown-A", () => this.menu?.move(-1, 0));
    kb.on("keydown-D", () => this.menu?.move(1, 0));
    kb.on("keydown-E", () => this.onConfirm());
    kb.on("keydown-SPACE", () => this.onConfirm());
    kb.on("keydown-ENTER", () => this.onConfirm());
    kb.on("keydown-X", () => this.onCancel());
    kb.on("keydown-ESC", () => this.onCancel());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
  }

  private onConfirm(): void {
    // While a round narrates, confirm only fast-forwards the text.
    if (this.busy) {
      this.message.skip();
      return;
    }
    if (!this.menu) return;
    const index = this.menu.selectedIndex;
    if (this.menuMode === "root") return this.chooseRoot(index);
    if (this.menuMode === "moves") return void this.takeTurn({ kind: "move", index });
    const item = this.inventory[index];
    if (item?.battleUse) {
      item.count -= 1;
      void this.takeTurn({ kind: "item", itemId: item.id, heal: item.battleUse.amount });
    }
  }

  private onCancel(): void {
    if (this.busy || this.menuMode === "root") return;
    this.openRootMenu();
  }

  private chooseRoot(index: number): void {
    if (index === 0) return this.openMoveMenu();
    if (index === 1) return this.openItemMenu();
    void this.takeTurn({ kind: "flee" });
  }

  // --- menus ------------------------------------------------------------------

  private clearMenu(): void {
    this.menu?.destroy();
    this.menu = undefined;
  }

  private openRootMenu(): void {
    this.clearMenu();
    this.menuMode = "root";
    this.message.set("What will you do?");
    const options: GridOption[] = [
      { label: "FIGHT" },
      {
        label: this.inventory.length > 0 ? `BAG (${this.inventory.length})` : "BAG",
        disabled: this.inventory.length === 0,
      },
      // Unfleeable enemies read as a locked option rather than a silent no-op,
      // so the player learns the Rescinded rule from the menu itself.
      { label: this.state.canFlee ? "RUN" : "RUN ✕", disabled: !this.state.canFlee },
    ];
    this.menu = new OptionGrid(this, this.menuBox.x, this.menuBox.y, options, 1, 0, 13);
  }

  private openMoveMenu(): void {
    this.clearMenu();
    this.menuMode = "moves";
    this.message.set("Which weapon?");
    const options: GridOption[] = this.state.player.moves.map((move) => ({
      label: move.ability.name,
      detail: `${move.element} ${move.usesLeft}/${move.ability.uses}`,
      iconKey: move.weapon ? `weapon:${move.weapon.iconKey}` : undefined,
      color: ELEMENT_COLOR[move.element],
      disabled: move.usesLeft <= 0,
    }));
    // Two columns once there are more than two weapons, so a full loadout fills
    // the panel the way a four-move list does in the genre.
    const columns = options.length > 2 ? 2 : 1;
    const rows = Math.ceil(options.length / columns);
    const cellW = Math.floor(this.menuBox.w / columns);
    const cellH = Math.min(20, Math.floor(this.menuBox.h / rows));
    this.menu = new OptionGrid(this, this.menuBox.x, this.menuBox.y, options, columns, cellW, cellH);
  }

  private openItemMenu(): void {
    if (this.inventory.length === 0) return;
    this.clearMenu();
    this.menuMode = "items";
    this.message.set("Use what?");
    const options: GridOption[] = this.inventory.map((item) => ({
      label: item.name,
      detail: `+${item.battleUse!.amount} hp  x${item.count}`,
      disabled: item.count <= 0,
    }));
    const cellH = Math.min(18, Math.floor(this.menuBox.h / Math.max(1, options.length)));
    this.menu = new OptionGrid(this, this.menuBox.x, this.menuBox.y, options, 1, 0, cellH);
  }

  // --- flow -------------------------------------------------------------------

  private async playIntro(): Promise<void> {
    this.busy = true;
    // A white flash, the way an encounter opens in the genre.
    const flash = this.add
      .rectangle(0, 0, this.vw, this.vh, 0xffffff)
      .setOrigin(0, 0)
      .setDepth(500000);
    await this.tweenAsync({ targets: flash, alpha: 0, duration: 320 });
    flash.destroy();

    await Promise.all([
      this.tweenAsync({
        targets: this.enemySprite,
        x: this.vw * 0.72,
        duration: 420,
        ease: "Cubic.easeOut",
      }),
      this.tweenAsync({
        targets: this.playerSprite,
        x: this.vw * 0.26,
        duration: 420,
        ease: "Cubic.easeOut",
      }),
    ]);

    this.enemyPanel.setVisible(true);
    this.playerPanel.setVisible(true);
    await this.message.show(this.battleData.spec.taunt, 1.4);
    this.busy = false;
  }

  private async takeTurn(action: PlayerAction): Promise<void> {
    if (this.busy || this.finished) return;
    this.busy = true;
    this.clearMenu();

    const { state, events } = resolveRound(this.state, action, Math.random);
    this.state = state;
    await this.narrate(events);

    if (state.phase === "won") return void this.finish("won");
    if (state.phase === "lost") return void this.finish("lost");
    if (state.phase === "fled") return void this.finish("fled");

    this.busy = false;
    this.openRootMenu();
  }

  /** Play the round's events back one at a time, syncing the bars as they happen. */
  private async narrate(events: BattleEvent[]): Promise<void> {
    for (const event of events) {
      switch (event.kind) {
        case "message":
          await this.message.show(event.text);
          break;
        case "attack": {
          const who = event.by === "player" ? this.state.player.name : this.state.enemy.name;
          await this.message.show(`${who} uses ${event.move}!`, 0.6);
          await this.shake(event.by === "player" ? this.enemySprite : this.playerSprite);
          await this.syncBars();
          if (event.effectiveness >= SUPER_EFFECTIVE) {
            await this.message.show("It's super effective!", 0.8);
          } else if (event.effectiveness < 1) {
            await this.message.show("It's not very effective…", 0.8);
          }
          break;
        }
        case "miss": {
          const who = event.by === "player" ? this.state.player.name : this.state.enemy.name;
          await this.message.show(`${who} uses ${event.move}… and misses.`);
          break;
        }
        case "effect":
          await this.message.show(event.text, 0.8);
          break;
        case "status":
          await this.message.show(event.text, 0.8);
          await this.syncBars();
          break;
        case "heal":
          await this.syncBars();
          await this.message.show(
            event.on === "player"
              ? `You recover ${event.amount} elixir.`
              : `${this.state.enemy.name} recovers ${event.amount} elixir.`,
            0.7,
          );
          break;
        case "faint":
          await this.syncBars();
          await this.faint(event.who === "enemy" ? this.enemySprite : this.playerSprite);
          await this.message.show(
            event.who === "enemy"
              ? `${this.state.enemy.name} goes down.`
              : "You can't keep your feet.",
            1.2,
          );
          break;
        case "fled":
          await this.message.show(
            event.success ? "You break away down the road." : "You can't get clear!",
            1,
          );
          break;
      }
    }
  }

  private syncBars(): Promise<void> {
    return Promise.all([
      this.enemyPanel.setHp(this.state.enemy.hp),
      this.playerPanel.setHp(this.state.player.hp),
    ]).then(() => undefined);
  }

  /**
   * Settle the fight: report the outcome, let the service decide what it paid,
   * show the result, then hand control back to the overworld.
   */
  private async finish(result: BattleOutcome["result"]): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    this.clearMenu();

    const outcome: BattleOutcome = {
      enemyId: this.battleData.spec.id,
      result,
      hpRemaining: this.state.player.hp,
      turnsTaken: this.state.turn,
    };

    try {
      const reward = await gameService.resolveBattle(outcome);
      // The service moved the balances; re-read rather than patching locally so
      // the HUD and the service can never disagree.
      await gameStore.getState().hydrate();
      await this.message.show(reward.message, 1.6);
    } catch (e) {
      await this.message.show(
        e instanceof Error ? e.message : "The settlement could not be recorded.",
        1.6,
      );
    }

    this.cameras.main.fadeOut(280);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      gameStore.getState().setInBattle(false);
      this.scene.stop();
      // The overworld is listening for this to retire the enemy it launched us with.
      this.scene.get(this.battleData.returnTo)?.events.emit("battle:ended", {
        instanceId: this.battleData.instanceId,
        result,
      });
      this.scene.resume(this.battleData.returnTo);
    });
  }

  // --- small helpers ----------------------------------------------------------

  private tweenAsync(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      const tween = this.tweens.add(config);
      tween.once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => resolve());
    });
  }

  /** Sink and fade the loser, the way a battler drops out of frame in the genre. */
  private faint(target: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): Promise<void> {
    return this.tweenAsync({
      targets: target,
      y: target.y + target.displayHeight * 0.7,
      alpha: 0,
      duration: 420,
      ease: "Quad.easeIn",
    });
  }

  /** A short recoil on the sprite that just took a hit. */
  private shake(target: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): Promise<void> {
    const originX = target.x;
    return this.tweenAsync({
      targets: target,
      x: originX + 4,
      duration: 55,
      yoyo: true,
      repeat: 2,
    }).then(() => {
      // yoyo+repeat lands back on `originX`, but rounding over several cycles can
      // leave it a fraction off; snap it so sprites never drift across a fight.
      target.setX(originX);
    });
  }
}

/** Load the weapon icons the battle menu draws. Call in a scene's preload. */
export function preloadWeaponIcons(
  scene: Phaser.Scene,
  iconKeys: readonly string[],
): void {
  for (const key of iconKeys) {
    scene.load.image(`weapon:${key}`, `/assets/weapons/${key}.png`);
  }
}
