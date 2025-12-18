import {Storage} from './utils/storage';
import {Config} from './config';
import * as _ from 'lodash';
import {IntroSequence} from './ui/intro-sequence';

export class App {

  config = Config;
  blinkInterval;
  previousState;
  isParchmentReady;
  ready;
  storage: Storage;
  watchNameInputInterval;
  $playButton;
  $playDiv;
  game;
  isMobile;
  isTablet;
  isDesktop;
  supportsWorkers;
  messageTimer;
  introSequence: IntroSequence;

  constructor() {
    this.blinkInterval = null;
    this.previousState = null;
    this.isParchmentReady = true;
    this.ready = false;
    this.storage = new Storage();
    this.watchNameInputInterval = setInterval(this.toggleButton.bind(this), 100);
    this.$playButton = $('.play'),
      this.$playDiv = $('.play div');
    this.introSequence = new IntroSequence();
  }

  setGame(game) {
    this.game = game;
    this.isMobile = this.game.renderer.mobile;
    this.isTablet = this.game.renderer.tablet;
    this.isDesktop = !(this.isMobile || this.isTablet);
    this.supportsWorkers = !!window.Worker;
    this.ready = true;
  }

  center() {
    window.scrollTo(0, 1);
  }

  canStartGame() {
    if (this.isDesktop) {
      return (this.game && this.game.map && this.game.map.isLoaded);
    } else {
      return this.game;
    }
  }

  tryStartingGame(username, password, starting_callback) {
    console.log('Trying to start game with username', username);
    var self = this,
      $play = this.$playButton;

    if (username !== '') {
      if (!this.ready || !this.canStartGame()) {
        if (!this.isMobile) {
          // on desktop and tablets, add a spinner to the play button
          $play.addClass('loading');
        }
        this.$playDiv.unbind('click');
        var watchCanStart = setInterval(function () {
          console.debug('waiting...');
          if (self.canStartGame()) {
            setTimeout(function () {
              if (!self.isMobile) {
                $play.removeClass('loading');
              }
            }, 1500);
            clearInterval(watchCanStart);
            self.startGame(username, password, starting_callback);
          }
        }, 100);
      } else {
        this.$playDiv.unbind('click');
        this.startGame(username, password, starting_callback);
      }
    }
  }

  async startGame(username, password, starting_callback) {
    var self = this;

    if (starting_callback) {
      starting_callback();
    }

    // Check for skipintro URL parameter (for testing)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('skipintro')) {
      console.log('[App] Skipping intro (skipintro parameter)');
      this.proceedToGame(username, password);
      return;
    }

    // Always show intro on fresh load (like a game intro cutscene)
    // Fetch and play intro sequence
    {
      try {
        const introData = await this.introSequence.fetchIntro(username);
        if (introData) {
          // Track if game has started loading
          let gameStarted = false;

          // Set up callbacks
          this.introSequence.setCallbacks({
            onComplete: () => {
              // Shatter effect finished, game should be visible now
              // Nothing to do here - game already started in onReadyForGame
            },
            onSkip: () => {
              if (!gameStarted) {
                self.proceedToGame(username, password);
              }
            },
            onReadyForGame: () => {
              // Intro narration done - start loading the game in background
              // The shatter effect will wait for signalGameReady()
              if (!gameStarted) {
                gameStarted = true;
                self.startGameInBackground(username, password);
              }
            }
          });

          // Hide the login UI first
          this.hideIntro(() => {});

          // Play the intro
          await this.introSequence.play(introData);
          return;
        }
      } catch (error) {
        console.warn('[App] Intro sequence failed, proceeding to game:', error);
      }
    }

