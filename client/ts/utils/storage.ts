import * as _ from 'lodash';

export class Storage {
  data: any;

  constructor() {
    if (this.hasLocalStorage() && localStorage.data) {
      this.data = JSON.parse(localStorage.data);
    } else {
      this.resetData();
    }
  }

  resetData() {
    this.data = {
      hasAlreadyPlayed: false,
      player: {
        name: '',
        weapon: '',
        armor: '',
        image: ''
      },
      achievements: {
        unlocked: [],
        ratCount: 0,
        skeletonCount: 0,
        totalKills: 0,
        totalDmg: 0,
        totalRevives: 0
      },
      progression: {
        level: 1,
        xp: 0,
        xpToNext: 100
      }
    };
  }

  hasLocalStorage() {
    return true;
    // return Modernizr.localstorage;
  }

  save() {
    if (this.hasLocalStorage()) {
      localStorage.data = JSON.stringify(this.data);
    }
  }

  clear() {
    if (this.hasLocalStorage()) {
      localStorage.data = '';
      this.resetData();
    }
  }

  // Player

  hasAlreadyPlayed() {
    return this.data.hasAlreadyPlayed;
  }

  initPlayer(name) {
    this.data.hasAlreadyPlayed = true;
    this.setPlayerName(name);
  }

  setPlayerName(name) {
    this.data.player.name = name;
    this.save();
  }

  setPlayerImage(img) {
    this.data.player.image = img;
    this.save();
  }

  setPlayerArmor(armor) {
    this.data.player.armor = armor;
    this.save();
  }

  setPlayerWeapon(weapon) {
    this.data.player.weapon = weapon;
    this.save();
  }

  savePlayer(img, armor, weapon) {
    this.setPlayerImage(img);
    this.setPlayerArmor(armor);
    this.setPlayerWeapon(weapon);
  }

  // Achievements

  hasUnlockedAchievement(id) {
    return _.include(this.data.achievements.unlocked, id);
  }

  unlockAchievement(id) {
    if (!this.hasUnlockedAchievement(id)) {
      this.data.achievements.unlocked.push(id);
      this.save();
      return true;
    }
    return false;
  }

  getAchievementCount() {
    return _.size(this.data.achievements.unlocked);
  }

  // Angry rats
  getRatCount() {
    return this.data.achievements.ratCount;
  }

  incrementRatCount() {
    if (this.data.achievements.ratCount < 10) {
      this.data.achievements.ratCount++;
      this.save();
    }
  }

  // Skull Collector
  getSkeletonCount() {
    return this.data.achievements.skeletonCount;
  }

  incrementSkeletonCount() {
    if (this.data.achievements.skeletonCount < 10) {
      this.data.achievements.skeletonCount++;
      this.save();
    }
  }

  // Meatshield
  getTotalDamageTaken() {
    return this.data.achievements.totalDmg;
  }

  addDamage(damage) {
    if (this.data.achievements.totalDmg < 5000) {
      this.data.achievements.totalDmg += damage;
      this.save();
    }
  }

  // Hunter
  getTotalKills() {
    return this.data.achievements.totalKills;
  }

  incrementTotalKills() {
    if (this.data.achievements.totalKills < 50) {
      this.data.achievements.totalKills++;
      this.save();
    }
  }

  // Still Alive
  getTotalRevives() {
    return this.data.achievements.totalRevives;
  }

  incrementRevives() {
    if (this.data.achievements.totalRevives < 5) {
      this.data.achievements.totalRevives++;
      this.save();
    }
  }

  // Progression System

  getProgression() {
    // Initialize progression if it doesn't exist (for existing players)
    if (!this.data.progression) {
      this.data.progression = {
        level: 1,
        xp: 0,
        xpToNext: 100
      };
    }
    return this.data.progression;
  }

  saveProgression(level: number, xp: number, xpToNext: number) {
    if (!this.data.progression) {
      this.data.progression = { level: 1, xp: 0, xpToNext: 100 };
    }
    this.data.progression.level = level;
    this.data.progression.xp = xp;
    this.data.progression.xpToNext = xpToNext;
    this.save();
  }

  getLevel() {
    return this.getProgression().level;
  }

  getXp() {
    return this.getProgression().xp;
  }

  getXpToNext() {
    return this.getProgression().xpToNext;
  }

}