    // No intro or intro failed - proceed directly
    this.proceedToGame(username, password);
  }

  /**
   * Start the game connection in the background while intro is still showing
   * Signals the intro sequence when game is ready to be revealed
   */
  private startGameInBackground(username: string, password: string): void {
    var self = this;

    // Switch to game body class (hides intro parchment, shows canvas)
    $('body').removeClass('intro').addClass('game');

    if (!this.isDesktop) {
      // On mobile and tablet we load the map after the player has clicked
      this.game.loadMap();
    }

    var firstTimePlaying = !this.storage.hasAlreadyPlayed();

    if (username && !this.game.started) {
      var config = this.config;

      // Use current hostname for production (HTTPS) to support multiple domains
      var host = window.location.protocol === 'https:'
        ? window.location.hostname
        : config.host;

      this.game.setServerOptions(host, config.port, username, password);

      this.center();

      // Run game with callback that signals intro when ready
      this.game.run(function () {
        // Game is now running and ready to be displayed
        console.log('[App] Game ready, signaling intro sequence');
        self.introSequence.signalGameReady();
        self.initPauseOverlay();

        if (firstTimePlaying) {
          self.toggleInstructions();
        }
      });
    }
  }

  /**
   * Proceed to game after intro (or if skipped)
   */
  private proceedToGame(username: string, password: string): void {
    var self = this;

    this.hideIntro(function () {
      if (!self.isDesktop) {
        // On mobile and tablet we load the map after the player has clicked
        // on the PLAY button instead of loading it in a web worker.
        self.game.loadMap();
      }
      self.start(username, password);
    });
  }

  start(username, password = '') {
    var self = this,
      firstTimePlaying = !self.storage.hasAlreadyPlayed();

    if (username && !this.game.started) {
      var config = this.config;

      // Use current hostname for production (HTTPS) to support multiple domains
      var host = window.location.protocol === 'https:'
        ? window.location.hostname
        : config.host;

      this.game.setServerOptions(host, config.port, username, password);

      this.center();
      this.game.run(function () {
        $('body').addClass('started');
        self.initPauseOverlay();
        if (firstTimePlaying) {
          self.toggleInstructions();
        }
      });
    }
  }

  setMouseCoordinates(event) {
    var gamePos = $('#container').offset(),
      scale = this.game.renderer.getScaleFactor(),
      width = this.game.renderer.getWidth(),
      height = this.game.renderer.getHeight(),
      mouse = this.game.mouse;

    mouse.x = event.pageX - gamePos.left - (this.isMobile ? 0 : 5 * scale);
    mouse.y = event.pageY - gamePos.top - (this.isMobile ? 0 : 7 * scale);

    if (mouse.x <= 0) {
      mouse.x = 0;
    } else if (mouse.x >= width) {
      mouse.x = width - 1;
    }

    if (mouse.y <= 0) {
      mouse.y = 0;
    } else if (mouse.y >= height) {
      mouse.y = height - 1;
    }
  }

  initHealthBar() {
    var $hitpoints = $('#statusbar #hitpoints');
    var $vignette = $('#low-health-vignette');

    // Set initial width to 100%
    $hitpoints.css('width', '100%');

    this.game.onPlayerHealthChange(function (hp, maxHp) {
      var percent = Math.round((hp > 0 ? hp : 0) / maxHp * 100);
      console.debug('Health update: ' + hp + '/' + maxHp + ' = ' + percent + '%');
      $hitpoints.css('width', percent + '%');

      // Toggle low health vignette at 30% health
      if (percent <= 30 && percent > 0) {
        $vignette.addClass('active');
      } else {
        $vignette.removeClass('active');
      }
    });

    this.game.onPlayerHurt(this.blinkHealthBar.bind(this));
  }

  blinkHealthBar() {
    var $hitpoints = $('#statusbar #hitpoints');

    $hitpoints.addClass('white');
    setTimeout(function () {
      $hitpoints.removeClass('white');
    }, 500)
  }

  initXpBar() {
    var $xpfill = $('#statusbar #xpfill');
    var $levelDisplay = $('#statusbar #level-display');

    // Set initial width to 0%
    $xpfill.css('width', '0%');

    this.game.onPlayerXpChange(function (xp, xpToNext, level) {
      var percent = Math.round((xp / xpToNext) * 100);
      console.debug('XP update: ' + xp + '/' + xpToNext + ' = ' + percent + '% (Lv.' + level + ')');
      $xpfill.css('width', percent + '%');
      $levelDisplay.text('Lv.' + level);
    });
  }

  initGoldDisplay() {
    var self = this;
    this.game.onPlayerGoldChange(function (gold) {
      var $display = $('#gold-display');
      $display.text(gold + 'g');
      // Flash animation for visual feedback
      $display.addClass('flash');
      setTimeout(function() {
        $display.removeClass('flash');
      }, 300);
    });

    // Initialize with saved gold on startup
    var savedGold = this.game.storage.getGold();
    this.game.playerGold = savedGold;
    $('#gold-display').text(savedGold + 'g');
  }

  toggleButton() {
    var name = $('#parchment input').val() as string,
      $play = $('#createcharacter .play');

    if (name && name.length > 0) {
      $play.removeClass('disabled');
      $('#character').removeClass('disabled');
    } else {
      $play.addClass('disabled');
      $('#character').addClass('disabled');
    }
  }

  hideIntro(hidden_callback) {
    clearInterval(this.watchNameInputInterval);
    $('body').removeClass('intro');
    setTimeout(function () {
      $('body').addClass('game');
      hidden_callback();
    }, 1000);
  }

  showChat() {
    if (this.game.started) {
      $('#chatbox').addClass('active');
      $('#chatinput').focus();
      $('#chatbutton').addClass('active');
    }
  }

  hideChat() {
    if (this.game.started) {
      $('#chatbox').removeClass('active');
      $('#chatinput').blur();
      $('#chatbutton').removeClass('active');
    }
  }

  toggleInstructions() {
    // Close new achievements panel if open
    if (this.game?.achievementUI?.isVisible()) {
      this.game.achievementUI.hide();
      $('#achievementsbutton').removeClass('active');
    }
    $('#instructions').toggleClass('active');
  }

  initEquipmentIcons() {
    var scale = this.game.renderer.getScaleFactor();
    var getIconPath = function (spriteName) {
        return 'img/' + scale + '/item-' + spriteName + '.png';
      },
      weapon = this.game.player.getWeaponName(),
      armor = this.game.player.getSpriteName(),
      weaponPath = getIconPath(weapon),
      armorPath = getIconPath(armor);

    $('#weapon').css('background-image', 'url("' + weaponPath + '")');
    if (armor !== 'firefox') {
      $('#armor').css('background-image', 'url("' + armorPath + '")');
    }
  }

  hideWindows() {
    // Close new achievements panel if open
    if (this.game?.achievementUI?.isVisible()) {
      this.game.achievementUI.hide();
      $('#achievementsbutton').removeClass('active');
    }
    if ($('#instructions').hasClass('active')) {
      this.toggleInstructions();
      $('#helpbutton').removeClass('active');
    }
    if ($('body').hasClass('credits')) {
      this.closeInGameCredits();
    }
    if ($('body').hasClass('about')) {
      this.closeInGameAbout();
    }
  }

  showAchievementNotification(id, name) {
    var $notif = $('#achievement-notification'),
      $name = $notif.find('.name'),
      $button = $('#achievementsbutton');

    $notif.removeClass().addClass('active achievement' + id);
    $name.text(name);
    if (this.game.storage.getAchievementCount() === 1) {
      this.blinkInterval = setInterval(function () {
        $button.toggleClass('blink');
      }, 500);
    }
    setTimeout(function () {
      $notif.removeClass('active');
      $button.removeClass('blink');
    }, 5000);
  }

  displayUnlockedAchievement(id) {
    var $achievement = $('#achievements li.achievement' + id);

    var achievement = this.game.getAchievementById(id);
    if (achievement && achievement.hidden) {
      this.setAchievementData($achievement, achievement.name, achievement.desc);
    }
    $achievement.addClass('unlocked');
  }

  unlockAchievement(id, name) {
    this.showAchievementNotification(id, name);
    this.displayUnlockedAchievement(id);

    var nb = parseInt($('#unlocked-achievements').text());
    $('#unlocked-achievements').text(nb + 1);
  }

  initAchievementList(achievements) {
    var self = this,
      $lists = $('#lists'),
      $page = $('#page-tmpl'),
      $achievement = $('#achievement-tmpl'),
      page = 0,
      count = 0,
      $p = null;

    _.each(achievements, function (achievement) {
      count++;

      var $a = $achievement.clone();
      $a.removeAttr('id');
      $a.addClass('achievement' + count);
      if (!achievement.hidden) {
        self.setAchievementData($a, achievement.name, achievement.desc);
      }
      $a.find('.twitter').attr('href', 'http://twitter.com/share?text=I%20unlocked%20the%20%27' + achievement.name + '%27%20achievement%20on%20%23Fracture%21');
      $a.show();
      $a.find('a').click(function () {
        var url = $(this).attr('href');

        self.openPopup('twitter', url);
        return false;
      });

      if ((count - 1) % 4 === 0) {
        page++;
        $p = $page.clone();
        $p.attr('id', 'page' + page);
        $p.show();
        $lists.append($p);
      }
      $p.append($a);
    });

    $('#total-achievements').text($('#achievements').find('li').length);
  }

  initUnlockedAchievements(ids) {
    var self = this;

    _.each(ids, function (id) {
      self.displayUnlockedAchievement(id);
    });
    $('#unlocked-achievements').text(ids.length);
  }

  setAchievementData($el, name, desc) {
    $el.find('.achievement-name').html(name);
    $el.find('.achievement-description').html(desc);
  }

  toggleCredits() {
    var currentState = $('#parchment').attr('class');

    if (this.game.started) {
      $('#parchment').removeClass().addClass('credits');

      $('body').toggleClass('credits');

      if (!this.game.player) {
        $('body').toggleClass('death');
      }
      if ($('body').hasClass('about')) {
        this.closeInGameAbout();
        $('#helpbutton').removeClass('active');
      }
    } else {
      if (currentState !== 'animate') {
        if (currentState === 'credits') {
          this.animateParchment(currentState, this.previousState);
        } else {
          this.animateParchment(currentState, 'credits');
          this.previousState = currentState;
        }
      }
    }
  }

  toggleAbout() {
    var currentState = $('#parchment').attr('class');

    if (this.game.started) {
      $('#parchment').removeClass().addClass('about');
      $('body').toggleClass('about');
      if (!this.game.player) {
        $('body').toggleClass('death');
      }
      if ($('body').hasClass('credits')) {
        this.closeInGameCredits();
      }
    } else {
      if (currentState !== 'animate') {
        if (currentState === 'about') {

          if (localStorage.getItem('data')) {
            this.animateParchment(currentState, 'loadcharacter');
          } else {
            this.animateParchment(currentState, 'createcharacter');
          }
        } else {
          this.animateParchment(currentState, 'about');
          this.previousState = currentState;
        }
      }
    }
  }

  closeInGameCredits() {
    $('body').removeClass('credits');
    $('#parchment').removeClass('credits');
    if (!this.game.player) {
      $('body').addClass('death');
    }
  }

  closeInGameAbout() {
    $('body').removeClass('about');
    $('#parchment').removeClass('about');
    if (!this.game.player) {
      $('body').addClass('death');
    }
    $('#helpbutton').removeClass('active');
  }

  togglePopulationInfo() {
    $('#population').toggleClass('visible');
  }

  openPopup(type, url) {
    var h = $(window).height(),
      w = $(window).width(),
      popupHeight,
      popupWidth,
      top,
      left;

    switch (type) {
      case 'twitter':
        popupHeight = 450;
        popupWidth = 550;
        break;
      case 'facebook':
        popupHeight = 400;
        popupWidth = 580;
        break;
    }

    top = (h / 2) - (popupHeight / 2);
    left = (w / 2) - (popupWidth / 2);

    const newwindow = window.open(url, 'name', 'height=' + popupHeight + ',width=' + popupWidth + ',top=' + top + ',left=' + left);
    if (window.focus) {
      newwindow.focus()
    }
  }

  animateParchment(origin, destination) {
    var self = this,
      $parchment = $('#parchment'),
      duration = 1;

    if (this.isMobile) {
      $parchment.removeClass(origin).addClass(destination);
    } else {
      if (this.isParchmentReady) {
        if (this.isTablet) {
          duration = 0;
        }
        this.isParchmentReady = !this.isParchmentReady;

        $parchment.toggleClass('animate');
        $parchment.removeClass(origin);

        setTimeout(function () {
          $('#parchment').toggleClass('animate');
          $parchment.addClass(destination);
        }, duration * 1000);

        setTimeout(function () {
          self.isParchmentReady = !self.isParchmentReady;
        }, duration * 1000);
      }
    }
  }

  animateMessages() {
    var $messages = $('#notifications div');

    $messages.addClass('top');
  }

  resetMessagesPosition() {
    var message = $('#message2').text();

    $('#notifications div').removeClass('top');
    $('#message2').text('');
    $('#message1').text(message);
  }

  showMessage(message) {
    var $wrapper = $('#notifications div'),
      $message = $('#notifications #message2');

    this.animateMessages();
    $message.text(message);
    if (this.messageTimer) {
      this.resetMessageTimer();
    }

    this.messageTimer = setTimeout(function () {
      $wrapper.addClass('top');
    }, 5000);
  }

  resetMessageTimer() {
    clearTimeout(this.messageTimer);
  }

  resizeUi() {
    if (this.game) {
      if (this.game.started) {
        this.game.resize();
        this.initHealthBar();
        this.initXpBar();
        this.game.updateBars();
      } else {
        var newScale = this.game.renderer.getScaleFactor();
        this.game.renderer.rescale(newScale);
      }
    }
  }

  // ============================================================================
  // PAUSE OVERLAY - Shows when window loses focus
  // ============================================================================

  private pauseOverlay: HTMLElement | null = null;
  private isPaused: boolean = false;

  /**
   * Initialize the pause overlay and focus handlers
   * Call this after the game has started
   */
  initPauseOverlay(): void {
    // Create overlay element
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.id = 'pause-overlay';
    this.pauseOverlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 99999;
        cursor: pointer;
      ">
        <div style="
          color: #ccc;
          font-family: 'Press Start 2P', monospace;
          font-size: 32px;
          text-shadow: 2px 2px 4px #000;
          margin-bottom: 20px;
        ">PAUSED</div>
        <div style="
          color: #888;
          font-family: 'Press Start 2P', monospace;
          font-size: 14px;
        ">Click to Resume</div>
      </div>
    `;
    this.pauseOverlay.style.display = 'none';
    document.body.appendChild(this.pauseOverlay);

    // Click to resume
    this.pauseOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.resumeGame();
    });

    // Window focus/blur handlers
    window.addEventListener('blur', () => {
      if (this.game && this.game.started && !this.isPaused) {
        this.pauseGame();
      }
    });

    // Also handle visibility change (for tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.game && this.game.started && !this.isPaused) {
        this.pauseGame();
      }
    });
  }

  pauseGame(): void {
    if (!this.pauseOverlay || this.isPaused) return;
    this.isPaused = true;
    this.pauseOverlay.style.display = 'block';
  }

  resumeGame(): void {
    if (!this.pauseOverlay || !this.isPaused) return;
    this.isPaused = false;
    this.pauseOverlay.style.display = 'none';
  }
}
